import { Router } from "express";
import User from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";
import { buildCacheKey, invalidateTags, remember } from "../lib/cache.js";

const router = Router();
const USER_CACHE_TTL_MS = 60 * 1000;

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const q = (req.query.q || "").toString().trim();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const cacheKey = buildCacheKey("users:list", { q, page, limit });

    const response = await remember(cacheKey, USER_CACHE_TTL_MS, ["users"], async () => {
      const filter = q
        ? {
            $or: [
              { name: new RegExp(q, "i") },
              { email: new RegExp(q, "i") },
              { handle: new RegExp(q, "i") },
            ],
          }
        : {};
      const [users, total] = await Promise.all([
        User.find(filter)
          .limit(limit)
          .skip((page - 1) * limit)
          .sort({ name: 1 })
          .lean(),
        User.countDocuments(filter),
      ]);
      return {
        users,
        total,
        page,
        limit,
        pages: Math.max(1, Math.ceil(total / limit)),
      };
    });

    res.json(response);
  } catch (e) {
    next(e);
  }
});

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const cacheKey = buildCacheKey("users:detail", req.params.id);
    const response = await remember(
      cacheKey,
      USER_CACHE_TTL_MS,
      ["users", `user:${req.params.id}`],
      async () => {
        const user = await User.findById(req.params.id).lean();
        if (!user) {
          const err = new Error("Not found");
          err.status = 404;
          throw err;
        }
        return { user };
      },
    );
    res.json(response);
  } catch (e) {
    next(e);
  }
});

router.patch("/:id", requireAuth, async (req, res, next) => {
  try {
    if (req.user.sub !== req.params.id && !req.user.isAdmin) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const { name, handle, avatar, bio } = req.body || {};
    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          ...(name && { name }),
          ...(handle && { handle }),
          ...(avatar && { avatar }),
          ...(bio !== undefined && { bio }),
        },
      },
      { new: true },
    );
    invalidateTags(["users", `user:${req.params.id}`]);
    res.json({ user });
  } catch (e) {
    next(e);
  }
});

export default router;
