import { Router } from "express";
import { OAuth2Client } from "google-auth-library";
import User from "../models/User.js";
import { signToken, requireAuth } from "../middleware/auth.js";

const router = Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const adminEmails = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

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

    const isAdmin = adminEmails.includes(p.email.toLowerCase());
    const user = await User.findOneAndUpdate(
      { googleId: p.sub },
      {
        $set: {
          googleId: p.sub,
          email: p.email,
          name: p.name || p.email,
          avatar: p.picture,
          isAdmin,
        },
        $setOnInsert: { handle: "@" + (p.email.split("@")[0]) },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({ token: signToken(user), user });
  } catch (e) { next(e); }
});

// Dev-only guest login (no Google required) — disable in prod by removing.
router.post("/guest", async (_req, res, next) => {
  try {
    const email = `guest+${Date.now()}@chordsync.live`;
    const user = await User.create({
      email, name: "Guest Performer",
      handle: "@guest", avatar: `https://i.pravatar.cc/200?u=${email}`,
    });
    res.json({ token: signToken(user), user });
  } catch (e) { next(e); }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.sub);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user });
  } catch (e) { next(e); }
});

export default router;
