import mongoose from "mongoose";
import { Router } from "express";
import Song from "../models/Song.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { buildCacheKey, invalidateTags, remember } from "../lib/cache.js";

const router = Router();

const SONG_SUMMARY_FIELDS =
  "songId title slug artistName artistSlug key timeSignature source views chordsUsed sectionCount description cover tempo vibe genre year language difficulty capo tags lineCount sectionFlow";
const SONG_DETAIL_FIELDS = `${SONG_SUMMARY_FIELDS} rawText lines sections`;
const SONG_CACHE_TTL_MS = 60 * 1000;
const SONG_DETAIL_CACHE_TTL_MS = 5 * 60 * 1000;

function buildSongFilter(query) {
  const { q, artistSlug, artistName, key, timeSignature, source, year, genre } = query;
  const filter = {};
  if (artistSlug) filter.artistSlug = artistSlug;
  if (artistName) filter.artistName = artistName;
  if (key) filter.key = key;
  if (timeSignature) filter.timeSignature = timeSignature;
  if (source) filter.source = source;
  if (genre) filter.genre = genre;
  if (year) filter.year = Number(year);
  if (q) {
    filter.$or = [{ title: new RegExp(q, "i") }, { artistName: new RegExp(q, "i") }];
  }
  return filter;
}

function parseSort(sort) {
  switch (sort) {
    case "artist":
      return { artistName: 1, title: 1 };
    case "key":
      return { key: 1, title: 1 };
    case "recent":
      return { createdAt: -1, title: 1 };
    default:
      return { title: 1 };
  }
}

router.get("/", async (req, res, next) => {
  try {
    const q = (req.query.q || "").toString().trim();
    const artistSlug = (req.query.artistSlug || "").toString().trim();
    const artistName = (req.query.artistName || "").toString().trim();
    const key = (req.query.key || "").toString().trim();
    const timeSignature = (req.query.timeSignature || "").toString().trim();
    const source = (req.query.source || "").toString().trim();
    const genre = (req.query.genre || "").toString().trim();
    const year = (req.query.year || "").toString().trim();
    const sort = (req.query.sort || "title").toString().trim();
    const content = (req.query.content || "summary").toString().trim();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 24));

    const cacheKey = buildCacheKey("songs:list", {
      q,
      artistSlug,
      artistName,
      key,
      timeSignature,
      source,
      genre,
      year,
      sort,
      content,
      page,
      limit,
    });

    const response = await remember(cacheKey, SONG_CACHE_TTL_MS, ["songs"], async () => {
      const filter = buildSongFilter({
        q,
        artistSlug,
        artistName,
        key,
        timeSignature,
        source,
        genre,
        year,
      });

      const [songs, total] = await Promise.all([
        Song.find(filter)
          .select(content === "full" ? SONG_DETAIL_FIELDS : SONG_SUMMARY_FIELDS)
          .sort(parseSort(sort))
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        Song.countDocuments(filter),
      ]);

      return {
        songs,
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

router.get("/batch", async (req, res, next) => {
  try {
    const rawIds = Array.isArray(req.query.ids)
      ? req.query.ids
      : String(req.query.ids || "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean);

    if (!rawIds.length) return res.json({ songs: [] });

    const cacheKey = buildCacheKey("songs:batch", rawIds);
    const response = await remember(cacheKey, SONG_DETAIL_CACHE_TTL_MS, ["songs"], async () => {
      const objectIds = rawIds.filter((value) => mongoose.Types.ObjectId.isValid(value));
      const songs = await Song.find({
        $or: [
          { songId: { $in: rawIds } },
          ...(objectIds.length ? [{ _id: { $in: objectIds } }] : []),
        ],
      })
        .select(SONG_DETAIL_FIELDS)
        .lean();

      const orderMap = new Map(rawIds.map((id, index) => [String(id), index]));
      songs.sort((left, right) => {
        const leftOrder = orderMap.get(String(left.songId)) ?? orderMap.get(String(left._id)) ?? 0;
        const rightOrder =
          orderMap.get(String(right.songId)) ?? orderMap.get(String(right._id)) ?? 0;
        return leftOrder - rightOrder;
      });

      return { songs };
    });

    res.json(response);
  } catch (e) {
    next(e);
  }
});

router.get("/:songId", async (req, res, next) => {
  try {
    const songId = req.params.songId;
    const cacheKey = buildCacheKey("songs:detail", songId);
    const response = await remember(
      cacheKey,
      SONG_DETAIL_CACHE_TTL_MS,
      ["songs", `song:${songId}`],
      async () => {
        const filter = mongoose.Types.ObjectId.isValid(songId)
          ? { $or: [{ songId }, { _id: songId }] }
          : { songId };
        const song = await Song.findOne(filter).select(SONG_DETAIL_FIELDS).lean();
        if (!song) {
          const err = new Error("Song not found");
          err.status = 404;
          throw err;
        }
        return { song };
      },
    );
    res.json(response);
  } catch (e) {
    next(e);
  }
});

router.post("/", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { title, artistName, artistSlug, songId, sections, lines, ...rest } = req.body || {};
    if (!title || !artistName) {
      return res.status(400).json({ error: "title and artistName required" });
    }
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
    invalidateTags(["songs", "artists"]);
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
    invalidateTags(["songs", "artists", `song:${req.params.songId}`]);
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
    invalidateTags(["songs", "artists", `song:${req.params.songId}`]);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
