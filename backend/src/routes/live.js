import mongoose from "mongoose";
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getLiveState } from "../socket.js";
import Event from "../models/Event.js";
import Group from "../models/Group.js";
import Song from "../models/Song.js";
import { buildCacheKey, remember } from "../lib/cache.js";

const router = Router();
const LIVE_CACHE_TTL_MS = 60 * 1000;
const SONG_DETAIL_FIELDS =
  "songId title slug artistName artistSlug key timeSignature source views chordsUsed sectionCount description cover tempo vibe genre year language difficulty capo tags lineCount sectionFlow rawText lines sections";

router.use(requireAuth);

function eventFilter(id) {
  return mongoose.Types.ObjectId.isValid(id)
    ? { $or: [{ _id: id }, { eventId: id }] }
    : { eventId: id };
}

async function loadStageBundle(eventId, userId) {
  const event = await Event.findOne(eventFilter(eventId)).lean();
  if (!event) {
    const err = new Error("Event not found");
    err.status = 404;
    throw err;
  }

  const group = await Group.findById(event.groupId).lean();
  if (!group) {
    const err = new Error("Group missing");
    err.status = 404;
    throw err;
  }

  const isMember =
    String(group.ownerId) === String(userId) ||
    (group.members || []).some((member) => String(member.userId) === String(userId));
  if (!isMember) {
    const err = new Error("Forbidden");
    err.status = 403;
    throw err;
  }

  const songIds = Array.from(
    new Set(
      (event.playlists || []).flatMap((playlist) =>
        (playlist.items || []).map((item) => String(item.songId)).filter(Boolean),
      ),
    ),
  );

  if (!songIds.length) {
    return { event, songs: [], state: getLiveState(eventId) };
  }

  const objectIds = songIds.filter((value) => mongoose.Types.ObjectId.isValid(value));
  const songs = await Song.find({
    $or: [{ songId: { $in: songIds } }, ...(objectIds.length ? [{ _id: { $in: objectIds } }] : [])],
  })
    .select(SONG_DETAIL_FIELDS)
    .lean();

  return { event, songs, state: getLiveState(eventId) };
}

router.get("/:eventId/stage", async (req, res, next) => {
  try {
    const cacheKey = buildCacheKey("live:stage", {
      eventId: req.params.eventId,
      userId: req.user.sub,
    });
    const response = await remember(
      cacheKey,
      LIVE_CACHE_TTL_MS,
      ["events", "groups", "songs", `stage:${req.params.eventId}`],
      async () => loadStageBundle(req.params.eventId, req.user.sub),
    );
    res.json(response);
  } catch (e) {
    next(e);
  }
});

router.get("/:eventId", async (req, res, next) => {
  try {
    const response = await loadStageBundle(req.params.eventId, req.user.sub);
    res.json({ state: response.state });
  } catch (e) {
    next(e);
  }
});

export default router;
