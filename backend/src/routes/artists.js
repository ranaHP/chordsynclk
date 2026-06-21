import { Router } from "express";
import Artist from "../models/Artist.js";
import Song from "../models/Song.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const q = (req.query.q || "").toString().trim();
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 24);
    const filter = q ? { name: new RegExp(q, "i") } : {};
    const [artists, total] = await Promise.all([
      Artist.find(filter).sort({ name: 1 }).skip((page - 1) * limit).limit(limit),
      Artist.countDocuments(filter),
    ]);
    res.json({ artists, total, page, limit });
  } catch (e) { next(e); }
});

router.get("/:slug", async (req, res, next) => {
  try {
    const artist = await Artist.findOne({ slug: req.params.slug });
    if (!artist) return res.status(404).json({ error: "Artist not found" });
    const songs = await Song.find({ artistSlug: artist.slug })
      .select("songId title slug key views chordsUsed sectionCount")
      .sort({ title: 1 });
    res.json({ artist, songs });
  } catch (e) { next(e); }
});

export default router;
