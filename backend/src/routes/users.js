import bcrypt from "bcryptjs";
import { Router } from "express";
import User from "../models/User.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { buildCacheKey, invalidateTags, remember } from "../lib/cache.js";

const router = Router();
const USER_CACHE_TTL_MS = 60 * 1000;

function normalizeUsername(value = "") {
  const cleaned = String(value).trim().toLowerCase().replace(/^@+/, "");
  return cleaned.replace(/[^a-z0-9._-]/g, "");
}

function normalizeHandle(value = "") {
  const username = normalizeUsername(value);
  return username ? `@${username}` : "";
}

function buildAvatarSeed(seed) {
  return `https://i.pravatar.cc/200?u=${encodeURIComponent(seed)}`;
}

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

router.post("/admin/create", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { name, email, username, password } = req.body || {};
    const normalizedEmail = String(email || "")
      .trim()
      .toLowerCase();
    const normalizedUsername = normalizeUsername(username || normalizedEmail.split("@")[0]);

    if (!String(name || "").trim()) {
      return res.status(400).json({ error: "name required" });
    }
    if (!normalizedEmail) {
      return res.status(400).json({ error: "email required" });
    }
    if (!normalizedUsername || normalizedUsername.length < 3) {
      return res.status(400).json({ error: "username must be at least 3 characters" });
    }

    const existing = await User.findOne({
      $or: [{ email: normalizedEmail }, { usernameLower: normalizedUsername }],
    }).select("+passwordHash");

    if (existing) {
      existing.name = String(name).trim();
      existing.email = normalizedEmail;
      existing.handle = normalizeHandle(normalizedUsername);
      existing.usernameLower = normalizedUsername;
      existing.avatar = existing.avatar || buildAvatarSeed(normalizedEmail);
      existing.authProvider = existing.googleId ? "google" : "local";
      existing.isAdmin = true;

      if (String(password || "").trim()) {
        if (String(password).length < 6) {
          return res.status(400).json({ error: "password must be at least 6 characters" });
        }
        existing.passwordHash = await bcrypt.hash(String(password), 10);
      }

      await existing.save();
      invalidateTags(["users", `user:${existing._id.toString()}`]);
      return res.json({
        user: existing.toJSON(),
        created: false,
        promoted: true,
      });
    }

    if (!String(password || "").trim() || String(password).length < 6) {
      return res.status(400).json({ error: "password must be at least 6 characters" });
    }

    const passwordHash = await bcrypt.hash(String(password), 10);
    const user = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      handle: normalizeHandle(normalizedUsername),
      usernameLower: normalizedUsername,
      avatar: buildAvatarSeed(normalizedEmail),
      passwordHash,
      authProvider: "local",
      isAdmin: true,
    });

    invalidateTags(["users", `user:${user._id.toString()}`]);
    res.status(201).json({
      user: user.toJSON(),
      created: true,
      promoted: false,
    });
  } catch (e) {
    next(e);
  }
});

export default router;
