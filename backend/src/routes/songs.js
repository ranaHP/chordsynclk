import mongoose from "mongoose";
import { Router } from "express";
import Setting from "../models/Setting.js";
import Song from "../models/Song.js";
import User from "../models/User.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { buildCacheKey, invalidateTags, remember } from "../lib/cache.js";
import {
  buildSearchClauses,
  buildSongSearchDocument,
  computeSongSearchRank,
  normalizeSearchValue,
} from "../lib/song-search.js";

const router = Router();

const SONG_SUMMARY_FIELDS =
  "songId title slug artistName artistSlug key timeSignature source views chordsUsed sectionCount description cover tempo vibe genre year language difficulty capo tags lineCount sectionFlow";
const SONG_DETAIL_FIELDS = `${SONG_SUMMARY_FIELDS} rawText lines sections`;
const SONG_CACHE_TTL_MS = 60 * 1000;
const SONG_DETAIL_CACHE_TTL_MS = 5 * 60 * 1000;
const GLOBAL_SETTINGS_KEY = "global";

function buildSongFilter(query) {
  const { q, artistSlug, artistName, key, timeSignature, source, year, genre, songIds } = query;
  const filter = {};
  if (artistSlug) filter.artistSlug = artistSlug;
  if (artistName) filter.artistName = artistName;
  if (key) filter.key = key;
  if (timeSignature) filter.timeSignature = timeSignature;
  if (source) filter.source = source;
  if (genre) filter.genre = genre;
  if (year) filter.year = Number(year);
  if (songIds?.length) filter.songId = { $in: songIds };
  return filter;
}

function toBoolean(value) {
  return value === true || value === "true" || value === "1" || value === 1;
}

function findSongFilter(songId) {
  return mongoose.Types.ObjectId.isValid(songId)
    ? { $or: [{ songId }, { _id: songId }] }
    : { songId };
}

async function getFavoriteSongIds(userId) {
  if (!userId) return [];
  const user = await User.findById(userId).select("favoriteSongIds").lean();
  return (user?.favoriteSongIds || []).map((value) => String(value)).filter(Boolean);
}

function decorateFavorite(song, favoriteIds) {
  const sourceId = String(song?._id || "");
  const publicId = String(song?.songId || "");
  return {
    ...song,
    isFavorite: favoriteIds.has(publicId) || (sourceId ? favoriteIds.has(sourceId) : false),
  };
}

async function recordSongView(userId, song) {
  if (!userId || !song) return;
  const user = await User.findById(userId);
  if (!user) return;

  const favoriteIds = new Set((user.favoriteSongIds || []).map((value) => String(value)));
  const songPublicId = String(song.songId || song._id || "");
  const history = Array.isArray(user.songHistory) ? [...user.songHistory] : [];
  const index = history.findIndex((entry) => String(entry.songId) === songPublicId);
  const now = new Date();
  const nextEntry = {
    songId: songPublicId,
    title: song.title || "",
    artistName: song.artistName || "",
    key: song.key || "",
    genre: song.genre || "",
    language: song.language || "",
    tempo: song.tempo || 0,
    source: song.source || "",
    cover: song.cover || "",
    lastViewedAt: now,
    lastFavoritedAt: index >= 0 ? history[index]?.lastFavoritedAt || null : null,
    viewCount: index >= 0 ? Number(history[index]?.viewCount || 0) + 1 : 1,
    isFavorite: favoriteIds.has(songPublicId),
  };

  if (index >= 0) history.splice(index, 1);
  history.unshift(nextEntry);
  user.songHistory = history.slice(0, 250);
  await user.save();
}

async function setFavoriteSong(userId, song, favorite) {
  const user = await User.findById(userId);
  if (!user) {
    const err = new Error("User not found");
    err.status = 404;
    throw err;
  }

  const songPublicId = String(song.songId || song._id || "");
  const favoriteIds = new Set((user.favoriteSongIds || []).map((value) => String(value)));
  if (favorite) favoriteIds.add(songPublicId);
  else favoriteIds.delete(songPublicId);
  user.favoriteSongIds = [...favoriteIds];

  const history = Array.isArray(user.songHistory) ? [...user.songHistory] : [];
  const historyIndex = history.findIndex((entry) => String(entry.songId) === songPublicId);
  const now = new Date();
  const baseEntry =
    historyIndex >= 0
      ? history[historyIndex]
      : {
          songId: songPublicId,
          title: song.title || "",
          artistName: song.artistName || "",
          key: song.key || "",
          genre: song.genre || "",
          language: song.language || "",
          tempo: song.tempo || 0,
          source: song.source || "",
          cover: song.cover || "",
          lastViewedAt: null,
          viewCount: 0,
        };

  const nextEntry = {
    ...baseEntry,
    title: song.title || baseEntry.title || "",
    artistName: song.artistName || baseEntry.artistName || "",
    key: song.key || baseEntry.key || "",
    genre: song.genre || baseEntry.genre || "",
    language: song.language || baseEntry.language || "",
    tempo: song.tempo || baseEntry.tempo || 0,
    source: song.source || baseEntry.source || "",
    cover: song.cover || baseEntry.cover || "",
    isFavorite: favorite,
    lastFavoritedAt: favorite ? now : null,
  };

  if (historyIndex >= 0) history.splice(historyIndex, 1);
  history.unshift(nextEntry);
  user.songHistory = history.slice(0, 250);
  await user.save();

  return { favorite, favoriteSongIds: user.favoriteSongIds };
}

async function isRecommendationTrackingEnabled() {
  const settings = await Setting.findOne({ key: GLOBAL_SETTINGS_KEY })
    .select("recommendationTrackingEnabled")
    .lean();
  return settings?.recommendationTrackingEnabled !== false;
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

async function reindexSongSearch(limit = 500) {
  const songs = await Song.find({
    $or: [
      { searchText: { $exists: false } },
      { searchText: "" },
      { searchTokens: { $exists: false } },
      { searchTokens: { $size: 0 } },
      { sectionNames: { $exists: false } },
      { sectionNames: { $size: 0 } },
    ],
  })
    .select("_id title artistName artistSlug description genre language key timeSignature capo tags chordsUsed sections sectionFlow lines rawText")
    .limit(limit)
    .lean();

  if (!songs.length) {
    return { updated: 0, scanned: 0, remaining: 0 };
  }

  const updates = songs.map((song) => {
    const { sectionNames, searchTokens, searchText } = buildSongSearchDocument(song);
    return {
      updateOne: {
        filter: { _id: song._id },
        update: { $set: { sectionNames, searchTokens, searchText } },
      },
    };
  });

  await Song.bulkWrite(updates, { ordered: false });

  const remaining = await Song.countDocuments({
    $or: [
      { searchText: { $exists: false } },
      { searchText: "" },
      { searchTokens: { $exists: false } },
      { searchTokens: { $size: 0 } },
      { sectionNames: { $exists: false } },
      { sectionNames: { $size: 0 } },
    ],
  });

  return { updated: updates.length, scanned: songs.length, remaining };
}

async function searchSongsWithRanking({ filter, q, content, page, limit }) {
  const clauses = buildSearchClauses(q);
  const normalizedQuery = normalizeSearchValue(q);
  if (!clauses.length || !normalizedQuery) return null;

  const candidateLimit = Math.min(500, Math.max(120, page * limit * 8));
  const songs = await Song.find({ ...filter, $or: clauses })
    .select(content === "full" ? SONG_DETAIL_FIELDS : SONG_SUMMARY_FIELDS)
    .limit(candidateLimit)
    .lean();

  const ranked = songs
    .map((song) => {
      const enriched = song.searchText ? song : { ...song, ...buildSongSearchDocument(song) };
      return { song: enriched, rank: computeSongSearchRank(enriched, q) };
    })
    .filter((entry) => entry.rank > 0)
    .sort((left, right) => {
      if (right.rank !== left.rank) return right.rank - left.rank;
      return String(left.song.title || "").localeCompare(String(right.song.title || ""));
    });

  const total = ranked.length;
  const offset = (page - 1) * limit;
  return {
    songs: ranked.slice(offset, offset + limit).map((entry) => entry.song),
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
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
    const content = (req.query.content || "full").toString().trim();
    const favoriteOnly = toBoolean(req.query.favoriteOnly);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 24));
    const favoriteSongIds =
      favoriteOnly && req.user?.sub ? await getFavoriteSongIds(req.user.sub) : [];

    if (favoriteOnly && req.user?.sub && favoriteSongIds.length === 0) {
      return res.json({ songs: [], total: 0, page, limit, pages: 1 });
    }

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
      favoriteOnly,
      favoriteScope: favoriteOnly ? req.user?.sub || "guest" : "all",
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
        songIds: favoriteOnly && req.user?.sub ? favoriteSongIds : undefined,
      });

      if (q) {
        const ranked = await searchSongsWithRanking({
          filter,
          q,
          content,
          page,
          limit,
        });
        if (ranked) return ranked;
      }

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

    if (req.user?.sub) {
      const favorites = new Set(
        favoriteOnly ? favoriteSongIds : await getFavoriteSongIds(req.user.sub),
      );
      return res.json({
        ...response,
        songs: (response.songs || []).map((song) => decorateFavorite(song, favorites)),
      });
    }

    res.json(response);
  } catch (e) {
    next(e);
  }
});

router.post("/admin/reindex-search", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const requestedLimit = Number(req.body?.limit) || 500;
    const limit = Math.min(5000, Math.max(50, requestedLimit));
    const result = await reindexSongSearch(limit);
    invalidateTags(["songs", "artists"]);
    res.json(result);
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

    if (req.user?.sub) {
      const favorites = new Set(await getFavoriteSongIds(req.user.sub));
      return res.json({
        songs: (response.songs || []).map((song) => decorateFavorite(song, favorites)),
      });
    }

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
        const filter = findSongFilter(songId);
        const song = await Song.findOne(filter).select(SONG_DETAIL_FIELDS).lean();
        if (!song) {
          const err = new Error("Song not found");
          err.status = 404;
          throw err;
        }
        return { song };
      },
    );
    let nextSong = response.song;

    if (req.user?.sub) {
      const favorites = new Set(await getFavoriteSongIds(req.user.sub));
      nextSong = decorateFavorite(nextSong, favorites);
      if (await isRecommendationTrackingEnabled()) {
        await recordSongView(req.user.sub, nextSong);
      }
    }

    res.json({ song: nextSong });
  } catch (e) {
    next(e);
  }
});

router.post("/:songId/favorite", requireAuth, async (req, res, next) => {
  try {
    const song = await Song.findOne(findSongFilter(req.params.songId))
      .select(SONG_DETAIL_FIELDS)
      .lean();
    if (!song) return res.status(404).json({ error: "Song not found" });

    const favorite = typeof req.body?.favorite === "boolean" ? req.body.favorite : true;
    const response = await setFavoriteSong(req.user.sub, song, favorite);
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
