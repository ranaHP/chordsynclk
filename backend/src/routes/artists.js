import { Router } from "express";
import Artist from "../models/Artist.js";
import Song from "../models/Song.js";
import { buildCacheKey, remember } from "../lib/cache.js";

const router = Router();
const ARTIST_CACHE_TTL_MS = 5 * 60 * 1000;

router.get("/", async (req, res, next) => {
  try {
    const q = (req.query.q || "").toString().trim();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(60, Math.max(1, parseInt(req.query.limit, 10) || 24));
    const cacheKey = buildCacheKey("artists:list", { q, page, limit });

    const response = await remember(cacheKey, ARTIST_CACHE_TTL_MS, ["artists"], async () => {
      const filter = q ? { name: new RegExp(q, "i") } : {};
      const [artists, total] = await Promise.all([
        Artist.find(filter)
          .sort({ name: 1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        Artist.countDocuments(filter),
      ]);
      return {
        artists,
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

router.get("/:slug", async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 24));
    const cacheKey = buildCacheKey("artists:detail", { slug: req.params.slug, page, limit });

    const response = await remember(
      cacheKey,
      ARTIST_CACHE_TTL_MS,
      ["artists", "songs", `artist:${req.params.slug}`],
      async () => {
        const artist = await Artist.findOne({ slug: req.params.slug }).lean();
        if (!artist) {
          const err = new Error("Artist not found");
          err.status = 404;
          throw err;
        }

        const [songs, total] = await Promise.all([
          Song.find({ artistSlug: artist.slug })
            .select("songId title slug key views chordsUsed sectionCount")
            .sort({ title: 1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
          Song.countDocuments({ artistSlug: artist.slug }),
        ]);

        return {
          artist,
          songs,
          total,
          page,
          limit,
          pages: Math.max(1, Math.ceil(total / limit)),
        };
      },
    );

    res.json(response);
  } catch (e) {
    next(e);
  }
});

export default router;
