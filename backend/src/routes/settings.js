import { Router } from "express";
import Setting from "../models/Setting.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

const router = Router();
const GLOBAL_SETTINGS_KEY = "global";

const DEFAULT_SETTINGS = {
  key: GLOBAL_SETTINGS_KEY,
  siteFontScalePercent: 100,
  songReaderFontPercent: 73,
  stageReaderFontPercent: 100,
  adminTerminalTitle: "ChordSync Admin Terminal",
  recommendationTrackingEnabled: true,
};

async function getSettings() {
  const settings = await Setting.findOneAndUpdate(
    { key: GLOBAL_SETTINGS_KEY },
    { $setOnInsert: DEFAULT_SETTINGS },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
  return settings;
}

router.get("/public", async (_req, res, next) => {
  try {
    const settings = await getSettings();
    res.json({ settings });
  } catch (e) {
    next(e);
  }
});

router.get("/admin", requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const settings = await getSettings();
    res.json({ settings });
  } catch (e) {
    next(e);
  }
});

router.patch("/admin", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const patch = req.body || {};
    const allowedFields = [
      "siteFontScalePercent",
      "songReaderFontPercent",
      "stageReaderFontPercent",
      "adminTerminalTitle",
      "recommendationTrackingEnabled",
    ];

    const nextPatch = {};
    allowedFields.forEach((field) => {
      if (patch[field] !== undefined) nextPatch[field] = patch[field];
    });

    if (typeof nextPatch.siteFontScalePercent === "number") {
      nextPatch.siteFontScalePercent = Math.max(60, Math.min(200, nextPatch.siteFontScalePercent));
    }
    if (typeof nextPatch.songReaderFontPercent === "number") {
      nextPatch.songReaderFontPercent = Math.max(
        40,
        Math.min(220, nextPatch.songReaderFontPercent),
      );
    }
    if (typeof nextPatch.stageReaderFontPercent === "number") {
      nextPatch.stageReaderFontPercent = Math.max(
        40,
        Math.min(220, nextPatch.stageReaderFontPercent),
      );
    }

    const settings = await Setting.findOneAndUpdate(
      { key: GLOBAL_SETTINGS_KEY },
      { $set: nextPatch, $setOnInsert: DEFAULT_SETTINGS },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();

    res.json({ settings });
  } catch (e) {
    next(e);
  }
});

export default router;
