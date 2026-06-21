import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { API_URL, getToken } from "./api";

export interface LiveState {
  index: number;
  scrollTop: number;
  scrollPct: number;
  playing: boolean;
  speed: number;
  scrollerId: string | null;
}
export interface LiveViewer {
  id: string;
  name: string;
  email: string;
  socketId: string;
}

interface UseLiveSyncOptions {
  eventId: string;
  enabled?: boolean;
}

/**
 * Socket.IO bridge for the Stage Mode page.
 * - All viewers receive `state` updates broadcast by whoever is the Scroller.
 * - Non-scrollers' fullscreen scroll position follows the Scroller via scrollPct.
 * - `viewers`/`count` give live presence.
 *
 * If VITE_API_URL is not set, returns a no-op shape so the page still renders with mock data.
 */
export function useLiveSync({ eventId, enabled = true }: UseLiveSyncOptions) {
  const [connected, setConnected] = useState(false);
  const [state, setState] = useState<LiveState>({
    index: 0,
    scrollTop: 0,
    scrollPct: 0,
    playing: false,
    speed: 1,
    scrollerId: null,
  });
  const [viewers, setViewers] = useState<LiveViewer[]>([]);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!enabled || !API_URL || !eventId) return;
    const token = getToken();
    if (!token) return;

    const s = io(API_URL, { auth: { token }, transports: ["websocket", "polling"] });
    socketRef.current = s;

    s.on("connect", () => {
      setConnected(true);
      s.emit("live:join", { eventId });
    });
    s.on("disconnect", () => setConnected(false));
    s.on("live:state", (st: LiveState) => setState((prev) => ({ ...prev, ...st })));
    s.on("live:viewers", ({ users }: { count: number; users: LiveViewer[] }) => setViewers(users));

    return () => {
      s.emit("live:leave");
      s.disconnect();
      socketRef.current = null;
    };
  }, [eventId, enabled]);

  const emit = useCallback((event: string, payload?: unknown) => {
    socketRef.current?.emit(event, payload);
  }, []);

  return {
    connected,
    state,
    viewers,
    viewerCount: viewers.length,
    takeScroller: useCallback(() => emit("live:take-scroller"), [emit]),
    setIndex: useCallback((index: number) => emit("live:index", { index }), [emit]),
    sendScroll: useCallback(
      (scrollTop: number, scrollPct: number) => emit("live:scroll", { scrollTop, scrollPct }),
      [emit],
    ),
    setPlayback: useCallback(
      (playing: boolean, speed: number) => emit("live:playback", { playing, speed }),
      [emit],
    ),
  };
}
