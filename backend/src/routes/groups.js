import { Router } from "express";
import Group from "../models/Group.js";
import Event from "../models/Event.js";
import User from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

async function loadGroup(req, res, next) {
  const g = await Group.findById(req.params.id);
  if (!g) return res.status(404).json({ error: "Group not found" });
  req.group = g;
  next();
}
function isOwner(req) { return req.group.ownerId.toString() === req.user.sub; }
function isMember(req) {
  return isOwner(req) || req.group.members.some(m => m.userId.toString() === req.user.sub);
}

router.get("/", async (req, res, next) => {
  try {
    const uid = req.user.sub;
    const groups = await Group.find({
      $or: [{ ownerId: uid }, { "members.userId": uid }],
    }).sort({ updatedAt: -1 });
    res.json({ groups });
  } catch (e) { next(e); }
});

router.post("/", async (req, res, next) => {
  try {
    const { name, description, image } = req.body || {};
    if (!name) return res.status(400).json({ error: "name required" });
    const group = await Group.create({
      name, description, image,
      ownerId: req.user.sub,
      members: [{ userId: req.user.sub, role: "Owner" }],
    });
    res.status(201).json({ group });
  } catch (e) { next(e); }
});

router.get("/:id", loadGroup, async (req, res, next) => {
  try {
    if (!isMember(req)) return res.status(403).json({ error: "Forbidden" });
    const memberIds = req.group.members.map(m => m.userId);
    const [users, events] = await Promise.all([
      User.find({ _id: { $in: memberIds } }),
      Event.find({ groupId: req.group._id }).sort({ date: 1 }),
    ]);
    res.json({ group: req.group, users, events });
  } catch (e) { next(e); }
});

router.patch("/:id", loadGroup, async (req, res, next) => {
  try {
    if (!isOwner(req)) return res.status(403).json({ error: "Owner only" });
    const { name, description, image } = req.body || {};
    Object.assign(req.group, { ...(name && { name }), ...(description !== undefined && { description }), ...(image !== undefined && { image }) });
    await req.group.save();
    res.json({ group: req.group });
  } catch (e) { next(e); }
});

router.delete("/:id", loadGroup, async (req, res, next) => {
  try {
    if (!isOwner(req)) return res.status(403).json({ error: "Owner only" });
    await req.group.deleteOne();
    await Event.deleteMany({ groupId: req.group._id });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post("/:id/members", loadGroup, async (req, res, next) => {
  try {
    if (!isMember(req)) return res.status(403).json({ error: "Forbidden" });
    const { userId, role = "Member" } = req.body || {};
    if (!userId) return res.status(400).json({ error: "userId required" });
    if (req.group.members.some(m => m.userId.toString() === userId))
      return res.status(409).json({ error: "Already a member" });
    req.group.members.push({ userId, role });
    await req.group.save();
    res.json({ group: req.group });
  } catch (e) { next(e); }
});

router.patch("/:id/members/:userId", loadGroup, async (req, res, next) => {
  try {
    if (!isOwner(req) && req.user.sub !== req.params.userId)
      return res.status(403).json({ error: "Forbidden" });
    const m = req.group.members.find(m => m.userId.toString() === req.params.userId);
    if (!m) return res.status(404).json({ error: "Member not found" });
    if (req.body?.role) m.role = req.body.role;
    await req.group.save();
    res.json({ group: req.group });
  } catch (e) { next(e); }
});

router.delete("/:id/members/:userId", loadGroup, async (req, res, next) => {
  try {
    if (!isOwner(req) && req.user.sub !== req.params.userId)
      return res.status(403).json({ error: "Forbidden" });
    req.group.members = req.group.members.filter(m => m.userId.toString() !== req.params.userId);
    await req.group.save();
    res.json({ group: req.group });
  } catch (e) { next(e); }
});

// Join by invite code
router.post("/join/:inviteCode", async (req, res, next) => {
  try {
    const g = await Group.findOne({ inviteCode: req.params.inviteCode });
    if (!g) return res.status(404).json({ error: "Invalid invite" });
    if (!g.members.some(m => m.userId.toString() === req.user.sub)) {
      g.members.push({ userId: req.user.sub, role: "Member" });
      await g.save();
    }
    res.json({ group: g });
  } catch (e) { next(e); }
});

export default router;
