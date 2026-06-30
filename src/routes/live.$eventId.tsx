import { createFileRoute, Link } from "@tanstack/react-router";
import { api, API_ENABLED } from "@/lib/api";
import { useAppSettings } from "@/lib/app-settings";
import { transposeKeyLabel, uniqueTransposedChords } from "@/lib/chords";
import { useAuth, useData, USERS } from "@/lib/store";
import { useLiveSync } from "@/lib/use-live-sync";
import { normalizeEvent, normalizeGroup, normalizeSong } from "@/lib/view-models";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Minus,
  Pause,
  Play,
  Plus,
  SlidersHorizontal,
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
type ViewGroup = ReturnType<typeof normalizeGroup>;
type ViewSong = ReturnType<typeof normalizeSong>;
type ArrangementSectionLike = {
  name?: string;
  lines?: Array<{
    type?: string;
    chordLine?: string;
    lyricLine?: string;
  }>;
};
type SongKeyParts = { root: string; suffix: string };

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

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function isFullSongPartName(value?: string | null) {
  if (!value) return true;
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, " ");
  return normalized === "full song" || normalized === "fullsong" || normalized === "song";
}

function buildArrangementParts(arrangement: ArrangementSectionLike[] = []) {
  return arrangement.map((section, index) => ({
    name: section?.name || `Section ${index + 1}`,
    chords: (section?.lines || []).map((line) => line?.chordLine || "").join("\n"),
    lyrics: (section?.lines || []).map((line) => line?.lyricLine || "").join("\n"),
    lines: (section?.lines || []).map((line) => ({
      type: line?.type || "lyric_only",
      chordLine: line?.chordLine || "",
      lyricLine: line?.lyricLine || "",
    })),
  }));
}

function buildSongLookup(songs: ViewSong[]) {
  const lookup = new Map<string, ViewSong>();
  songs.forEach((song) => {
    [song.id, song.publicSongId, song.sourceId]
      .filter(Boolean)
      .forEach((key) => lookup.set(String(key), song));
  });
  return lookup;
}

function shouldUsePseudoFullscreen() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isIOSDevice = /iPhone|iPad|iPod/i.test(ua);
  const isTouchMac = /Macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
  return isIOSDevice || isTouchMac;
}

function LivePage() {
  const { settings } = useAppSettings();
  const { eventId } = Route.useParams();
  const local = useData();
  const { user } = useAuth();
  const localEvent = local.events.find((entry) => entry.id === eventId);

  const [eventData, setEventData] = useState<ViewEvent | null>(
    (localEvent as ViewEvent | null) || null,
  );
  const [songsData, setSongsData] = useState<ViewSong[]>([]);
  const [groupsData, setGroupsData] = useState<ViewGroup[]>(local.groups.map(normalizeGroup));
  const [loading, setLoading] = useState(API_ENABLED);
  const [error, setError] = useState("");
  const [scrolling, setScrolling] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [transpose, setTranspose] = useState(0);
  const [fontScale, setFontScale] = useState<FontScale>("large");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPseudoFullscreen, setIsPseudoFullscreen] = useState(false);
  const [fontSizeStep, setFontSizeStep] = useState(0);
  const [readerToolsOpen, setReaderToolsOpen] = useState(false);
  const [roleBusy, setRoleBusy] = useState(false);
  const [scrollerRequestNotice, setScrollerRequestNotice] = useState("");
  const [celebration, setCelebration] = useState<{ name: string; ts: number } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const applyingRemoteScroll = useRef(false);
  const followerFrameRef = useRef<number | null>(null);
  const lastScrollEmitAt = useRef(0);
  const remoteBasePctRef = useRef(0);
  const remoteBaseTimeRef = useRef(0);
  const currentGroup = useMemo(
    () => groupsData.find((group) => group.id === eventData?.groupId) || null,
    [eventData?.groupId, groupsData],
  );
  const currentMemberRole = useMemo(() => {
    const role = currentGroup?.members.find((member) => member.userId === user?.id)?.role;
    return role || "Sync";
  }, [currentGroup, user?.id]);

  const {
    connected,
    state: liveState,
    viewers,
    viewerCount,
    joinEvent,
    stageChange,
    scrollerRequest,
    scrollerRequestResolved,
    requestScroller,
    respondScrollerRequest,
    setIndex,
    sendScroll,
    setPlayback,
    setTranspose: syncTranspose,
  } = useLiveSync({ eventId, role: currentMemberRole });

  const items = useMemo(
    () => eventData?.playlists.flatMap((playlist) => playlist.items) ?? [],
    [eventData],
  );
  const songMap = useMemo(() => buildSongLookup(songsData), [songsData]);
  const remoteScrollerId = liveState.scrollerId;
  const activeIndex = useMemo(() => {
    if (!items.length) return 0;
    if (!connected) return Math.max(0, Math.min(local.liveIndex, items.length - 1));
    if (liveState.itemId) {
      const matchedIndex = items.findIndex((item) => item.id === liveState.itemId);
      if (matchedIndex >= 0) return matchedIndex;
    }
    return Math.max(0, Math.min(liveState.index, items.length - 1));
  }, [connected, items, liveState.index, liveState.itemId, local.liveIndex]);
  const activeScrollerId = connected ? remoteScrollerId : local.liveScrollerId;
  const isScroller = connected ? remoteScrollerId === user?.id : local.liveScrollerId === user?.id;
  const effectiveFullscreen = isFullscreen || isPseudoFullscreen;
  const baseStageMultiplier = Math.max(0.4, (settings.stageReaderFontPercent || 100) / 100);
  const fontSizeMultiplier = Math.max(0.4, baseStageMultiplier + fontSizeStep * 0.08);

  const current = items[activeIndex];
  const song = current ? songMap.get(current.songId) : null;
  const prevSong = activeIndex > 0 ? songMap.get(items[activeIndex - 1]?.songId) : null;
  const nextSong = items[activeIndex + 1] ? songMap.get(items[activeIndex + 1]?.songId) : null;

  const loadStageData = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!API_ENABLED) {
        setLoading(false);
        return;
      }

      if (!silent) setLoading(true);
      setError("");

      try {
        const stageRes = await api.getStage(eventId);
        const normalizedEvent = normalizeEvent(stageRes.event);
        setEventData(normalizedEvent);
        setSongsData((stageRes.songs || []).map(normalizeSong));
      } catch (loadError: unknown) {
        setError(getErrorMessage(loadError, "Failed to load stage data"));
        if (localEvent) setEventData(localEvent as ViewEvent);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [eventId, localEvent],
  );

  useEffect(() => {
    void loadStageData();
  }, [loadStageData]);

  useEffect(() => {
    let cancelled = false;

    async function loadGroups() {
      if (!API_ENABLED) {
        setGroupsData(local.groups.map(normalizeGroup));
        return;
      }

      try {
        const res = await api.listGroups();
        if (cancelled) return;
        setGroupsData((res.groups || []).map(normalizeGroup));
      } catch {
        if (cancelled) return;
      }
    }

    void loadGroups();
    return () => {
      cancelled = true;
    };
  }, [local.groups]);

  useEffect(() => {
    if (!stageChange) return;
    void loadStageData({ silent: true });
  }, [loadStageData, stageChange]);
  const canTakeScroll = currentMemberRole === "Scroller" && !isScroller;
  const canUseGlobalStage = currentMemberRole === "Scroller" && isScroller;
  const canUseLocalStage = currentMemberRole === "Self";
  const canControlPlayback = canUseGlobalStage || canUseLocalStage;
  const followsScroller = currentMemberRole !== "Self" && connected && !isScroller;

  useEffect(() => {
    if (!connected || currentMemberRole === "Self") return;
    setScrolling(liveState.playing);
    setSpeed(liveState.speed || 1);
    setTranspose(Math.max(-6, Math.min(6, liveState.transpose || 0)));
  }, [connected, currentMemberRole, liveState.playing, liveState.speed, liveState.transpose]);

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

  useEffect(() => {
    if (!scrolling || !canControlPlayback) return;
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
  }, [canControlPlayback, scrolling, speed]);

  useEffect(() => {
    if (!canUseGlobalStage || !connected) return;
    const element = scrollRef.current;
    if (!element) return;
    let pending = false;
    const onScroll = () => {
      if (applyingRemoteScroll.current || pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        const now = performance.now();
        if (now - lastScrollEmitAt.current < 33) return;
        lastScrollEmitAt.current = now;
        const max = element.scrollHeight - element.clientHeight;
        const pct = max > 0 ? element.scrollTop / max : 0;
        const progressSpeed = scrolling && max > 0 ? (speed * 24) / max : 0;
        sendScroll(element.scrollTop, pct, progressSpeed);
      });
    };
    element.addEventListener("scroll", onScroll, { passive: true });
    return () => element.removeEventListener("scroll", onScroll);
  }, [activeIndex, canUseGlobalStage, connected, scrolling, sendScroll, speed]);

  useEffect(() => {
    remoteBasePctRef.current = liveState.scrollPct || 0;
    remoteBaseTimeRef.current = liveState.updatedAt || Date.now();
  }, [liveState.scrollPct, liveState.updatedAt]);

  useEffect(() => {
    if (!followsScroller) return;
    const element = scrollRef.current;
    if (!element) return;

    const step = () => {
      const max = Math.max(0, element.scrollHeight - element.clientHeight);
      const elapsed = liveState.playing ? Math.max(0, Date.now() - remoteBaseTimeRef.current) : 0;
      const targetPct = Math.max(
        0,
        Math.min(1, remoteBasePctRef.current + (elapsed / 1000) * (liveState.progressSpeed || 0)),
      );
      const target = Math.min(max, targetPct * max);
      const delta = target - element.scrollTop;

      if (Math.abs(delta) > 0.5) {
        applyingRemoteScroll.current = true;
        element.scrollTop += Math.abs(delta) > 64 ? delta * 0.34 : delta * 0.2;
        requestAnimationFrame(() => {
          applyingRemoteScroll.current = false;
        });
      }

      followerFrameRef.current = requestAnimationFrame(step);
    };

    followerFrameRef.current = requestAnimationFrame(step);
    return () => {
      if (followerFrameRef.current) cancelAnimationFrame(followerFrameRef.current);
    };
  }, [activeIndex, followsScroller, liveState.playing, liveState.progressSpeed]);

  const goIndex = (index: number) => {
    if (!canUseGlobalStage) return;
    const itemId = items[index]?.id || null;
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    if (connected) setIndex(index, itemId);
    local.setLiveIndex(index);
    setScrolling(false);
    if (connected) setPlayback(false, speed);
  };

  const togglePlay = () => {
    if (!canControlPlayback) return;
    const next = !scrolling;
    setScrolling(next);
    if (connected && canUseGlobalStage) setPlayback(next, speed);
  };

  const changeSpeed = (delta: number) => {
    const next = Math.min(8, Math.max(0.1, +(speed + delta).toFixed(2)));
    setSpeed(next);
    if (connected && canUseGlobalStage) setPlayback(scrolling, next);
  };

  const changeFontSize = (delta: -1 | 1) => {
    setFontSizeStep((current) => Math.max(-4, Math.min(9, current + delta)));
  };

  const onTakeScroller = () => {
    if (!user || currentMemberRole !== "Scroller") return;
    if (connected) requestScroller();
    else local.requestScroller(user.id);
  };

  const updateMyRole = async (nextRole: "Sync" | "Self" | "Scroller") => {
    if (!currentGroup || !user || roleBusy) return;
    setRoleBusy(true);
    setError("");
    try {
      if (API_ENABLED) {
        const res = await api.setMemberRole(currentGroup.id, user.id, nextRole);
        const nextGroup = normalizeGroup(res.group);
        setGroupsData((current) =>
          current.map((group) => (group.id === nextGroup.id ? nextGroup : group)),
        );
      } else {
        local.setMemberRole(currentGroup.id, user.id, nextRole);
        setGroupsData((current) =>
          current.map((group) =>
            group.id === currentGroup.id
              ? {
                  ...group,
                  members: group.members.map((member) =>
                    member.userId === user.id ? { ...member, role: nextRole } : member,
                  ),
                }
              : group,
          ),
        );
      }
    } catch (roleError: unknown) {
      setError(getErrorMessage(roleError, "Failed to update your role"));
    } finally {
      setRoleBusy(false);
    }
  };

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) {
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
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
        setIsPseudoFullscreen(false);
        return;
      }
    } catch {
      /* iOS / unsupported browser fallback */
    }
    setIsPseudoFullscreen((current) => !current);
  };

  useEffect(() => {
    if (!scrollerRequestResolved || scrollerRequestResolved.requester.id !== user?.id) return;
    setScrollerRequestNotice(
      scrollerRequestResolved.approved
        ? "Scroller request approved."
        : "Scroller request declined.",
    );
    const timeout = window.setTimeout(() => setScrollerRequestNotice(""), 2400);
    return () => window.clearTimeout(timeout);
  }, [scrollerRequestResolved, user?.id]);

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

  const arrangedParts =
    current && Array.isArray(current.arrangement) && current.arrangement.length
      ? buildArrangementParts(current.arrangement)
      : [];
  const itemBaseTranspose = Number(current?.transpose || 0);
  const effectiveTranspose = itemBaseTranspose + transpose;
  const songKeyParts = song ? parseSongKey(song.key) : null;
  const renderedKey = song ? transposeKeyLabel(song.key, effectiveTranspose) : "-";
  const activeTransposeRoot = song ? parseSongKey(renderedKey)?.root || null : null;

  const selectTransposeRoot = (targetRoot: string) => {
    if (!songKeyParts || (!canUseGlobalStage && currentMemberRole !== "Self")) return;
    const sourceIndex = normalizeEnharmonic(songKeyParts.root);
    const targetIndex = normalizeEnharmonic(targetRoot);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const totalSemitones = ((targetIndex - sourceIndex + 18) % 12) - 6;
    const nextLiveTranspose = Math.max(-6, Math.min(6, totalSemitones - itemBaseTranspose));
    setTranspose(nextLiveTranspose);
    if (connected && canUseGlobalStage) syncTranspose(nextLiveTranspose);
  };

  const partsToShow = song
    ? arrangedParts.length
      ? arrangedParts
      : current?.partName && !isFullSongPartName(current.partName)
        ? song.parts.filter(
            (part) => part.name.trim().toLowerCase() === current.partName?.trim().toLowerCase(),
          )
        : song.parts
    : arrangedParts;
  const uniqueChordList = uniqueTransposedChords(
    partsToShow.flatMap((part) =>
      Array.isArray(part.lines) && part.lines.length
        ? part.lines.map((line) => line.chordLine || "").filter(Boolean)
        : part.chords.split("\n").filter(Boolean),
    ),
    effectiveTranspose,
  );

  const scrollerName =
    (connected ? viewers.find((viewer) => viewer.id === activeScrollerId)?.name : null) ??
    USERS.find((entry) => entry.id === activeScrollerId)?.name ??
    "-";

  return (
    <div
      className={`${effectiveFullscreen ? "fixed inset-0 z-[100] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]" : "fixed inset-0"} flex flex-col bg-stage-black text-white`}
      style={
        effectiveFullscreen
          ? {
              width: "var(--app-fullscreen-width, 100vw)",
              height: "var(--app-fullscreen-height, 100dvh)",
            }
          : undefined
      }
    >
      {celebration && <JoinCelebration name={celebration.name} />}
      {scrollerRequest && canUseGlobalStage && (
        <div className="absolute inset-x-0 top-16 z-[75] flex justify-center px-4">
          <div className="w-full max-w-xl rounded-2xl border border-amber-glow/30 bg-stage-card/95 p-4 shadow-2xl backdrop-blur-xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-amber-glow">
              Scroller Request
            </p>
            <p className="mt-2 text-sm text-white">
              {scrollerRequest.requester.name} wants to become the scroller.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => {
                  respondScrollerRequest(true, scrollerRequest.requester.id);
                  void updateMyRole("Sync");
                }}
                className="rounded-xl bg-amber-glow px-3 py-2 text-xs font-bold text-stage-black"
              >
                Yes, give scroll
              </button>
              <button
                onClick={() => respondScrollerRequest(false, scrollerRequest.requester.id)}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white/75"
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}
      {scrollerRequestNotice ? (
        <div className="absolute inset-x-0 top-16 z-[72] flex justify-center px-4">
          <div className="rounded-full border border-white/10 bg-stage-card/95 px-4 py-2 text-xs font-bold text-white/80 shadow-xl backdrop-blur-xl">
            {scrollerRequestNotice}
          </div>
        </div>
      ) : null}

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
            {scrollerName} · Role: {currentMemberRole}
          </p>
          {error && <p className="truncate text-[10px] text-amber-glow">{error}</p>}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={currentMemberRole}
            onChange={(e) => void updateMyRole(e.target.value as "Sync" | "Self" | "Scroller")}
            disabled={roleBusy}
            className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white/75 outline-none sm:block"
          >
            <option value="Sync">Sync</option>
            <option value="Self">Self</option>
            <option value="Scroller">Scroller</option>
          </select>

          <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest">
            {connected ? (
              <Wifi className="size-3 text-emerald-400" />
            ) : (
              <WifiOff className="size-3 text-white/40" />
            )}
            <UsersIcon className="size-3 text-white/60" />
            <span>{connected ? viewerCount : 1}</span>
          </div>

          {canTakeScroll && user && (
            <button
              onClick={onTakeScroller}
              className="hidden rounded-full border border-neon-sync/30 bg-neon-sync/15 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-neon-sync sm:inline-flex sm:px-3"
            >
              Request scroll
            </button>
          )}

          {canUseGlobalStage && (
            <span className="animate-sync rounded-full border border-amber-glow/30 bg-amber-glow/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-amber-glow">
              You scroll
            </span>
          )}

          <button
            onClick={toggleFullscreen}
            className="size-9 rounded-lg flex items-center justify-center hover:bg-white/5"
          >
            {effectiveFullscreen ? (
              <Minimize2 className="size-4" />
            ) : (
              <Maximize2 className="size-4" />
            )}
          </button>
        </div>
      </header>

      <div className="border-b border-white/5 bg-stage-black/70 px-3 py-2 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-2 py-1">
            <button
              onClick={() => changeFontSize(-1)}
              className="size-7 rounded-md flex items-center justify-center hover:bg-white/10"
            >
              <Minus className="size-3.5" />
            </button>
            <span className="min-w-20 text-center text-[11px] font-bold capitalize text-white/75">
              Text {Math.round(fontSizeMultiplier * 100)}%
            </span>
            <button
              onClick={() => changeFontSize(1)}
              className="size-7 rounded-md flex items-center justify-center hover:bg-white/10"
            >
              <Plus className="size-3.5" />
            </button>
          </div>

          <button
            onClick={() => setReaderToolsOpen((current) => !current)}
            className={`flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold ${
              readerToolsOpen
                ? "bg-white/10 text-white"
                : "bg-white/5 text-white/70 hover:text-white"
            }`}
          >
            <SlidersHorizontal className="size-3.5" />
            Display
          </button>
        </div>

        {readerToolsOpen && (
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <StageControlCard
              title="Stage Role"
              subtitle="Choose synced follow, self control, or scroller access"
              className="sm:hidden"
            >
              <div className="space-y-3">
                <select
                  value={currentMemberRole}
                  onChange={(e) =>
                    void updateMyRole(e.target.value as "Sync" | "Self" | "Scroller")
                  }
                  disabled={roleBusy}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-white/80 outline-none"
                >
                  <option value="Sync">Sync</option>
                  <option value="Self">Self</option>
                  <option value="Scroller">Scroller</option>
                </select>
                {canTakeScroll && user ? (
                  <button
                    onClick={onTakeScroller}
                    className="w-full rounded-xl border border-neon-sync/30 bg-neon-sync/15 px-3 py-2 text-xs font-bold uppercase tracking-widest text-neon-sync"
                  >
                    Request scroll
                  </button>
                ) : null}
              </div>
            </StageControlCard>

            <StageControlCard title="Transpose" subtitle={`Current key ${renderedKey}`}>
              <TransposeKeyPicker
                activeRoot={activeTransposeRoot}
                disabled={!songKeyParts || (!canUseGlobalStage && currentMemberRole !== "Self")}
                onSelect={selectTransposeRoot}
              />
            </StageControlCard>

            <StageControlCard title="Chord List" subtitle="Unique chords to play after transpose">
              <div className="flex flex-wrap gap-2">
                {uniqueChordList.map((chord) => (
                  <span
                    key={chord}
                    className="chord-text rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm"
                  >
                    {chord}
                  </span>
                ))}
                {!uniqueChordList.length ? (
                  <span className="text-sm text-white/45">No chords available</span>
                ) : null}
              </div>
            </StageControlCard>
          </div>
        )}
      </div>

      <div
        ref={scrollRef}
        className={`flex-1 overflow-y-auto no-scrollbar ${followsScroller ? "pointer-events-none" : ""}`}
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
                  {isFullSongPartName(current?.partName) ? "Full Song" : current?.partName}
                </p>
                <h1 className="mt-2 text-5xl font-black leading-[0.95] sm:text-7xl md:text-8xl">
                  {song.title}
                </h1>
                <p className="mt-2 text-base text-white/50 sm:text-lg">
                  {song.artist} · Key {transposeKeyLabel(song.key, effectiveTranspose)} ·{" "}
                  {song.capo} · {song.tempo} BPM · Song{" "}
                  {itemBaseTranspose > 0 ? `+${itemBaseTranspose}` : itemBaseTranspose}
                </p>
              </div>

              <div className="space-y-14">
                {partsToShow.map((part, index) => (
                  <SongPartBlock
                    key={`${part.name}-${index}`}
                    part={part}
                    highlight={part.name === "Chorus" || part.name === "Final Chorus"}
                    transpose={effectiveTranspose}
                    fontScale={fontScale}
                    fontSizeMultiplier={fontSizeMultiplier}
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
          disabled={!canUseGlobalStage || activeIndex === 0}
          className="size-10 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 disabled:opacity-30"
        >
          <ChevronLeft className="size-5" />
        </button>
        <button
          onClick={togglePlay}
          disabled={!canUseGlobalStage || !song}
          className="glow-amber size-12 rounded-full bg-amber-glow text-stage-black flex items-center justify-center active:scale-95 disabled:opacity-40"
        >
          {scrolling ? <Pause className="size-5" /> : <Play className="ml-0.5 size-5" />}
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <div className="hidden min-w-0 flex-1 sm:block">
            <p className="truncate text-[10px] uppercase tracking-widest text-white/35">Previous</p>
            <p className="truncate text-xs text-white/65">{prevSong?.title || "Start of set"}</p>
          </div>
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
          <div className="hidden min-w-0 flex-1 text-right sm:block">
            <p className="truncate text-[10px] uppercase tracking-widest text-white/35">Next</p>
            <p className="truncate text-xs text-white/65">{nextSong?.title || "End of set"}</p>
          </div>
        </div>
        <button
          onClick={() => goIndex(Math.min(items.length - 1, activeIndex + 1))}
          disabled={!canUseGlobalStage || activeIndex >= items.length - 1}
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

function StageControlCard({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[1.15rem] border border-white/10 bg-stage-black/40 p-3 sm:p-4 ${className}`.trim()}
    >
      <div className="mb-2.5">
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
                className={`rounded-lg px-2 py-1.5 text-sm font-semibold transition-colors ${
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
