import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { transposeChordLine, transposeKeyLabel, uniqueTransposedChords } from "@/lib/chords";
import { api, API_ENABLED } from "@/lib/api";
import { useAppSettings } from "@/lib/app-settings";
import { readLocalFavoriteSongIds, toggleLocalFavoriteSong } from "@/lib/song-favorites";
import { useAuth } from "@/lib/store";
import { normalizeSong } from "@/lib/view-models";
import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  Heart,
  Maximize2,
  Minimize2,
  Minus,
  Pause,
  Play,
  Plus,
  SlidersHorizontal,
  X,
} from "lucide-react";

export const Route = createFileRoute("/songs/$songId")({
  head: () => ({
    meta: [
      { title: "Song - ChordSync Live" },
      { name: "description", content: "Song detail view" },
    ],
  }),
  notFoundComponent: () => (
    <AppShell>
      <div className="p-8 text-center text-white/60">Song not found.</div>
    </AppShell>
  ),
  component: SongPage,
});

type ViewSong = ReturnType<typeof normalizeSong>;
export type FontScale = "compact" | "comfortable" | "large";
type ScrollMode = "continuous" | "step";
type SongKeyParts = { root: string; suffix: string };

const FONT_SCALE_CLASSES: Record<FontScale, { chord: string; lyric: string; gap: string }> = {
  compact: {
    chord: "text-sm sm:text-base md:text-lg",
    lyric: "text-sm sm:text-base md:text-lg",
    gap: "space-y-1",
  },
  comfortable: {
    chord: "text-base sm:text-lg md:text-xl",
    lyric: "text-base sm:text-lg md:text-xl",
    gap: "space-y-1.5",
  },
  large: {
    chord: "text-lg sm:text-xl md:text-2xl",
    lyric: "text-lg sm:text-xl md:text-2xl",
    gap: "space-y-2",
  },
};

const NOTE_TO_INDEX: Record<string, number> = {
  C: 0,
  "B#": 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  Fb: 4,
  F: 5,
  "E#": 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
  Cb: 11,
};

const TRANSPOSE_NOTE_ROWS = [
  ["Ab", "A", "A#", "Bb", "B", "C"],
  ["C#", "Db", "D", "D#", "Eb", "E"],
  ["F", "F#", "Gb", "G", "G#"],
];

function parseSongKey(key: string): SongKeyParts | null {
  const match = key?.match(/^([A-G](?:#|b)?)(.*)$/);
  if (!match) return null;
  return { root: match[1], suffix: match[2] || "" };
}

function normalizeEnharmonic(note: string) {
  const index = NOTE_TO_INDEX[note];
  return typeof index === "number" ? index : -1;
}

function looksLikeChordRow(value: string) {
  if (!value) return false;
  return /\|/.test(value) && /[A-G](?:#|b)?/.test(value) && !/[a-z]{3,}/.test(value);
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function shouldUsePseudoFullscreen() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isIOSDevice = /iPhone|iPad|iPod/i.test(ua);
  const isTouchMac = /Macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
  return isIOSDevice || isTouchMac;
}

function SongPage() {
  const { settings } = useAppSettings();
  const { user } = useAuth();
  const { songId } = Route.useParams();
  const [song, setSong] = useState<ViewSong | null>(null);
  const [loading, setLoading] = useState(API_ENABLED);
  const [error, setError] = useState("");
  const [scrolling, setScrolling] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [scrollMode, setScrollMode] = useState<ScrollMode>("continuous");
  const [stepIntervalSeconds, setStepIntervalSeconds] = useState(5);
  const [stepLineCount, setStepLineCount] = useState(2);
  const [transpose, setTranspose] = useState(0);
  const [preferredTransposeRoot, setPreferredTransposeRoot] = useState<string | null>(null);
  const [fontScale, setFontScale] = useState<FontScale>("comfortable");
  const [fontSizePercent, setFontSizePercent] = useState(115);
  const [readerToolsOpen, setReaderToolsOpen] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPseudoFullscreen, setIsPseudoFullscreen] = useState(false);
  const readerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const stepTimerRef = useRef<number | null>(null);
  const effectiveFullscreen = isFullscreen || isPseudoFullscreen;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!API_ENABLED) return;
      setLoading(true);
      setError("");
      try {
        const res = await api.getSong(songId);
        if (cancelled) return;
        const normalized = normalizeSong(res.song);
        if (!API_ENABLED || !user) {
          const localFavorites = new Set(readLocalFavoriteSongIds());
          normalized.isFavorite = localFavorites.has(normalized.id);
        }
        setSong(normalized);
      } catch (loadError: unknown) {
        if (cancelled) return;
        setError(getErrorMessage(loadError, "Failed to load song"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [songId, user]);

  useEffect(() => {
    setTranspose(0);
    setPreferredTransposeRoot(null);
    setFontSizePercent(settings.songReaderFontPercent || 73);
    setReaderToolsOpen(false);
  }, [settings.songReaderFontPercent, songId]);

  useEffect(() => {
    if (!scrolling || scrollMode !== "continuous") return;
    let last = performance.now();
    const tick = (time: number) => {
      const dt = time - last;
      last = time;
      const element = scrollRef.current;
      if (element) {
        const max = Math.max(0, element.scrollHeight - element.clientHeight);
        element.scrollTop = Math.min(max, element.scrollTop + (dt / 1000) * speed * 24);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [scrolling, scrollMode, speed]);

  useEffect(() => {
    if (!scrolling || scrollMode !== "step") return;
    const element = scrollRef.current;
    if (!element) return;

    const step = () => {
      const lines = Array.from(
        element.querySelectorAll<HTMLElement>("[data-scroll-line='1']"),
      ).filter((line) => line.offsetParent !== null);
      if (!lines.length) return;

      const targetIndex = Math.min(
        lines.length - 1,
        lines.findIndex((line) => line.offsetTop > element.scrollTop + 4) +
          Math.max(stepLineCount - 1, 0),
      );
      const fallbackIndex = Math.min(lines.length - 1, Math.max(stepLineCount - 1, 0));
      const nextLine = lines[targetIndex >= 0 ? targetIndex : fallbackIndex] ?? null;
      const max = Math.max(0, element.scrollHeight - element.clientHeight);
      if (nextLine) {
        element.scrollTo({
          top: Math.min(max, Math.max(0, nextLine.offsetTop - 16)),
          behavior: "smooth",
        });
      }
    };

    stepTimerRef.current = window.setInterval(step, Math.max(1, stepIntervalSeconds) * 1000);
    return () => {
      if (stepTimerRef.current) window.clearInterval(stepTimerRef.current);
    };
  }, [scrolling, scrollMode, stepIntervalSeconds, stepLineCount]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === readerRef.current);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    if (!effectiveFullscreen) return;
    const root = document.documentElement;
    const body = document.body;
    const previousBodyOverflow = body.style.overflow;
    const previousRootOverflow = root.style.overflow;
    const previousBodyOverscroll = body.style.overscrollBehavior;
    const previousRootOverscroll = root.style.overscrollBehavior;

    const updateViewport = () => {
      const viewport = window.visualViewport;
      const height = Math.round(viewport?.height ?? window.innerHeight);
      const width = Math.round(viewport?.width ?? window.innerWidth);
      root.style.setProperty("--app-fullscreen-height", `${height}px`);
      root.style.setProperty("--app-fullscreen-width", `${width}px`);
    };

    body.style.overflow = "hidden";
    root.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    root.style.overscrollBehavior = "none";
    updateViewport();
    window.scrollTo(0, 0);

    window.addEventListener("resize", updateViewport);
    window.addEventListener("orientationchange", updateViewport);
    window.visualViewport?.addEventListener("resize", updateViewport);
    window.visualViewport?.addEventListener("scroll", updateViewport);

    return () => {
      body.style.overflow = previousBodyOverflow;
      root.style.overflow = previousRootOverflow;
      body.style.overscrollBehavior = previousBodyOverscroll;
      root.style.overscrollBehavior = previousRootOverscroll;
      root.style.removeProperty("--app-fullscreen-height");
      root.style.removeProperty("--app-fullscreen-width");
      window.removeEventListener("resize", updateViewport);
      window.removeEventListener("orientationchange", updateViewport);
      window.visualViewport?.removeEventListener("resize", updateViewport);
      window.visualViewport?.removeEventListener("scroll", updateViewport);
    };
  }, [effectiveFullscreen]);

  const toggleFullscreen = async () => {
    if (document.fullscreenElement === readerRef.current) {
      await document.exitFullscreen();
      setIsPseudoFullscreen(false);
      return;
    }
    if (isPseudoFullscreen) {
      setIsPseudoFullscreen(false);
      return;
    }
    if (shouldUsePseudoFullscreen()) {
      setIsPseudoFullscreen(true);
      return;
    }
    try {
      await readerRef.current?.requestFullscreen();
      setIsPseudoFullscreen(false);
      return;
    } catch {
      /* iOS / unsupported browser fallback */
    }
    setIsPseudoFullscreen((current) => !current);
  };

  if (loading) {
    return (
      <AppShell>
        <div className="p-8 text-center text-white/60">Loading song...</div>
      </AppShell>
    );
  }

  if (!song) {
    return (
      <AppShell>
        <div className="p-8 text-center text-white/60">
          Song not found.
          {error && <div className="mt-2 text-xs text-amber-glow">{error}</div>}
        </div>
      </AppShell>
    );
  }

  const songKeyParts = parseSongKey(song.key);
  const renderedKey = (() => {
    if (!songKeyParts) return transposeKeyLabel(song.key, transpose);
    if (preferredTransposeRoot) return `${preferredTransposeRoot}${songKeyParts.suffix}`;
    return transposeKeyLabel(song.key, transpose);
  })();
  const activeTransposeRoot =
    preferredTransposeRoot || parseSongKey(transposeKeyLabel(song.key, transpose))?.root || null;
  const fontSizeMultiplier = Math.max(0.4, fontSizePercent / 100);
  const uniqueChordList = uniqueTransposedChords(
    song.parts.flatMap((part) =>
      Array.isArray(part.lines) && part.lines.length
        ? part.lines.map((line) => line.chordLine || "").filter(Boolean)
        : part.chords.split("\n").filter(Boolean),
    ),
    transpose,
  );

  const selectTransposeRoot = (targetRoot: string) => {
    if (!songKeyParts) return;
    const sourceIndex = normalizeEnharmonic(songKeyParts.root);
    const targetIndex = normalizeEnharmonic(targetRoot);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const semitones = ((targetIndex - sourceIndex + 18) % 12) - 6;
    setTranspose(semitones);
    setPreferredTransposeRoot(targetRoot);
  };

  const toggleFavorite = async () => {
    if (!song || favoriteBusy) return;
    const nextFavorite = !song.isFavorite;
    setFavoriteBusy(true);
    try {
      if (API_ENABLED && user) {
        await api.setSongFavorite(song.id, nextFavorite);
      } else {
        toggleLocalFavoriteSong(song.id, nextFavorite);
      }
      setSong((current) => (current ? { ...current, isFavorite: nextFavorite } : current));
    } catch (toggleError: unknown) {
      setError(getErrorMessage(toggleError, "Failed to update favorite"));
    } finally {
      setFavoriteBusy(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:py-10">
        <Link
          to="/search"
          className="mb-4 inline-flex items-center gap-1 text-xs text-white/50 hover:text-amber-glow"
        >
          <ChevronLeft className="size-4" /> Back to browse
        </Link>

        {!effectiveFullscreen && (
          <section className="mb-6 overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(15,15,18,0.96),rgba(10,10,12,0.92))] shadow-[0_30px_90px_rgba(0,0,0,0.3)]">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)]">
              <div className="relative overflow-hidden px-5 py-6 sm:px-8 sm:py-8">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.16),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.1),transparent_38%)]" />
                <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
                  <img
                    src={song.cover}
                    alt={song.title}
                    className="size-24 rounded-[1.4rem] object-cover ring-1 ring-white/10 shadow-2xl sm:size-32"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-amber-glow/90">
                          {song.genre} · {song.vibe}
                        </p>
                        <h1 className="mt-2 break-words text-3xl font-black leading-[0.95] sm:text-5xl">
                          {song.title}
                        </h1>
                      </div>
                      <button
                        type="button"
                        disabled={favoriteBusy}
                        onClick={() => void toggleFavorite()}
                        className={`shrink-0 rounded-full border px-3 py-2 text-xs font-bold transition-colors ${
                          song.isFavorite
                            ? "border-amber-glow/35 bg-amber-glow/12 text-amber-glow"
                            : "border-white/10 bg-white/5 text-white/70 hover:text-white"
                        } ${favoriteBusy ? "opacity-60" : ""}`}
                      >
                        <span className="flex items-center gap-2">
                          <Heart className={`size-4 ${song.isFavorite ? "fill-current" : ""}`} />
                          {song.isFavorite ? "Favorited" : "Favorite"}
                        </span>
                      </button>
                    </div>
                    <p className="mt-2 text-sm text-white/60 sm:text-base">
                      {song.artist} · {song.year}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs">
                      <Meta label="Key" value={renderedKey} />
                      <Meta label="Capo" value={song.capo} />
                      <Meta label="Tempo" value={`${song.tempo} BPM`} />
                      <Meta label="Beat" value={song.beat} />
                      <Meta label="Difficulty" value={song.difficulty} />
                      <Meta label="Lang" value={song.language} />
                    </div>
                    {song.description && (
                      <p className="mt-4 max-w-2xl text-sm leading-7 text-white/62">
                        {song.description}
                      </p>
                    )}
                    {error && <p className="mt-3 text-xs text-amber-glow">{error}</p>}
                  </div>
                </div>
              </div>

              {/* <div className="border-t border-white/8 bg-white/[0.025] px-5 py-5 sm:px-6 lg:border-l lg:border-t-0">
                <div className="grid gap-4">
                  <ControlCard title="Reading Size" subtitle="Use any size you need">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setFontSizePercent((current) => Math.max(40, current - 5))}
                        className="size-9 rounded-xl border border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
                      >
                        <Minus className="mx-auto size-4" />
                      </button>
                      <input
                        type="range"
                        min={60}
                        max={220}
                        value={Math.max(60, Math.min(220, fontSizePercent))}
                        onChange={(e) => setFontSizePercent(Number(e.target.value))}
                        className="h-2 flex-1 accent-amber-glow"
                      />
                      <button
                        onClick={() => setFontSizePercent((current) => current + 5)}
                        className="size-9 rounded-xl border border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
                      >
                        <Plus className="mx-auto size-4" />
                      </button>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <input
                        type="number"
                        min={40}
                        value={fontSizePercent}
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          if (Number.isFinite(value) && value >= 40) setFontSizePercent(value);
                        }}
                        className="w-24 rounded-xl border border-white/10 bg-stage-black/60 px-3 py-2 text-sm text-white outline-none focus:border-amber-glow/40"
                      />
                      <span className="text-sm text-white/55">%</span>
                      <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 p-1">
                        {(["compact", "comfortable", "large"] as FontScale[]).map((option) => (
                          <button
                            key={option}
                            onClick={() => setFontScale(option)}
                            className={`rounded-full px-3 py-1.5 text-[11px] font-bold capitalize transition-colors ${
                              fontScale === option
                                ? "bg-amber-glow text-stage-black"
                                : "text-white/60 hover:text-white"
                            }`}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </div>
                  </ControlCard>

                  <ControlCard title="Transpose" subtitle={`Current key ${renderedKey}`}>
                    <TransposeKeyPicker
                      activeRoot={activeTransposeRoot}
                      disabled={!songKeyParts}
                      onSelect={selectTransposeRoot}
                    />
                  </ControlCard>

                  <ControlCard title="Chord List" subtitle="Unique chords to play after transpose">
                    <div className="flex flex-wrap gap-2">
                      {uniqueChordList.map((chord) => (
                        <span
                          key={chord}
                          className="chord-text rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm"
                        >
                          {chord}
                        </span>
                      ))}
                    </div>
                  </ControlCard>
                </div>
              </div> */}
            </div>
          </section>
        )}

        <div
          ref={readerRef}
          className={`rounded-3xl ${effectiveFullscreen ? "fixed inset-0 z-[100] bg-stage-black p-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] pb-[calc(env(safe-area-inset-bottom)+0.5rem)] sm:p-4" : ""}`}
          style={
            effectiveFullscreen
              ? {
                  width: "var(--app-fullscreen-width, 100vw)",
                  height: "var(--app-fullscreen-height, 100dvh)",
                }
              : undefined
          }
        >
          <div
            className={`glass-card sticky z-40 mb-6 rounded-[1.6rem] p-3 sm:p-4 ${effectiveFullscreen ? "top-0" : "top-16 sm:top-20"}`}
          >
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => setScrolling((current) => !current)}
                className="glow-amber size-11 rounded-full bg-amber-glow text-stage-black flex items-center justify-center font-bold active:scale-95 transition-transform"
                aria-label={scrolling ? "Pause" : "Play"}
              >
                {scrolling ? <Pause className="size-5" /> : <Play className="ml-0.5 size-5" />}
              </button>

              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 p-1">
                {(["continuous", "step"] as ScrollMode[]).map((option) => (
                  <button
                    key={option}
                    onClick={() => setScrollMode(option)}
                    className={`rounded-full px-3 py-1.5 text-[11px] font-bold capitalize transition-colors ${
                      scrollMode === option
                        ? "bg-amber-glow text-stage-black"
                        : "text-white/60 hover:text-white"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>

              <div className="min-w-[170px] flex-1 rounded-2xl border border-white/10 bg-stage-black/30 px-3 py-2">
                {scrollMode === "continuous" ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        setSpeed((current) => Math.max(0.1, +(current - 0.05).toFixed(2)))
                      }
                      className="size-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10"
                    >
                      <Minus className="size-3.5" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] uppercase tracking-widest text-white/40">
                        Auto-scroll speed
                      </p>
                      <p className="chord-text text-sm">{speed.toFixed(2)}x</p>
                    </div>
                    <button
                      onClick={() =>
                        setSpeed((current) => Math.min(8, +(current + 0.05).toFixed(2)))
                      }
                      className="size-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex min-w-[118px] flex-1 items-center gap-2">
                      <button
                        onClick={() =>
                          setStepIntervalSeconds((current) => Math.max(1, current - 1))
                        }
                        className="size-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10"
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] uppercase tracking-widest text-white/40">
                          Interval
                        </p>
                        <p className="chord-text text-sm">{stepIntervalSeconds}s</p>
                      </div>
                      <button
                        onClick={() =>
                          setStepIntervalSeconds((current) => Math.min(60, current + 1))
                        }
                        className="size-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                    <div className="flex min-w-[118px] flex-1 items-center gap-2">
                      <button
                        onClick={() => setStepLineCount((current) => Math.max(1, current - 1))}
                        className="size-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10"
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] uppercase tracking-widest text-white/40">Lines</p>
                        <p className="chord-text text-sm">{stepLineCount}</p>
                      </div>
                      <button
                        onClick={() => setStepLineCount((current) => Math.min(12, current + 1))}
                        className="size-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => setReaderToolsOpen((current) => !current)}
                className={`flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold transition-all duration-200 ${
                  readerToolsOpen
                    ? "bg-white/10 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.04)]"
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                }`}
                aria-label={readerToolsOpen ? "Close settings" : "Open settings"}
              >
                <span className="relative flex size-3.5 items-center justify-center">
                  <SlidersHorizontal
                    className={`absolute size-3.5 transition-all duration-200 ${
                      readerToolsOpen ? "scale-75 rotate-90 opacity-0" : "scale-100 opacity-100"
                    }`}
                  />
                  <X
                    className={`absolute size-3.5 transition-all duration-200 ${
                      readerToolsOpen ? "scale-100 opacity-100" : "scale-75 rotate-90 opacity-0"
                    }`}
                  />
                </span>
                {readerToolsOpen ? "Setting Close" : "Setting"}
              </button>

              <button
                onClick={toggleFullscreen}
                className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-white/70 hover:text-white"
              >
                {effectiveFullscreen ? (
                  <Minimize2 className="size-3.5" />
                ) : (
                  <Maximize2 className="size-3.5" />
                )}
                {effectiveFullscreen ? "Exit fullscreen" : "Fullscreen"}
              </button>
            </div>

            {readerToolsOpen && (
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <ControlCard title="Reading Size" subtitle="Adjust text for this screen">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setFontSizePercent((current) => Math.max(40, current - 5))}
                      className="size-9 rounded-xl border border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
                    >
                      <Minus className="mx-auto size-4" />
                    </button>
                    <input
                      type="range"
                      min={60}
                      max={220}
                      value={Math.max(60, Math.min(220, fontSizePercent))}
                      onChange={(e) => setFontSizePercent(Number(e.target.value))}
                      className="h-2 flex-1 accent-amber-glow"
                    />
                    <button
                      onClick={() => setFontSizePercent((current) => current + 5)}
                      className="size-9 rounded-xl border border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
                    >
                      <Plus className="mx-auto size-4" />
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <input
                      type="number"
                      min={40}
                      value={fontSizePercent}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        if (Number.isFinite(value) && value >= 40) setFontSizePercent(value);
                      }}
                      className="w-24 rounded-xl border border-white/10 bg-stage-black/60 px-3 py-2 text-sm text-white outline-none focus:border-amber-glow/40"
                    />
                    <span className="text-sm text-white/55">%</span>
                    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 p-1">
                      {(["compact", "comfortable", "large"] as FontScale[]).map((option) => (
                        <button
                          key={option}
                          onClick={() => setFontScale(option)}
                          className={`rounded-full px-3 py-1.5 text-[11px] font-bold capitalize transition-colors ${
                            fontScale === option
                              ? "bg-amber-glow text-stage-black"
                              : "text-white/60 hover:text-white"
                          }`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                </ControlCard>

                <ControlCard title="Transpose" subtitle={`Current key ${renderedKey}`}>
                  <TransposeKeyPicker
                    activeRoot={activeTransposeRoot}
                    disabled={!songKeyParts}
                    onSelect={selectTransposeRoot}
                  />
                </ControlCard>

                <ControlCard title="Chord List" subtitle="Unique chords to play after transpose">
                  <div className="flex flex-wrap gap-2">
                    {uniqueChordList.map((chord) => (
                      <span
                        key={chord}
                        className="chord-text rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm"
                      >
                        {chord}
                      </span>
                    ))}
                  </div>
                </ControlCard>
              </div>
            )}
          </div>

          <div
            ref={scrollRef}
            className={`relative overflow-y-auto rounded-[2rem] border border-white/5 bg-[linear-gradient(180deg,rgba(18,18,22,0.98),rgba(10,10,12,0.98))] p-5 no-scrollbar shadow-[0_30px_80px_rgba(0,0,0,0.28)] ${
              effectiveFullscreen ? "" : "max-h-[82vh]"
            } sm:p-10`}
            style={
              effectiveFullscreen
                ? {
                    height:
                      "calc(var(--app-fullscreen-height, 100dvh) - 7.5rem - env(safe-area-inset-top) - env(safe-area-inset-bottom))",
                  }
                : undefined
            }
          >
            <div className="absolute left-0 top-0 h-full w-1 rounded-full bg-amber-glow opacity-30" />
            <div className="space-y-12">
              {song.parts.map((part, index) => (
                <SongPartBlock
                  key={`${part.name}-${index}`}
                  part={part}
                  highlight={part.name === "Chorus" || part.name === "Final Chorus"}
                  transpose={transpose}
                  fontScale={fontScale}
                  fontSizeMultiplier={fontSizeMultiplier}
                />
              ))}
              <div className="h-40" />
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
      <span className="mr-1.5 text-white/40">{label}:</span>
      <span className="font-medium text-white">{value}</span>
    </div>
  );
}

function ControlCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[1.4rem] border border-white/10 bg-stage-black/40 p-4">
      <div className="mb-3">
        <p className="text-sm font-bold text-white">{title}</p>
        <p className="text-xs text-white/45">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function TransposeKeyPicker({
  activeRoot,
  disabled,
  onSelect,
}: {
  activeRoot: string | null;
  disabled?: boolean;
  onSelect: (root: string) => void;
}) {
  return (
    <div className="space-y-2">
      {TRANSPOSE_NOTE_ROWS.map((row, rowIndex) => (
        <div key={rowIndex} className="grid grid-cols-6 gap-1.5">
          {row.map((note) => {
            const active = activeRoot === note;
            return (
              <button
                key={note}
                type="button"
                disabled={disabled}
                onClick={() => onSelect(note)}
                className={`rounded-lg px-2 py-2 text-sm font-semibold transition-colors ${
                  active
                    ? "bg-amber-glow text-stage-black"
                    : "bg-white/5 text-white/78 hover:bg-white/10"
                } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
              >
                {note}
              </button>
            );
          })}
          {row.length < 6 &&
            Array.from({ length: 6 - row.length }).map((_, fillerIndex) => (
              <div key={`filler-${fillerIndex}`} />
            ))}
        </div>
      ))}
    </div>
  );
}

export function SongPartBlock({
  part,
  highlight,
  transpose = 0,
  fontScale = "comfortable",
  fontSizeMultiplier = 1,
}: {
  part: {
    name: string;
    chords: string;
    lyrics: string;
    lines?: Array<{ type: string; chordLine: string; lyricLine: string }>;
  };
  highlight?: boolean;
  transpose?: number;
  fontScale?: FontScale;
  fontSizeMultiplier?: number;
}) {
  const hasStructuredLines = Array.isArray(part.lines) && part.lines.length > 0;
  const fontClasses = FONT_SCALE_CLASSES[fontScale];
  const fallbackChordLines = part.chords.split("\n");
  const fallbackLyricLines = part.lyrics.split("\n");
  const fallbackRowCount = Math.max(fallbackChordLines.length, fallbackLyricLines.length);

  return (
    <div
      className={
        highlight
          ? "rounded-[1.5rem] border border-amber-glow/15 bg-[linear-gradient(180deg,rgba(251,191,36,0.08),rgba(251,191,36,0.03))] p-4 sm:-mx-4 sm:p-6"
          : ""
      }
    >
      <p
        className={`mb-4 border-b pb-2 text-[10px] font-bold uppercase tracking-[0.3em] sm:text-xs ${
          highlight ? "border-amber-glow/20 text-amber-glow/70" : "border-white/10 text-white/40"
        }`}
      >
        [{part.name}]
      </p>
      {hasStructuredLines ? (
        <div className={fontClasses.gap}>
          {part.lines?.map((line, index) => {
            if (line.type === "blank" || (!line.chordLine && !line.lyricLine)) {
              return <div key={index} className="h-5 sm:h-6" />;
            }

            return (
              <div key={index} data-scroll-line="1">
                {line.chordLine && (
                  <pre
                    className={`chord-text whitespace-pre-wrap ${fontClasses.chord}`}
                    style={{ fontSize: `${fontSizeMultiplier}em` }}
                  >
                    {transposeChordLine(line.chordLine, transpose)}
                  </pre>
                )}
                {line.lyricLine && looksLikeChordRow(line.lyricLine) ? (
                  <pre
                    className={`chord-text whitespace-pre-wrap ${fontClasses.chord}`}
                    style={{ fontSize: `${fontSizeMultiplier}em` }}
                  >
                    {transposeChordLine(line.lyricLine, transpose)}
                  </pre>
                ) : (
                  line.lyricLine && (
                    <pre
                      className={`whitespace-pre-wrap font-mono leading-[1.8] text-white/88 ${fontClasses.lyric}`}
                      style={{ fontSize: `${fontSizeMultiplier}em` }}
                    >
                      {line.lyricLine}
                    </pre>
                  )
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className={fontClasses.gap}>
          {Array.from({ length: fallbackRowCount }).map((_, index) => {
            const chordLine = fallbackChordLines[index] || "";
            const lyricLine = fallbackLyricLines[index] || "";
            if (!chordLine && !lyricLine) return <div key={index} className="h-5 sm:h-6" />;

            return (
              <div key={index} data-scroll-line="1">
                {chordLine && (
                  <pre
                    className={`chord-text whitespace-pre-wrap ${fontClasses.chord}`}
                    style={{ fontSize: `${fontSizeMultiplier}em` }}
                  >
                    {transposeChordLine(chordLine, transpose)}
                  </pre>
                )}
                {lyricLine && (
                  <pre
                    className={`whitespace-pre-wrap font-mono leading-[1.8] text-white/88 ${fontClasses.lyric}`}
                    style={{ fontSize: `${fontSizeMultiplier}em` }}
                  >
                    {lyricLine}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
