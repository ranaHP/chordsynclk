import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { API_URL, getToken } from "./api";

export interface LiveState {
  index: number;
  itemId: string | null;
  scrollTop: number;
  scrollPct: number;
  progressSpeed: number;
  playing: boolean;
  speed: number;
  transpose: number;
  scrollerId: string | null;
  updatedAt: number;
}
export interface LiveViewer {
  id: string;
  name: string;
  email: string;
  socketId: string;
}

export interface LiveJoinEvent {
  user: LiveViewer;
  ts: number;
}

export interface LiveScrollerRequest {
  requester: LiveViewer;
  ts: number;
}

export interface LiveScrollerRequestResolved {
  approved: boolean;
  requester: LiveViewer;
  ts: number;
}

export interface LiveStageChangeEvent {
  eventId: string;
  reason?: string;
  ts: number;
}

interface UseLiveSyncOptions {
  eventId: string;
  enabled?: boolean;
  role?: string;
}

/**
 * Socket.IO bridge for the Stage Mode page.
 * - All viewers receive `state` updates broadcast by whoever is the Scroller.
 * - Non-scrollers' fullscreen scroll position follows the Scroller via scrollPct.
 * - `viewers`/`count` give live presence.
 *
 * If VITE_API_URL is not set, returns a no-op shape so the page still renders with mock data.
 */
export function useLiveSync({ eventId, enabled = true, role }: UseLiveSyncOptions) {
  const [connected, setConnected] = useState(false);
  const [state, setState] = useState<LiveState>({
    index: 0,
    itemId: null,
    scrollTop: 0,
    scrollPct: 0,
    progressSpeed: 0,
    playing: false,
    speed: 1,
    transpose: 0,
    scrollerId: null,
    updatedAt: 0,
  });
  const [viewers, setViewers] = useState<LiveViewer[]>([]);
  const [joinEvent, setJoinEvent] = useState<LiveJoinEvent | null>(null);
  const [stageChange, setStageChange] = useState<LiveStageChangeEvent | null>(null);
  const [scrollerRequest, setScrollerRequest] = useState<LiveScrollerRequest | null>(null);
  const [scrollerRequestResolved, setScrollerRequestResolved] =
    useState<LiveScrollerRequestResolved | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!enabled || !API_URL || !eventId) return;
    const token = getToken();
    if (!token) return;

    const s = io(API_URL, { auth: { token }, transports: ["websocket", "polling"] });
    socketRef.current = s;

    s.on("connect", () => {
      setConnected(true);
      s.emit("live:join", { eventId, role });
    });
    s.on("disconnect", () => setConnected(false));
    s.on("live:state", (st: LiveState) => setState((prev) => ({ ...prev, ...st })));
    s.on("live:viewers", ({ users }: { count: number; users: LiveViewer[] }) => setViewers(users));
    s.on("live:viewer-joined", (event: LiveJoinEvent) => setJoinEvent(event));
    s.on("live:stage-changed", (event: LiveStageChangeEvent) => setStageChange(event));
    s.on("live:scroller-request", (event: LiveScrollerRequest) => setScrollerRequest(event));
    s.on("live:scroller-request-resolved", (event: LiveScrollerRequestResolved) => {
      setScrollerRequest(null);
      setScrollerRequestResolved(event);
    });

    return () => {
      s.emit("live:leave");
      s.disconnect();
      socketRef.current = null;
    };
  }, [eventId, enabled, role]);

  const emit = useCallback((event: string, payload?: unknown) => {
    socketRef.current?.emit(event, payload);
  }, []);

  return {
    connected,
    state,
    viewers,
    joinEvent,
    stageChange,
    scrollerRequest,
    scrollerRequestResolved,
    viewerCount: viewers.length,
    takeScroller: useCallback(() => emit("live:take-scroller"), [emit]),
    requestScroller: useCallback(() => emit("live:request-scroller"), [emit]),
    respondScrollerRequest: useCallback(
      (approved: boolean, requesterId?: string) =>
        emit("live:respond-scroller-request", { approved, requesterId }),
      [emit],
    ),
    setIndex: useCallback(
      (index: number, itemId?: string | null) => emit("live:index", { index, itemId }),
      [emit],
    ),
    sendScroll: useCallback(
      (scrollTop: number, scrollPct: number, progressSpeed = 0) =>
        emit("live:scroll", { scrollTop, scrollPct, progressSpeed }),
      [emit],
    ),
    setPlayback: useCallback(
      (playing: boolean, speed: number) => emit("live:playback", { playing, speed }),
      [emit],
    ),
    setTranspose: useCallback((transpose: number) => emit("live:transpose", { transpose }), [emit]),
  };
}
