import { createFileRoute, Link } from "@tanstack/react-router";
import { api, API_ENABLED } from "@/lib/api";
import { transposeKeyLabel } from "@/lib/chords";
import { useAuth, useData, USERS } from "@/lib/store";
import { useLiveSync } from "@/lib/use-live-sync";
import { normalizeEvent, normalizeSong } from "@/lib/view-models";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Minus,
  Pause,
  Play,
  Plus,
  Users as UsersIcon,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { SongPartBlock, type FontScale } from "./songs.$songId";

export const Route = createFileRoute("/live/$eventId")({
  head: () => ({ meta: [{ title: "Stage Mode - ChordSync Live" }] }),
  component: LivePage,
});

type ViewEvent = ReturnType<typeof normalizeEvent>;
type ViewSong = ReturnType<typeof normalizeSong>;

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function LivePage() {
  const { eventId } = Route.useParams();
  const local = useData();
  const { user } = useAuth();
  const localEvent = local.events.find((entry) => entry.id === eventId);

  const [eventData, setEventData] = useState<ViewEvent | null>(
    (localEvent as ViewEvent | null) || null,
  );
  const [songsData, setSongsData] = useState<ViewSong[]>([]);
  const [loading, setLoading] = useState(API_ENABLED);
  const [error, setError] = useState("");
  const [scrolling, setScrolling] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [transpose, setTranspose] = useState(0);
  const [fontScale, setFontScale] = useState<FontScale>("large");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [celebration, setCelebration] = useState<{ name: string; ts: number } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const applyingRemoteScroll = useRef(false);

  const {
    connected,
    state: liveState,
    viewers,
    viewerCount,
    joinEvent,
    takeScroller,
    setIndex,
    sendScroll,
    setPlayback,
  } = useLiveSync({ eventId });

  const items = eventData?.playlists.flatMap((playlist) => playlist.items) ?? [];
  const songMap = useMemo(() => new Map(songsData.map((song) => [song.id, song])), [songsData]);
  const remoteScrollerId = liveState.scrollerId;
  const activeIndex = connected ? liveState.index : local.liveIndex;
  const activeScrollerId = connected ? remoteScrollerId : local.liveScrollerId;
  const isScroller = connected ? remoteScrollerId === user?.id : local.liveScrollerId === user?.id;

  const current = items[activeIndex];
  const song = current ? songMap.get(current.songId) : null;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!API_ENABLED) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const eventRes = await api.getEvent(eventId);
        if (cancelled) return;
        const normalizedEvent = normalizeEvent(eventRes.event);
        setEventData(normalizedEvent);

        const uniqueSongIds = Array.from(
          new Set(
            normalizedEvent.playlists.flatMap((playlist) =>
              playlist.items.map((item) => String(item.songId)).filter(Boolean),
            ),
          ),
        );

        const songResults = await Promise.all(
          uniqueSongIds.map(async (id) => {
            try {
              const res = await api.getSong(id);
              return normalizeSong(res.song);
            } catch {
              return null;
            }
          }),
        );

        if (cancelled) return;
        setSongsData(songResults.filter(Boolean) as ViewSong[]);
      } catch (loadError: unknown) {
        if (cancelled) return;
        setError(getErrorMessage(loadError, "Failed to load stage data"));
        if (localEvent) setEventData(localEvent as ViewEvent);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [eventId, localEvent]);

  useEffect(() => {
    if (!connected) return;
    setScrolling(liveState.playing);
    setSpeed(liveState.speed || 1);
  }, [connected, liveState.playing, liveState.speed]);

  useEffect(() => {
    if (!joinEvent || joinEvent.user.id === user?.id) return;
    setCelebration({ name: joinEvent.user.name, ts: joinEvent.ts });
    const timeout = window.setTimeout(() => setCelebration(null), 2600);
    return () => window.clearTimeout(timeout);
  }, [joinEvent, user?.id]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [activeIndex]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    if (!scrolling || !isScroller) return;
    let last = performance.now();
    const tick = (time: number) => {
      const dt = time - last;
      last = time;
      const element = scrollRef.current;
      if (element) element.scrollTop += (dt / 1000) * speed * 24;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isScroller, scrolling, speed]);

  useEffect(() => {
    if (!isScroller || !connected) return;
    const element = scrollRef.current;
    if (!element) return;
    let pending = false;
    const onScroll = () => {
      if (applyingRemoteScroll.current || pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        const max = element.scrollHeight - element.clientHeight;
        const pct = max > 0 ? element.scrollTop / max : 0;
        sendScroll(element.scrollTop, pct);
      });
    };
    element.addEventListener("scroll", onScroll, { passive: true });
    return () => element.removeEventListener("scroll", onScroll);
  }, [activeIndex, connected, isScroller, sendScroll]);

  useEffect(() => {
    if (isScroller || !connected) return;
    const element = scrollRef.current;
    if (!element) return;
    const max = element.scrollHeight - element.clientHeight;
    const target = Math.round(max * (liveState.scrollPct || 0));
    if (Math.abs(element.scrollTop - target) > 2) {
      applyingRemoteScroll.current = true;
      element.scrollTop = target;
      requestAnimationFrame(() => {
        applyingRemoteScroll.current = false;
      });
    }
  }, [activeIndex, connected, isScroller, liveState.scrollPct]);

  const goIndex = (index: number) => {
    if (!isScroller) return;
    if (connected) setIndex(index);
    local.setLiveIndex(index);
    setScrolling(false);
    if (connected) setPlayback(false, speed);
  };

  const togglePlay = () => {
    if (!isScroller) return;
    const next = !scrolling;
    setScrolling(next);
    if (connected) setPlayback(next, speed);
  };

  const changeSpeed = (delta: number) => {
    const next = Math.min(8, Math.max(0.1, +(speed + delta).toFixed(2)));
    setSpeed(next);
    if (connected && isScroller) setPlayback(scrolling, next);
  };

  const onTakeScroller = () => {
    if (!user) return;
    if (connected) takeScroller();
    else local.requestScroller(user.id);
  };

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await document.documentElement.requestFullscreen();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-white/60">
        Loading stage mode...
      </div>
    );
  }

  if (!eventData) {
    return (
      <div className="flex min-h-screen items-center justify-center text-white/60">
        Event not found.
      </div>
    );
  }

  const partsToShow = song
    ? current?.partName && current.partName !== "Full Song"
      ? song.parts.filter((part) => part.name === current.partName)
      : song.parts
    : [];

  const scrollerName =
    (connected ? viewers.find((viewer) => viewer.id === activeScrollerId)?.name : null) ??
    USERS.find((entry) => entry.id === activeScrollerId)?.name ??
    "-";

  return (
    <div className="fixed inset-0 flex flex-col bg-stage-black text-white">
      {celebration && <JoinCelebration name={celebration.name} />}

      <header className="shrink-0 border-b border-white/5 bg-stage-black/90 px-3 py-2.5 backdrop-blur-xl sm:px-6 flex items-center justify-between gap-3">
        <Link
          to="/events/$eventId"
          params={{ eventId }}
          className="size-9 rounded-lg flex items-center justify-center hover:bg-white/5"
        >
          <X className="size-4" />
        </Link>

        <div className="min-w-0 flex-1 text-center">
          <p className="flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest text-amber-glow">
            <span className="size-2 rounded-full bg-red-500 animate-pulse" /> Live ·{" "}
            {eventData.name}
          </p>
          <p className="truncate text-xs text-white/40">
            {Math.min(activeIndex + 1, items.length || 1)} / {items.length} · Scroller:{" "}
            {scrollerName}
          </p>
          {error && <p className="truncate text-[10px] text-amber-glow">{error}</p>}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest">
            {connected ? (
              <Wifi className="size-3 text-emerald-400" />
            ) : (
              <WifiOff className="size-3 text-white/40" />
            )}
            <UsersIcon className="size-3 text-white/60" />
            <span>{connected ? viewerCount : 1}</span>
          </div>

          {!isScroller && user && (
            <button
              onClick={onTakeScroller}
              className="hidden rounded-full border border-neon-sync/30 bg-neon-sync/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-neon-sync sm:block"
            >
              Take scroll
            </button>
          )}

          {isScroller && (
            <span className="animate-sync rounded-full border border-amber-glow/30 bg-amber-glow/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-amber-glow">
              You scroll
            </span>
          )}

          <button
            onClick={toggleFullscreen}
            className="size-9 rounded-lg flex items-center justify-center hover:bg-white/5"
          >
            {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </button>
        </div>
      </header>

      <div className="border-b border-white/5 bg-stage-black/70 px-3 py-2 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-1">
            {(["compact", "comfortable", "large"] as FontScale[]).map((option) => (
              <button
                key={option}
                onClick={() => setFontScale(option)}
                className={`rounded-lg px-3 py-1.5 text-[11px] font-bold capitalize ${
                  fontScale === option
                    ? "bg-amber-glow text-stage-black"
                    : "text-white/60 hover:text-white"
                }`}
              >
                {option}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-2 py-1">
            <button
              onClick={() => setTranspose((current) => Math.max(-6, current - 1))}
              className="size-7 rounded-md flex items-center justify-center hover:bg-white/10"
            >
              <Minus className="size-3.5" />
            </button>
            <span className="chord-text min-w-8 text-center text-xs">
              {transpose > 0 ? `+${transpose}` : transpose}
            </span>
            <button
              onClick={() => setTranspose((current) => Math.min(6, current + 1))}
              className="size-7 rounded-md flex items-center justify-center hover:bg-white/10"
            >
              <Plus className="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div
        ref={scrollRef}
        className={`flex-1 overflow-y-auto no-scrollbar ${!isScroller && connected ? "pointer-events-none" : ""}`}
      >
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-12">
          {!song && (
            <div className="py-32 text-center text-white/40">
              No song loaded for this set position yet.
            </div>
          )}
          {song && (
            <>
              <div className="mb-8 animate-fade-in-up sm:mb-12" key={`${song.id}-${activeIndex}`}>
                <p className="text-sm font-bold uppercase tracking-widest text-amber-glow">
                  {current?.partName ?? "Full Song"}
                </p>
                <h1 className="mt-2 text-5xl font-black leading-[0.95] sm:text-7xl md:text-8xl">
                  {song.title}
                </h1>
                <p className="mt-2 text-base text-white/50 sm:text-lg">
                  {song.artist} · Key {transposeKeyLabel(song.key, transpose)} · {song.capo} ·{" "}
                  {song.tempo} BPM
                </p>
              </div>

              <div className="space-y-14">
                {partsToShow.map((part, index) => (
                  <SongPartBlock
                    key={`${part.name}-${index}`}
                    part={part}
                    highlight={part.name === "Chorus" || part.name === "Final Chorus"}
                    transpose={transpose}
                    fontScale={fontScale}
                  />
                ))}
              </div>
              <div className="h-[45vh]" />
            </>
          )}
        </div>
      </div>

      <footer className="shrink-0 border-t border-white/10 bg-stage-black/95 px-3 py-3 backdrop-blur-xl pb-[env(safe-area-inset-bottom)] sm:px-6 flex items-center gap-2 sm:gap-4">
        <button
          onClick={() => goIndex(Math.max(0, activeIndex - 1))}
          disabled={!isScroller || activeIndex === 0}
          className="size-10 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 disabled:opacity-30"
        >
          <ChevronLeft className="size-5" />
        </button>
        <button
          onClick={togglePlay}
          disabled={!isScroller || !song}
          className="glow-amber size-12 rounded-full bg-amber-glow text-stage-black flex items-center justify-center active:scale-95 disabled:opacity-40"
        >
          {scrolling ? <Pause className="size-5" /> : <Play className="ml-0.5 size-5" />}
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <button
            onClick={() => changeSpeed(-0.05)}
            className="size-8 rounded-md bg-white/5 flex items-center justify-center hover:bg-white/10"
          >
            <Minus className="size-3.5" />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="text-[10px] uppercase tracking-widest text-white/40">Speed</p>
            <p className="chord-text text-sm">{speed.toFixed(2)}x</p>
          </div>
          <button
            onClick={() => changeSpeed(0.05)}
            className="size-8 rounded-md bg-white/5 flex items-center justify-center hover:bg-white/10"
          >
            <Plus className="size-3.5" />
          </button>
        </div>
        <button
          onClick={() => goIndex(Math.min(items.length - 1, activeIndex + 1))}
          disabled={!isScroller || activeIndex >= items.length - 1}
          className="size-10 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 disabled:opacity-30"
        >
          <ChevronRight className="size-5" />
        </button>
      </footer>
    </div>
  );
}

function JoinCelebration({ name }: { name: string }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-6 z-[70] flex justify-center">
      <div className="celebrate-burst relative overflow-hidden rounded-2xl border border-amber-glow/30 bg-stage-card/90 px-5 py-3 shadow-2xl backdrop-blur-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.25),transparent_60%)]" />
        <div className="relative flex items-center gap-3">
          <span className="text-xl">♪</span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-glow">
              New Performer Joined
            </p>
            <p className="text-sm font-bold text-white">{name} is now in stage mode</p>
          </div>
        </div>
        <div className="celebrate-dot left-4 top-3" />
        <div className="celebrate-dot left-10 top-7" />
        <div className="celebrate-dot right-6 top-4" />
        <div className="celebrate-dot right-12 top-8" />
      </div>
    </div>
  );
}
