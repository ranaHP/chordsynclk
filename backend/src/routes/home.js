import { Router } from "express";
import Artist from "../models/Artist.js";
import Event from "../models/Event.js";
import Group from "../models/Group.js";
import Song from "../models/Song.js";
import User from "../models/User.js";
import { buildCacheKey, remember } from "../lib/cache.js";

const router = Router();
const HOME_STATS_CACHE_TTL_MS = 5 * 60 * 1000;

router.get("/stats", async (_req, res, next) => {
  try {
    const cacheKey = buildCacheKey("home:stats", "public");
    const response = await remember(
      cacheKey,
      HOME_STATS_CACHE_TTL_MS,
      ["home", "songs", "artists", "groups", "users", "events"],
      async () => {
        const [songs, artists, users, groups, events] = await Promise.all([
          Song.countDocuments({}),
          Artist.countDocuments({}),
          User.countDocuments({}),
          Group.countDocuments({}),
          Event.countDocuments({}),
        ]);

        return {
          stats: {
            songs,
            artists,
            chords: songs,
            users,
            groups,
            events,
          },
          cachedAt: Date.now(),
        };
      },
    );

    res.json(response);
  } catch (error) {
    next(error);
  }
});

export default router;
