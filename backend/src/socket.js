import jwt from "jsonwebtoken";

/**
 * In-memory live state per event room.
 * { [eventId]: { index, scrollTop, scrollPct, progressSpeed, playing, speed, transpose, scrollerId, pendingScrollerRequest, autoApproveScrollerRequestsRemaining, viewers: Map<socketId, user> } }
 */
const rooms = new Map();
let ioRef = null;
const AUTO_APPROVE_SCROLLER_REQUESTS = 3;

function markUpdated(room) {
  room.updatedAt = Date.now();
}

function ensureRoom(eventId) {
  let r = rooms.get(eventId);
  if (!r) {
    r = {
      index: 0,
      itemId: null,
      scrollTop: 0,
      scrollPct: 0,
      progressSpeed: 0,
      playing: false,
      speed: 1,
      transpose: 0,
      scrollerId: null,
      pendingScrollerRequest: null,
      autoApproveScrollerRequestsRemaining: AUTO_APPROVE_SCROLLER_REQUESTS,
      viewers: new Map(),
      updatedAt: Date.now(),
    };
    rooms.set(eventId, r);
  }
  return r;
}

export function getLiveState(eventId) {
  const r = rooms.get(eventId);
  if (!r) return null;
  return {
    index: r.index,
    itemId: r.itemId,
    scrollTop: r.scrollTop,
    scrollPct: r.scrollPct,
    progressSpeed: r.progressSpeed,
    playing: r.playing,
    speed: r.speed,
    transpose: r.transpose,
    scrollerId: r.scrollerId,
    viewerCount: r.viewers.size,
    viewers: [...r.viewers.values()],
  };
}

function broadcastViewers(io, eventId) {
  const r = rooms.get(eventId);
  if (!r) return;
  io.to(`event:${eventId}`).emit("live:viewers", {
    count: r.viewers.size,
    users: [...r.viewers.values()],
  });
}

function emitViewerJoined(io, eventId, user) {
  io.to(`event:${eventId}`).emit("live:viewer-joined", {
    user,
    ts: Date.now(),
  });
}

function snapshot(r) {
  return {
    index: r.index,
    itemId: r.itemId,
    scrollTop: r.scrollTop,
    scrollPct: r.scrollPct,
    progressSpeed: r.progressSpeed,
    playing: r.playing,
    speed: r.speed,
    transpose: r.transpose,
    scrollerId: r.scrollerId,
    updatedAt: r.updatedAt,
  };
}

export function emitLiveStageChanged(eventIds, payload = {}) {
  if (!ioRef) return;
  const ids = [...new Set((Array.isArray(eventIds) ? eventIds : [eventIds]).filter(Boolean))];
  ids.forEach((eventId) => {
    ioRef.to(`event:${eventId}`).emit("live:stage-changed", {
      eventId,
      ts: Date.now(),
      ...payload,
    });
  });
}

export function attachSocket(io) {
  ioRef = io;

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Unauthorized"));
    try {
      socket.user = jwt.verify(token, process.env.JWT_SECRET);
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    let currentEvent = null;

    socket.on("live:join", ({ eventId, role }) => {
      if (!eventId) return;
      if (currentEvent) leave();
      currentEvent = eventId;
      const r = ensureRoom(eventId);
      socket.join(`event:${eventId}`);
      r.viewers.set(socket.id, {
        id: socket.user.sub,
        name: socket.user.name,
        email: socket.user.email,
        socketId: socket.id,
      });
      if (!r.scrollerId && role === "Scroller") {
        r.scrollerId = socket.user.sub;
      }
      io.to(`event:${eventId}`).emit("live:state", snapshot(r));
      emitViewerJoined(io, eventId, {
        id: socket.user.sub,
        name: socket.user.name,
        email: socket.user.email,
        socketId: socket.id,
      });
      broadcastViewers(io, eventId);
    });

    socket.on("live:take-scroller", () => {
      if (!currentEvent) return;
      const r = ensureRoom(currentEvent);
      r.scrollerId = socket.user.sub;
      r.pendingScrollerRequest = null;
      markUpdated(r);
      io.to(`event:${currentEvent}`).emit("live:state", snapshot(r));
    });

    socket.on("live:request-scroller", () => {
      if (!currentEvent) return;
      const r = ensureRoom(currentEvent);
      if (!r.scrollerId || r.scrollerId === socket.user.sub) return;

      const requester = {
        id: socket.user.sub,
        name: socket.user.name,
        email: socket.user.email,
        socketId: socket.id,
      };

      if (r.autoApproveScrollerRequestsRemaining > 0) {
        r.scrollerId = requester.id;
        r.pendingScrollerRequest = null;
        r.autoApproveScrollerRequestsRemaining -= 1;
        markUpdated(r);

        io.to(`event:${currentEvent}`).emit("live:scroller-request-resolved", {
          approved: true,
          requester,
          autoApproved: true,
          ts: Date.now(),
        });
        io.to(`event:${currentEvent}`).emit("live:state", snapshot(r));
        return;
      }

      r.pendingScrollerRequest = {
        requester,
        ts: Date.now(),
      };
      markUpdated(r);

      const currentScrollerViewer = [...r.viewers.values()].find(
        (viewer) => viewer.id === r.scrollerId,
      );
      if (currentScrollerViewer) {
        io.to(currentScrollerViewer.socketId).emit(
          "live:scroller-request",
          r.pendingScrollerRequest,
        );
      }
    });

    socket.on("live:respond-scroller-request", ({ approved, requesterId }) => {
      if (!currentEvent) return;
      const r = ensureRoom(currentEvent);
      if (r.scrollerId !== socket.user.sub) return;
      if (!r.pendingScrollerRequest) return;
      if (requesterId && r.pendingScrollerRequest.requester.id !== requesterId) return;

      const pending = r.pendingScrollerRequest;
      if (approved) {
        r.scrollerId = pending.requester.id;
      }
      r.pendingScrollerRequest = null;
      markUpdated(r);

      io.to(`event:${currentEvent}`).emit("live:scroller-request-resolved", {
        approved: !!approved,
        requester: pending.requester,
        ts: Date.now(),
      });

      if (approved) {
        io.to(`event:${currentEvent}`).emit("live:state", snapshot(r));
      }
    });

    const onlyScroller = (fn) => (payload) => {
      if (!currentEvent) return;
      const r = ensureRoom(currentEvent);
      if (r.scrollerId !== socket.user.sub) return;
      fn(r, payload);
      markUpdated(r);
      io.to(`event:${currentEvent}`).emit("live:state", snapshot(r));
    };

    socket.on(
      "live:index",
      onlyScroller((r, { index, itemId = null }) => {
        r.index = index;
        r.itemId = itemId || null;
        r.scrollTop = 0;
        r.scrollPct = 0;
        r.progressSpeed = 0;
        r.playing = false;
      }),
    );

    socket.on(
      "live:scroll",
      onlyScroller((r, { scrollTop = 0, scrollPct = 0, progressSpeed = 0 }) => {
        r.scrollTop = scrollTop;
        r.scrollPct = scrollPct;
        r.progressSpeed = progressSpeed;
      }),
    );

    socket.on(
      "live:playback",
      onlyScroller((r, { playing, speed }) => {
        if (typeof playing === "boolean") r.playing = playing;
        if (typeof speed === "number") r.speed = speed;
        if (!r.playing) r.progressSpeed = 0;
      }),
    );

    socket.on(
      "live:transpose",
      onlyScroller((r, { transpose }) => {
        if (typeof transpose === "number") {
          r.transpose = Math.max(-6, Math.min(6, Math.round(transpose)));
        }
      }),
    );

    function leave() {
      if (!currentEvent) return;
      const r = rooms.get(currentEvent);
      if (r) {
        r.viewers.delete(socket.id);
        // Reassign scroller if they left
        if (r.scrollerId === socket.user.sub) {
          const next = [...r.viewers.values()][0];
          r.scrollerId = next ? next.id : null;
          r.pendingScrollerRequest = null;
          io.to(`event:${currentEvent}`).emit("live:state", snapshot(r));
        }
        if (r.pendingScrollerRequest?.requester.socketId === socket.id) {
          r.pendingScrollerRequest = null;
        }
        broadcastViewers(io, currentEvent);
        if (r.viewers.size === 0) rooms.delete(currentEvent);
      }
      socket.leave(`event:${currentEvent}`);
      currentEvent = null;
    }

    socket.on("live:leave", leave);
    socket.on("disconnect", leave);
  });
}
