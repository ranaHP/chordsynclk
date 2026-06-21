import { Router } from "express";
import User from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const q = (req.query.q || "").toString().trim();
    const filter = q ? { $or: [{ name: new RegExp(q, "i") }, { email: new RegExp(q, "i") }] } : {};
    const users = await User.find(filter).limit(100).sort({ name: 1 });
    res.json({ users });
  } catch (e) { next(e); }
});

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "Not found" });
    res.json({ user });
  } catch (e) { next(e); }
});

router.patch("/:id", requireAuth, async (req, res, next) => {
  try {
    if (req.user.sub !== req.params.id && !req.user.isAdmin)
      return res.status(403).json({ error: "Forbidden" });
    const { name, handle, avatar, bio } = req.body || {};
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { ...(name && { name }), ...(handle && { handle }), ...(avatar && { avatar }), ...(bio !== undefined && { bio }) } },
      { new: true }
    );
    res.json({ user });
  } catch (e) { next(e); }
});

export default router;
