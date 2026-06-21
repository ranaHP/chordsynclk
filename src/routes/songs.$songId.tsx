import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { api, API_ENABLED } from "@/lib/api";
import { normalizeSong } from "@/lib/view-models";
import { useEffect, useRef, useState } from "react";
import { Play, Pause, Minus, Plus, ChevronLeft, Maximize2, Minimize2 } from "lucide-react";

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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

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
    if (!scrolling) return;
    let last = performance.now();
    const tick = (time: number) => {
      const dt = time - last;
      last = time;
      const element = scrollRef.current;
      if (element) element.scrollTop += (dt / 16) * speed * 0.6;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [scrolling, speed]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await document.documentElement.requestFullscreen();
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

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 py-6 sm:py-10">
        <Link
          to="/search"
          className="inline-flex items-center gap-1 text-xs text-white/50 hover:text-amber-glow mb-4"
        >
          <ChevronLeft className="size-4" /> Back to browse
        </Link>

        <header className="grid sm:grid-cols-[auto_1fr] gap-5 items-end mb-6">
          <img
            src={song.cover}
            alt={song.title}
            className="size-32 sm:size-40 rounded-2xl object-cover ring-1 ring-white/10"
          />
          <div>
            <p className="text-xs uppercase tracking-widest text-amber-glow font-bold">
              {song.genre} • {song.vibe}
            </p>
            <h1 className="text-4xl sm:text-5xl font-black leading-tight mt-1">{song.title}</h1>
            <p className="text-white/60 mt-1">
              {song.artist} • {song.year}
            </p>
            <div className="flex flex-wrap gap-2 mt-4 text-xs">
              <Meta label="Key" value={song.key} />
              <Meta label="Capo" value={song.capo} />
              <Meta label="Tempo" value={`${song.tempo} BPM`} />
              <Meta label="Beat" value={song.beat} />
              <Meta label="Difficulty" value={song.difficulty} />
              <Meta label="Lang" value={song.language} />
            </div>
          </div>
        </header>

        {error && <p className="text-xs text-amber-glow mb-4">{error}</p>}
        <p className="text-white/60 text-sm mb-6">{song.description}</p>

        <div className="glass-card rounded-2xl p-3 sm:p-4 sticky top-16 sm:top-20 z-40 mb-6 flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setScrolling((current) => !current)}
            className="size-11 rounded-full bg-amber-glow text-stage-black flex items-center justify-center font-bold glow-amber active:scale-95 transition-transform"
            aria-label={scrolling ? "Pause" : "Play"}
          >
            {scrolling ? <Pause className="size-5" /> : <Play className="size-5 ml-0.5" />}
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <button
              onClick={() => setSpeed((current) => Math.max(0.25, +(current - 0.25).toFixed(2)))}
              className="size-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center"
            >
              <Minus className="size-3.5" />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-white/40">
                Auto-scroll speed
              </p>
              <p className="chord-text text-sm">{speed.toFixed(2)}x</p>
            </div>
            <button
              onClick={() => setSpeed((current) => Math.min(4, +(current + 0.25).toFixed(2)))}
              className="size-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center"
            >
              <Plus className="size-3.5" />
            </button>
          </div>
          <button
            onClick={toggleFullscreen}
            className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 text-xs font-bold text-white/70 hover:text-white"
          >
            {isFullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
            {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          </button>
        </div>

        <div
          ref={scrollRef}
          className="relative bg-stage-card border border-white/5 rounded-3xl p-5 sm:p-10 max-h-[70vh] overflow-y-auto no-scrollbar"
        >
          <div className="absolute top-0 left-0 w-1 h-full bg-amber-glow opacity-30 rounded-full" />
          <div className="space-y-10">
            {song.parts.map((part, index) => (
              <SongPartBlock
                key={index}
                part={part}
                highlight={part.name === "Chorus" || part.name === "Final Chorus"}
              />
            ))}
            <div className="h-32" />
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10">
      <span className="text-white/40 mr-1.5">{label}:</span>
      <span className="text-white font-medium">{value}</span>
    </div>
  );
}

export function SongPartBlock({
  part,
  highlight,
}: {
  part: {
    name: string;
    chords: string;
    lyrics: string;
    lines?: Array<{ type: string; chordLine: string; lyricLine: string }>;
  };
  highlight?: boolean;
}) {
  const hasStructuredLines = Array.isArray(part.lines) && part.lines.length > 0;

  return (
    <div
      className={
        highlight
          ? "bg-amber-glow/5 -mx-3 sm:-mx-6 p-4 sm:p-6 rounded-xl border border-amber-glow/15"
          : ""
      }
    >
      <p
        className={`text-[10px] sm:text-xs font-bold uppercase tracking-[0.3em] ${highlight ? "text-amber-glow/70" : "text-white/40"} border-b ${highlight ? "border-amber-glow/20" : "border-white/10"} pb-1.5 mb-4`}
      >
        [{part.name}]
      </p>
      {hasStructuredLines ? (
        <div className="space-y-1.5">
          {part.lines?.map((line, index) => {
            if (line.type === "blank" || (!line.chordLine && !line.lyricLine)) {
              return <div key={index} className="h-4 sm:h-5" />;
            }

            return (
              <div key={index}>
                {line.chordLine && (
                  <pre className="chord-text text-sm sm:text-base whitespace-pre-wrap">
                    {line.chordLine}
                  </pre>
                )}
                {line.lyricLine && (
                  <pre className="font-mono text-sm sm:text-base text-white/85 whitespace-pre-wrap leading-relaxed">
                    {line.lyricLine}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <>
          <pre className="chord-text text-sm sm:text-base whitespace-pre-wrap mb-3">
            {part.chords}
          </pre>
          <pre className="font-mono text-sm sm:text-base text-white/85 whitespace-pre-wrap leading-relaxed">
            {part.lyrics}
          </pre>
        </>
      )}
    </div>
  );
}
