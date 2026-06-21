import jwt from "jsonwebtoken";

/**
 * In-memory live state per event room.
 * { [eventId]: { index, scrollTop, scrollPct, playing, speed, scrollerId, viewers: Map<socketId, user> } }
 */
const rooms = new Map();

function ensureRoom(eventId) {
  let r = rooms.get(eventId);
  if (!r) {
    r = { index: 0, scrollTop: 0, scrollPct: 0, playing: false, speed: 1, scrollerId: null, viewers: new Map() };
    rooms.set(eventId, r);
  }
  return r;
}

export function getLiveState(eventId) {
  const r = rooms.get(eventId);
  if (!r) return null;
  return {
    index: r.index, scrollTop: r.scrollTop, scrollPct: r.scrollPct,
    playing: r.playing, speed: r.speed, scrollerId: r.scrollerId,
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
    index: r.index, scrollTop: r.scrollTop, scrollPct: r.scrollPct,
    playing: r.playing, speed: r.speed, scrollerId: r.scrollerId,
  };
}

export function attachSocket(io) {
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

    socket.on("live:join", ({ eventId }) => {
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
      // Auto-assign first viewer as scroller
      if (!r.scrollerId) r.scrollerId = socket.user.sub;
      socket.emit("live:state", snapshot(r));
      socket.to(`event:${eventId}`).emit("live:state", snapshot(r));
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
      io.to(`event:${currentEvent}`).emit("live:state", snapshot(r));
    });

    const onlyScroller = (fn) => (payload) => {
      if (!currentEvent) return;
      const r = ensureRoom(currentEvent);
      if (r.scrollerId !== socket.user.sub) return;
      fn(r, payload);
      socket.to(`event:${currentEvent}`).emit("live:state", snapshot(r));
    };

    socket.on("live:index", onlyScroller((r, { index }) => {
      r.index = index; r.scrollTop = 0; r.scrollPct = 0;
      r.playing = false;
    }));

    socket.on("live:scroll", onlyScroller((r, { scrollTop = 0, scrollPct = 0 }) => {
      r.scrollTop = scrollTop; r.scrollPct = scrollPct;
    }));

    socket.on("live:playback", onlyScroller((r, { playing, speed }) => {
      if (typeof playing === "boolean") r.playing = playing;
      if (typeof speed === "number") r.speed = speed;
    }));

    function leave() {
      if (!currentEvent) return;
      const r = rooms.get(currentEvent);
      if (r) {
        r.viewers.delete(socket.id);
        // Reassign scroller if they left
        if (r.scrollerId === socket.user.sub) {
          const next = [...r.viewers.values()][0];
          r.scrollerId = next ? next.id : null;
          io.to(`event:${currentEvent}`).emit("live:state", snapshot(r));
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
