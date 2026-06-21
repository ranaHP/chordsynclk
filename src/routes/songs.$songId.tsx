import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { transposeChordLine, transposeKeyLabel } from "@/lib/chords";
import { api, API_ENABLED } from "@/lib/api";
import { normalizeSong } from "@/lib/view-models";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Maximize2, Minimize2, Minus, Pause, Play, Plus } from "lucide-react";

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

function looksLikeChordRow(value: string) {
  if (!value) return false;
  return /\|/.test(value) && /[A-G](?:#|b)?/.test(value) && !/[a-z]{3,}/.test(value);
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function SongPage() {
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
  const [fontScale, setFontScale] = useState<FontScale>("comfortable");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const readerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const stepTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!API_ENABLED) return;
      setLoading(true);
      setError("");
      try {
        const res = await api.getSong(songId);
        if (cancelled) return;
        setSong(normalizeSong(res.song));
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
  }, [songId]);

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
        lines.findIndex((line) => line.offsetTop > element.scrollTop + 4) + Math.max(stepLineCount - 1, 0),
      );
      const fallbackIndex = Math.min(lines.length - 1, Math.max(stepLineCount - 1, 0));
      const nextLine = lines[(targetIndex >= 0 ? targetIndex : fallbackIndex)] ?? null;
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

  const toggleFullscreen = async () => {
    if (document.fullscreenElement === readerRef.current) {
      await document.exitFullscreen();
      return;
    }
    await readerRef.current?.requestFullscreen();
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

  const renderedKey = transposeKeyLabel(song.key, transpose);

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
        <Link
          to="/search"
          className="mb-4 inline-flex items-center gap-1 text-xs text-white/50 hover:text-amber-glow"
        >
          <ChevronLeft className="size-4" /> Back to browse
        </Link>

        <header className={`mb-6 grid gap-5 sm:grid-cols-[auto_1fr] items-end ${isFullscreen ? "hidden" : ""}`}>
          <img
            src={song.cover}
            alt={song.title}
            className="size-32 rounded-2xl object-cover ring-1 ring-white/10 sm:size-40"
          />
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-amber-glow">
              {song.genre} · {song.vibe}
            </p>
            <h1 className="mt-1 text-4xl font-black leading-tight sm:text-5xl">{song.title}</h1>
            <p className="mt-1 text-white/60">
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
          </div>
        </header>

        {!isFullscreen && error && <p className="mb-4 text-xs text-amber-glow">{error}</p>}
        {!isFullscreen && <p className="mb-6 text-sm text-white/60">{song.description}</p>}

        <div
          ref={readerRef}
          className={`rounded-3xl ${isFullscreen ? "bg-stage-black p-2 sm:p-4" : ""}`}
        >
          <div className={`glass-card sticky z-40 mb-6 flex flex-wrap items-center gap-3 rounded-2xl p-3 sm:p-4 ${isFullscreen ? "top-0" : "top-16 sm:top-20"}`}>
            <button
              onClick={() => setScrolling((current) => !current)}
              className="glow-amber size-11 rounded-full bg-amber-glow text-stage-black flex items-center justify-center font-bold active:scale-95 transition-transform"
              aria-label={scrolling ? "Pause" : "Play"}
            >
              {scrolling ? <Pause className="size-5" /> : <Play className="ml-0.5 size-5" />}
            </button>

            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-1">
              {(["continuous", "step"] as ScrollMode[]).map((option) => (
                <button
                  key={option}
                  onClick={() => setScrollMode(option)}
                  className={`rounded-lg px-3 py-1.5 text-[11px] font-bold capitalize transition-colors ${
                    scrollMode === option
                      ? "bg-amber-glow text-stage-black"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>

            {scrollMode === "continuous" ? (
              <div className="flex min-w-[180px] flex-1 items-center gap-2">
                <button
                  onClick={() => setSpeed((current) => Math.max(0.1, +(current - 0.05).toFixed(2)))}
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
                  onClick={() => setSpeed((current) => Math.min(8, +(current + 0.05).toFixed(2)))}
                  className="size-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10"
                >
                  <Plus className="size-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex min-w-[250px] flex-1 flex-wrap items-center gap-2">
                <div className="flex min-w-[118px] items-center gap-2">
                  <button
                    onClick={() => setStepIntervalSeconds((current) => Math.max(1, current - 1))}
                    className="size-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10"
                  >
                    <Minus className="size-3.5" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase tracking-widest text-white/40">Interval</p>
                    <p className="chord-text text-sm">{stepIntervalSeconds}s</p>
                  </div>
                  <button
                    onClick={() => setStepIntervalSeconds((current) => Math.min(60, current + 1))}
                    className="size-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>
                <div className="flex min-w-[118px] items-center gap-2">
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

            <div className="flex min-w-[170px] items-center gap-2">
              <button
                onClick={() => setTranspose((current) => Math.max(-6, current - 1))}
                className="size-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10"
              >
                <Minus className="size-3.5" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-widest text-white/40">Transpose</p>
                <p className="chord-text text-sm">{transpose > 0 ? `+${transpose}` : transpose}</p>
              </div>
              <button
                onClick={() => setTranspose((current) => Math.min(6, current + 1))}
                className="size-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10"
              >
                <Plus className="size-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-1">
              {(["compact", "comfortable", "large"] as FontScale[]).map((option) => (
                <button
                  key={option}
                  onClick={() => setFontScale(option)}
                  className={`rounded-lg px-3 py-1.5 text-[11px] font-bold capitalize transition-colors ${
                    fontScale === option
                      ? "bg-amber-glow text-stage-black"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>

            <button
              onClick={toggleFullscreen}
              className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-white/70 hover:text-white"
            >
              {isFullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
              {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            </button>
          </div>

          <div
            ref={scrollRef}
            className={`relative overflow-y-auto rounded-3xl border border-white/5 bg-stage-card p-6 no-scrollbar sm:p-10 ${
              isFullscreen ? "h-[calc(100vh-7rem)]" : "max-h-[82vh]"
            }`}
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
    <div className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1">
      <span className="mr-1.5 text-white/40">{label}:</span>
      <span className="font-medium text-white">{value}</span>
    </div>
  );
}

export function SongPartBlock({
  part,
  highlight,
  transpose = 0,
  fontScale = "comfortable",
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
          ? "rounded-xl border border-amber-glow/15 bg-amber-glow/5 p-4 sm:-mx-6 sm:p-6"
          : ""
      }
    >
      <p
        className={`mb-4 border-b pb-1.5 text-[10px] font-bold uppercase tracking-[0.3em] sm:text-xs ${
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
                  <pre className={`chord-text whitespace-pre-wrap ${fontClasses.chord}`}>
                    {transposeChordLine(line.chordLine, transpose)}
                  </pre>
                )}
                {line.lyricLine && looksLikeChordRow(line.lyricLine) ? (
                  <pre className={`chord-text whitespace-pre-wrap ${fontClasses.chord}`}>
                    {transposeChordLine(line.lyricLine, transpose)}
                  </pre>
                ) : (
                  line.lyricLine && (
                    <pre
                      className={`whitespace-pre-wrap font-mono leading-[1.8] text-white/85 ${fontClasses.lyric}`}
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
                  <pre className={`chord-text whitespace-pre-wrap ${fontClasses.chord}`}>
                    {transposeChordLine(chordLine, transpose)}
                  </pre>
                )}
                {lyricLine && (
                  <pre
                    className={`whitespace-pre-wrap font-mono leading-[1.8] text-white/85 ${fontClasses.lyric}`}
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
