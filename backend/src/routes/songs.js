import mongoose from "mongoose";
import { Router } from "express";
import Song from "../models/Song.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

const router = Router();
const SONG_DETAIL_FIELDS =
  "songId title slug artistName artistSlug key timeSignature source views chordsUsed sectionCount description cover tempo vibe genre year language difficulty capo tags lineCount sectionFlow rawText lines sections";

router.get("/", async (req, res, next) => {
  try {
    const { q, artistSlug, artistName, key, timeSignature, source, year, genre } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(500, parseInt(req.query.limit) || 24);
    const filter = {};
    if (artistSlug) filter.artistSlug = artistSlug;
    if (artistName) filter.artistName = artistName;
    if (key) filter.key = key;
    if (timeSignature) filter.timeSignature = timeSignature;
    if (source) filter.source = source;
    if (genre) filter.genre = genre;
    if (year) filter.year = Number(year);
    if (q) filter.$or = [{ title: new RegExp(q, "i") }, { artistName: new RegExp(q, "i") }];
    const [songs, total] = await Promise.all([
      Song.find(filter)
        .select(SONG_DETAIL_FIELDS)
        .sort({ title: 1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Song.countDocuments(filter),
    ]);
    res.json({ songs, total, page, limit });
  } catch (e) {
    next(e);
  }
});

router.get("/batch", async (req, res, next) => {
  try {
    const rawIds = Array.isArray(req.query.ids)
      ? req.query.ids
      : String(req.query.ids || "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean);

    if (!rawIds.length) return res.json({ songs: [] });

    const objectIds = rawIds.filter((value) => mongoose.Types.ObjectId.isValid(value));
    const songs = await Song.find({
      $or: [{ songId: { $in: rawIds } }, ...(objectIds.length ? [{ _id: { $in: objectIds } }] : [])],
    }).select(SONG_DETAIL_FIELDS);

    const orderMap = new Map(rawIds.map((id, index) => [String(id), index]));
    songs.sort((left, right) => {
      const leftOrder = orderMap.get(String(left.songId)) ?? orderMap.get(String(left._id)) ?? 0;
      const rightOrder =
        orderMap.get(String(right.songId)) ?? orderMap.get(String(right._id)) ?? 0;
      return leftOrder - rightOrder;
    });

    res.json({ songs });
  } catch (e) {
    next(e);
  }
});

router.get("/:songId", async (req, res, next) => {
  try {
    const songId = req.params.songId;
    const filter = mongoose.Types.ObjectId.isValid(songId)
      ? { $or: [{ songId }, { _id: songId }] }
      : { songId };
    const song = await Song.findOne(filter).select(SONG_DETAIL_FIELDS);
    if (!song) return res.status(404).json({ error: "Song not found" });
    res.json({ song });
  } catch (e) {
    next(e);
  }
});

router.post("/", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { title, artistName, artistSlug, songId, sections, lines, ...rest } = req.body || {};
    if (!title || !artistName)
      return res.status(400).json({ error: "title and artistName required" });
    const nextSong = await Song.create({
      title,
      artistName,
      artistSlug:
        artistSlug ||
        String(artistName)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-"),
      songId:
        songId ||
        `${String(title)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}`,
      sections: sections || [],
      lines: lines || [],
      ...rest,
    });
    res.status(201).json({ song: nextSong });
  } catch (e) {
    next(e);
  }
});

router.patch("/:songId", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const song = await Song.findOne({ songId: req.params.songId });
    if (!song) return res.status(404).json({ error: "Song not found" });
    Object.assign(song, req.body || {});
    await song.save();
    res.json({ song });
  } catch (e) {
    next(e);
  }
});

router.delete("/:songId", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const song = await Song.findOne({ songId: req.params.songId });
    if (!song) return res.status(404).json({ error: "Song not found" });
    await song.deleteOne();
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
