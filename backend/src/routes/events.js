import { Router } from "express";
import mongoose from "mongoose";
import Event from "../models/Event.js";
import Group from "../models/Group.js";
import { requireAuth } from "../middleware/auth.js";
import { buildCacheKey, invalidateTags, remember } from "../lib/cache.js";
import { emitLiveStageChanged } from "../socket.js";

const router = Router();
const EVENT_CACHE_TTL_MS = 60 * 1000;

router.use(requireAuth);

function eventFilter(id) {
  return mongoose.Types.ObjectId.isValid(id)
    ? { $or: [{ _id: id }, { eventId: id }] }
    : { eventId: id };
}

function invalidateEventTags(event, group) {
  invalidateTags(["events", `event:${event.id}`, `group:${group.id}`]);
}

function emitStageRefresh(event, reason) {
  emitLiveStageChanged([event.id, event.eventId], { reason });
}

async function loadEvent(req, res, next) {
  try {
    const ev = await Event.findOne(eventFilter(req.params.id));
    if (!ev) return res.status(404).json({ error: "Event not found" });
    const group = await Group.findById(ev.groupId);
    if (!group) return res.status(404).json({ error: "Group missing" });
    const uid = req.user.sub;
    const isMember =
      group.ownerId.toString() === uid || group.members.some((m) => m.userId.toString() === uid);
    if (!isMember) return res.status(403).json({ error: "Forbidden" });
    req.event = ev;
    req.group = group;
    next();
  } catch (e) {
    next(e);
  }
}

router.get("/", async (req, res, next) => {
  try {
    const groupId = (req.query.groupId || "").toString().trim();
    if (!groupId) return res.status(400).json({ error: "groupId required" });
    const cacheKey = buildCacheKey("events:list", { groupId, userId: req.user.sub });
    const response = await remember(
      cacheKey,
      EVENT_CACHE_TTL_MS,
      ["events", `group:${groupId}`],
      async () => {
        const events = await Event.find({ groupId }).sort({ date: 1 }).lean();
        return { events };
      },
    );
    res.json(response);
  } catch (e) {
    next(e);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { groupId, name, description, image, date, duration } = req.body || {};
    if (!groupId || !name) {
      return res.status(400).json({ error: "groupId and name required" });
    }
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: "Group not found" });
    const uid = req.user.sub;
    const ok =
      group.ownerId.toString() === uid || group.members.some((m) => m.userId.toString() === uid);
    if (!ok) return res.status(403).json({ error: "Forbidden" });
    const event = await Event.create({
      groupId,
      name,
      description,
      image,
      date,
      duration,
      playlists: [],
    });
    invalidateTags(["events", `group:${groupId}`]);
    res.status(201).json({ event });
  } catch (e) {
    next(e);
  }
});

router.get("/:id", loadEvent, async (req, res, next) => {
  try {
    const cacheKey = buildCacheKey("events:detail", { id: req.event.id, userId: req.user.sub });
    const response = await remember(
      cacheKey,
      EVENT_CACHE_TTL_MS,
      ["events", `event:${req.event.id}`, `group:${req.group.id}`],
      async () => ({ event: req.event.toObject() }),
    );
    res.json(response);
  } catch (e) {
    next(e);
  }
});

router.patch("/:id", loadEvent, async (req, res, next) => {
  try {
    const fields = ["name", "description", "image", "date", "duration"];
    for (const field of fields) {
      if (req.body[field] !== undefined) req.event[field] = req.body[field];
    }
    await req.event.save();
    invalidateEventTags(req.event, req.group);
    emitStageRefresh(req.event, "event-updated");
    res.json({ event: req.event });
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", loadEvent, async (req, res, next) => {
  try {
    await req.event.deleteOne();
    invalidateTags(["events", `event:${req.event.id}`, `group:${req.group.id}`]);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.post("/:id/playlists", loadEvent, async (req, res, next) => {
  try {
    const { name, description } = req.body || {};
    if (!name) return res.status(400).json({ error: "name required" });
    req.event.playlists.push({ name, description, items: [] });
    await req.event.save();
    invalidateEventTags(req.event, req.group);
    emitStageRefresh(req.event, "playlist-created");
    res.status(201).json({ event: req.event });
  } catch (e) {
    next(e);
  }
});

router.patch("/:id/playlists/:plId", loadEvent, async (req, res, next) => {
  try {
    const playlist = req.event.playlists.id(req.params.plId);
    if (!playlist) return res.status(404).json({ error: "Playlist not found" });
    if (req.body.name !== undefined) playlist.name = req.body.name;
    if (req.body.description !== undefined) playlist.description = req.body.description;
    await req.event.save();
    invalidateEventTags(req.event, req.group);
    emitStageRefresh(req.event, "playlist-updated");
    res.json({ event: req.event });
  } catch (e) {
    next(e);
  }
});

router.delete("/:id/playlists/:plId", loadEvent, async (req, res, next) => {
  try {
    const playlist = req.event.playlists.id(req.params.plId);
    if (!playlist) return res.status(404).json({ error: "Playlist not found" });
    playlist.deleteOne();
    await req.event.save();
    invalidateEventTags(req.event, req.group);
    emitStageRefresh(req.event, "playlist-deleted");
    res.json({ event: req.event });
  } catch (e) {
    next(e);
  }
});

router.post("/:id/playlists/:plId/items", loadEvent, async (req, res, next) => {
  try {
    const playlist = req.event.playlists.id(req.params.plId);
    if (!playlist) return res.status(404).json({ error: "Playlist not found" });
    const { songId, partName } = req.body || {};
    if (!songId) return res.status(400).json({ error: "songId required" });
    playlist.items.push({ songId, partName, order: playlist.items.length });
    await req.event.save();
    invalidateEventTags(req.event, req.group);
    emitStageRefresh(req.event, "playlist-item-added");
    res.status(201).json({ event: req.event });
  } catch (e) {
    next(e);
  }
});

router.delete("/:id/playlists/:plId/items/:itemId", loadEvent, async (req, res, next) => {
  try {
    const playlist = req.event.playlists.id(req.params.plId);
    if (!playlist) return res.status(404).json({ error: "Playlist not found" });
    const item = playlist.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ error: "Item not found" });
    item.deleteOne();
    await req.event.save();
    invalidateEventTags(req.event, req.group);
    emitStageRefresh(req.event, "playlist-item-removed");
    res.json({ event: req.event });
  } catch (e) {
    next(e);
  }
});

router.post("/:id/playlists/:plId/reorder", loadEvent, async (req, res, next) => {
  try {
    const playlist = req.event.playlists.id(req.params.plId);
    if (!playlist) return res.status(404).json({ error: "Playlist not found" });
    const { from, to } = req.body || {};
    if (typeof from !== "number" || typeof to !== "number") {
      return res.status(400).json({ error: "from/to numbers required" });
    }
    const items = playlist.items.toObject();
    if (from < 0 || to < 0 || from >= items.length || to >= items.length) {
      return res.status(400).json({ error: "Invalid item index" });
    }
    const [moved] = items.splice(from, 1);
    items.splice(to, 0, moved);
    playlist.items = items.map((item, index) => ({ ...item, order: index }));
    await req.event.save();
    invalidateEventTags(req.event, req.group);
    emitStageRefresh(req.event, "playlist-reordered");
    res.json({ event: req.event });
  } catch (e) {
    next(e);
  }
});

export default router;
