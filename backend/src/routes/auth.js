import bcrypt from "bcryptjs";
import { Router } from "express";
import { OAuth2Client } from "google-auth-library";
import User from "../models/User.js";
import { requireAuth, signToken } from "../middleware/auth.js";

const router = Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const adminEmails = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

function normalizeUsername(value = "") {
  const cleaned = String(value).trim().toLowerCase().replace(/^@+/, "");
  return cleaned.replace(/[^a-z0-9._-]/g, "");
}

function normalizeHandle(value = "") {
  const username = normalizeUsername(value);
  return username ? `@${username}` : "";
}

function buildGuestAvatar(seed) {
  return `https://i.pravatar.cc/200?u=${encodeURIComponent(seed)}`;
}

function publicUser(user) {
  if (!user) return null;
  return typeof user.toJSON === "function" ? user.toJSON() : user;
}

router.post("/register", async (req, res, next) => {
  try {
    const { name, username, password, email } = req.body || {};
    const normalizedUsername = normalizeUsername(username);
    const normalizedEmail = email ? String(email).trim().toLowerCase() : undefined;

    if (!String(name || "").trim()) {
      return res.status(400).json({ error: "name required" });
    }
    if (!normalizedUsername || normalizedUsername.length < 3) {
      return res.status(400).json({ error: "username must be at least 3 characters" });
    }
    if (!String(password || "").trim() || String(password).length < 6) {
      return res.status(400).json({ error: "password must be at least 6 characters" });
    }

    const existing = await User.findOne({
      $or: [
        { usernameLower: normalizedUsername },
        ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
      ],
    }).lean();

    if (existing?.usernameLower === normalizedUsername) {
      return res.status(409).json({ error: "username already in use" });
    }
    if (normalizedEmail && existing?.email === normalizedEmail) {
      return res.status(409).json({ error: "email already in use" });
    }

    const passwordHash = await bcrypt.hash(String(password), 10);
    const user = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      handle: normalizeHandle(normalizedUsername),
      usernameLower: normalizedUsername,
      avatar: buildGuestAvatar(normalizedEmail || normalizedUsername),
      passwordHash,
      authProvider: "local",
    });

    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (e) {
    next(e);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { identifier, password } = req.body || {};
    const normalizedIdentifier = String(identifier || "").trim();
    if (!normalizedIdentifier || !String(password || "").trim()) {
      return res.status(400).json({ error: "identifier and password required" });
    }

    const normalizedUsername = normalizeUsername(normalizedIdentifier);
    const normalizedEmail = normalizedIdentifier.toLowerCase();

    const user = await User.findOne({
      $or: [{ usernameLower: normalizedUsername }, { email: normalizedEmail }],
    }).select("+passwordHash");

    if (!user?.passwordHash) {
      return res.status(401).json({ error: "invalid username or password" });
    }

    const ok = await bcrypt.compare(String(password), user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: "invalid username or password" });
    }

    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (e) {
    next(e);
  }
});

router.post("/forgot-password", async (req, res, next) => {
  try {
    const { identifier, newPassword } = req.body || {};
    const normalizedIdentifier = String(identifier || "").trim();
    if (!normalizedIdentifier) {
      return res.status(400).json({ error: "identifier required" });
    }
    if (!String(newPassword || "").trim() || String(newPassword).length < 6) {
      return res.status(400).json({ error: "new password must be at least 6 characters" });
    }

    const normalizedUsername = normalizeUsername(normalizedIdentifier);
    const normalizedEmail = normalizedIdentifier.toLowerCase();
    const user = await User.findOne({
      $or: [{ usernameLower: normalizedUsername }, { email: normalizedEmail }],
    }).select("+passwordHash");

    if (!user) {
      return res.status(404).json({ error: "account not found" });
    }
    if (user.authProvider === "google" && !user.passwordHash) {
      return res.status(400).json({ error: "This account uses Google sign-in" });
    }

    user.passwordHash = await bcrypt.hash(String(newPassword), 10);
    user.authProvider = "local";
    await user.save();

    res.json({ ok: true, message: "password updated" });
  } catch (e) {
    next(e);
  }
});

router.post("/google", async (req, res, next) => {
  try {
    const { credential } = req.body || {};
    if (!credential) return res.status(400).json({ error: "credential required" });
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const p = ticket.getPayload();
    if (!p?.email) return res.status(401).json({ error: "Invalid Google token" });

    const email = p.email.toLowerCase();
    const isAdmin = adminEmails.includes(email);
    const username = normalizeUsername(p.email.split("@")[0]);

    const user = await User.findOneAndUpdate(
      { googleId: p.sub },
      {
        $set: {
          googleId: p.sub,
          email,
          name: p.name || p.email,
          avatar: p.picture,
          authProvider: "google",
          isAdmin,
        },
        $setOnInsert: {
          handle: normalizeHandle(username),
          usernameLower: username,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (e) {
    next(e);
  }
});

router.post("/guest", async (_req, res, next) => {
  try {
    const email = `guest+${Date.now()}@chordsync.live`;
    const username = normalizeUsername(`guest${Date.now()}`);
    const user = await User.create({
      email,
      name: "Guest Performer",
      handle: normalizeHandle(username),
      usernameLower: username,
      avatar: buildGuestAvatar(email),
      authProvider: "guest",
    });
    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (e) {
    next(e);
  }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.sub);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user: publicUser(user) });
  } catch (e) {
    next(e);
  }
});

export default router;
