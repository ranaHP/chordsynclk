import { createFileRoute, Link } from "@tanstack/react-router";
import { api, API_ENABLED } from "@/lib/api";
import { useAuth, useData, USERS } from "@/lib/store";
import { normalizeEvent, normalizeSong } from "@/lib/view-models";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Minus,
  Pause,
  Play,
  Plus,
  Users as UsersIcon,
  X,
  Wifi,
  WifiOff,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { SongPartBlock } from "./songs.$songId";
import { useLiveSync } from "@/lib/use-live-sync";

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

  const items = eventData?.playlists.flatMap((playlist) => playlist.items) ?? [];
  const songMap = useMemo(() => new Map(songsData.map((song) => [song.id, song])), [songsData]);

  const {
    connected,
    state: liveState,
    viewers,
    viewerCount,
    takeScroller,
    setIndex,
    sendScroll,
    setPlayback,
  } = useLiveSync({ eventId });
  const remoteScrollerId = liveState.scrollerId;
  const activeIndex = connected ? liveState.index : local.liveIndex;
  const activeScrollerId = connected ? remoteScrollerId : local.liveScrollerId;
  const isScroller = connected ? remoteScrollerId === user?.id : local.liveScrollerId === user?.id;

  const current = items[activeIndex];
  const song = current ? songMap.get(current.songId) : null;

  const [scrolling, setScrolling] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const applyingRemoteScroll = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!API_ENABLED) return;
      setLoading(true);
      setError("");
      try {
        const [eventRes, songsRes] = await Promise.all([
          api.getEvent(eventId),
          api.listSongs("", "", 1, 500),
        ]);
        if (cancelled) return;
        setEventData(normalizeEvent(eventRes.event));
        setSongsData((songsRes.songs || []).map(normalizeSong));
      } catch (error: unknown) {
        if (cancelled) return;
        setError(getErrorMessage(error, "Failed to load stage data"));
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
      if (element) element.scrollTop += (dt / 16) * speed * 0.7;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [scrolling, speed, isScroller]);

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
  };

  const togglePlay = () => {
    if (!isScroller) return;
    const next = !scrolling;
    setScrolling(next);
    if (connected) setPlayback(next, speed);
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

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center text-white/60">
        Loading stage mode...
      </div>
    );
  if (!eventData)
    return (
      <div className="min-h-screen flex items-center justify-center text-white/60">
        Event not found.
      </div>
    );

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
    <div className="fixed inset-0 bg-stage-black text-white flex flex-col">
      <header className="shrink-0 border-b border-white/5 bg-stage-black/90 backdrop-blur-xl px-3 sm:px-6 py-2.5 flex items-center justify-between gap-3">
        <Link
          to="/events/$eventId"
          params={{ eventId }}
          className="size-9 rounded-lg hover:bg-white/5 flex items-center justify-center"
        >
          <X className="size-4" />
        </Link>
        <div className="flex-1 min-w-0 text-center">
          <p className="text-[10px] uppercase tracking-widest text-amber-glow font-bold flex items-center justify-center gap-2">
            <span className="size-2 bg-red-500 rounded-full animate-pulse" /> Live ·{" "}
            {eventData.name}
          </p>
          <p className="text-xs text-white/40 truncate">
            {activeIndex + 1} / {items.length} · Scroller: {scrollerName}
          </p>
          {error && <p className="text-[10px] text-amber-glow truncate">{error}</p>}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-widest">
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
              className="px-3 py-1.5 rounded-full bg-neon-sync/15 border border-neon-sync/30 text-neon-sync text-[10px] font-bold uppercase tracking-widest hidden sm:block"
            >
              Take scroll
            </button>
          )}
          {isScroller && (
            <span className="px-3 py-1.5 rounded-full bg-amber-glow/15 border border-amber-glow/30 text-amber-glow text-[10px] font-bold uppercase tracking-widest animate-sync">
              You scroll
            </span>
          )}
          <button
            onClick={toggleFullscreen}
            className="size-9 rounded-lg hover:bg-white/5 flex items-center justify-center"
          >
            {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </button>
        </div>
      </header>

      <div
        ref={scrollRef}
        className={`flex-1 overflow-y-auto no-scrollbar ${!isScroller && connected ? "pointer-events-none" : ""}`}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-8 py-6 sm:py-12">
          {!song && <div className="text-center text-white/40 py-32">No songs in setlist yet.</div>}
          {song && (
            <>
              <div className="mb-8 sm:mb-12 animate-fade-in-up" key={song.id}>
                <p className="text-amber-glow font-bold text-sm tracking-widest uppercase">
                  {current?.partName ?? "Full Song"}
                </p>
                <h1 className="text-5xl sm:text-7xl md:text-8xl font-black leading-[0.95] mt-2">
                  {song.title}
                </h1>
                <p className="text-white/50 text-base sm:text-lg mt-2">
                  {song.artist} · Key {song.key} · {song.capo} · {song.tempo} BPM
                </p>
              </div>
              <div className="space-y-12 text-lg sm:text-2xl md:text-3xl leading-relaxed">
                {partsToShow.map((part, index) => (
                  <SongPartBlock
                    key={index}
                    part={part}
                    highlight={part.name === "Chorus" || part.name === "Final Chorus"}
                  />
                ))}
              </div>
              <div className="h-[40vh]" />
            </>
          )}
        </div>
      </div>

      <footer className="shrink-0 border-t border-white/10 bg-stage-black/95 backdrop-blur-xl px-3 sm:px-6 py-3 flex items-center gap-2 sm:gap-4 pb-[env(safe-area-inset-bottom)]">
        <button
          onClick={() => goIndex(Math.max(0, activeIndex - 1))}
          disabled={!isScroller || activeIndex === 0}
          className="size-10 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 flex items-center justify-center"
        >
          <ChevronLeft className="size-5" />
        </button>
        <button
          onClick={togglePlay}
          disabled={!isScroller}
          className="size-12 rounded-full bg-amber-glow text-stage-black flex items-center justify-center glow-amber active:scale-95 disabled:opacity-40"
        >
          {scrolling ? <Pause className="size-5" /> : <Play className="size-5 ml-0.5" />}
        </button>
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <button
            onClick={() =>
              setSpeed((currentSpeed) => Math.max(0.25, +(currentSpeed - 0.25).toFixed(2)))
            }
            className="size-8 rounded-md bg-white/5 hover:bg-white/10 flex items-center justify-center"
          >
            <Minus className="size-3.5" />
          </button>
          <div className="flex-1 min-w-0 text-center">
            <p className="text-[10px] uppercase tracking-widest text-white/40">Speed</p>
            <p className="chord-text text-sm">{speed.toFixed(2)}x</p>
          </div>
          <button
            onClick={() =>
              setSpeed((currentSpeed) => Math.min(4, +(currentSpeed + 0.25).toFixed(2)))
            }
            className="size-8 rounded-md bg-white/5 hover:bg-white/10 flex items-center justify-center"
          >
            <Plus className="size-3.5" />
          </button>
        </div>
        <button
          onClick={() => goIndex(Math.min(items.length - 1, activeIndex + 1))}
          disabled={!isScroller || activeIndex >= items.length - 1}
          className="size-10 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 flex items-center justify-center"
        >
          <ChevronRight className="size-5" />
        </button>
      </footer>
    </div>
  );
}
