import { Router } from "express";
import mongoose from "mongoose";
import Event from "../models/Event.js";
import Group from "../models/Group.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

function eventFilter(id) {
  return mongoose.Types.ObjectId.isValid(id)
    ? { $or: [{ _id: id }, { eventId: id }] }
    : { eventId: id };
}

async function loadEvent(req, res, next) {
  try {
    const ev = await Event.findOne(eventFilter(req.params.id));
    if (!ev) return res.status(404).json({ error: "Event not found" });
    const group = await Group.findById(ev.groupId);
    if (!group) return res.status(404).json({ error: "Group missing" });
    const uid = req.user.sub;
    const isMember = group.ownerId.toString() === uid || group.members.some(m => m.userId.toString() === uid);
    if (!isMember) return res.status(403).json({ error: "Forbidden" });
    req.event = ev; req.group = group;
    next();
  } catch (e) { next(e); }
}

router.get("/", async (req, res, next) => {
  try {
    const { groupId } = req.query;
    if (!groupId) return res.status(400).json({ error: "groupId required" });
    const events = await Event.find({ groupId }).sort({ date: 1 });
    res.json({ events });
  } catch (e) { next(e); }
});

router.post("/", async (req, res, next) => {
  try {
    const { groupId, name, description, image, date, duration } = req.body || {};
    if (!groupId || !name) return res.status(400).json({ error: "groupId and name required" });
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: "Group not found" });
    const uid = req.user.sub;
    const ok = group.ownerId.toString() === uid || group.members.some(m => m.userId.toString() === uid);
    if (!ok) return res.status(403).json({ error: "Forbidden" });
    const ev = await Event.create({ groupId, name, description, image, date, duration, playlists: [] });
    res.status(201).json({ event: ev });
  } catch (e) { next(e); }
});

router.get("/:id", loadEvent, (req, res) => res.json({ event: req.event }));

router.patch("/:id", loadEvent, async (req, res, next) => {
  try {
    const fields = ["name", "description", "image", "date", "duration"];
    for (const f of fields) if (req.body[f] !== undefined) req.event[f] = req.body[f];
    await req.event.save();
    res.json({ event: req.event });
  } catch (e) { next(e); }
});

router.delete("/:id", loadEvent, async (req, res, next) => {
  try { await req.event.deleteOne(); res.json({ ok: true }); } catch (e) { next(e); }
});

router.post("/:id/playlists", loadEvent, async (req, res, next) => {
  try {
    const { name, description } = req.body || {};
    if (!name) return res.status(400).json({ error: "name required" });
    req.event.playlists.push({ name, description, items: [] });
    await req.event.save();
    res.status(201).json({ event: req.event });
  } catch (e) { next(e); }
});

router.patch("/:id/playlists/:plId", loadEvent, async (req, res, next) => {
  try {
    const pl = req.event.playlists.id(req.params.plId);
    if (!pl) return res.status(404).json({ error: "Playlist not found" });
    if (req.body.name !== undefined) pl.name = req.body.name;
    if (req.body.description !== undefined) pl.description = req.body.description;
    await req.event.save();
    res.json({ event: req.event });
  } catch (e) { next(e); }
});

router.delete("/:id/playlists/:plId", loadEvent, async (req, res, next) => {
  try {
    const pl = req.event.playlists.id(req.params.plId);
    if (!pl) return res.status(404).json({ error: "Playlist not found" });
    pl.deleteOne();
    await req.event.save();
    res.json({ event: req.event });
  } catch (e) { next(e); }
});

router.post("/:id/playlists/:plId/items", loadEvent, async (req, res, next) => {
  try {
    const pl = req.event.playlists.id(req.params.plId);
    if (!pl) return res.status(404).json({ error: "Playlist not found" });
    const { songId, partName } = req.body || {};
    if (!songId) return res.status(400).json({ error: "songId required" });
    pl.items.push({ songId, partName, order: pl.items.length });
    await req.event.save();
    res.status(201).json({ event: req.event });
  } catch (e) { next(e); }
});

router.delete("/:id/playlists/:plId/items/:itemId", loadEvent, async (req, res, next) => {
  try {
    const pl = req.event.playlists.id(req.params.plId);
    if (!pl) return res.status(404).json({ error: "Playlist not found" });
    const it = pl.items.id(req.params.itemId);
    if (!it) return res.status(404).json({ error: "Item not found" });
    it.deleteOne();
    await req.event.save();
    res.json({ event: req.event });
  } catch (e) { next(e); }
});

router.post("/:id/playlists/:plId/reorder", loadEvent, async (req, res, next) => {
  try {
    const pl = req.event.playlists.id(req.params.plId);
    if (!pl) return res.status(404).json({ error: "Playlist not found" });
    const { from, to } = req.body || {};
    if (typeof from !== "number" || typeof to !== "number") return res.status(400).json({ error: "from/to numbers required" });
    const items = pl.items.toObject();
    if (from < 0 || to < 0 || from >= items.length || to >= items.length) return res.status(400).json({ error: "Invalid item index" });
    const [moved] = items.splice(from, 1);
    items.splice(to, 0, moved);
    pl.items = items.map((it, i) => ({ ...it, order: i }));
    await req.event.save();
    res.json({ event: req.event });
  } catch (e) { next(e); }
});

export default router;
