import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "./db.js";
import User from "./models/User.js";
import Group from "./models/Group.js";
import Event from "./models/Event.js";
import Song from "./models/Song.js";

const groupId = new mongoose.Types.ObjectId("6a36d7e2deeb3ec030ebd970");
const PIC = (s, w = 800) => `https://picsum.photos/seed/${encodeURIComponent(s)}/${w}/${w}`;
const AVT = (s) => `https://i.pravatar.cc/200?u=${encodeURIComponent(s)}`;

async function ensureUser(email, name, handle, isAdmin = false) {
  return User.findOneAndUpdate(
    { email },
    { $set: { email, name, handle, avatar: AVT(email), bio: "ChordSync Live performer", isAdmin } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function run() {
  await connectDB();
  console.log("Seeding ChordSync collaboration data...");

  const owner = await ensureUser("admin@chordsync.live", "Leo Strat", "@leostrat", true);
  const alex = await ensureUser("alex@chordsync.live", "Alex Rivers", "@arivers");
  const maya = await ensureUser("maya@chordsync.live", "Maya Solano", "@mayasolano");
  const jin = await ensureUser("jin@chordsync.live", "Jin Park", "@jinpark");

  const songs = await Song.find({}).sort({ updatedAt: -1 }).limit(4).lean();
  const fallbackSongIds = ["song-1", "song-2", "song-5", "song-7"];
  const playlistItems = (songs.length ? songs.map((s) => s.songId) : fallbackSongIds).slice(0, 4).map((songId, index) => ({
    songId,
    partName: index === 2 ? "Chorus" : "Full Song",
    order: index,
  }));

  const group = await Group.findOneAndUpdate(
    { _id: groupId },
    {
      $set: {
        name: "The Stratocasters",
        description: "Weekly garage rehearsals. Beer, riffs, no metronome.",
        image: PIC("stratocasters"),
        ownerId: owner._id,
        members: [
          { userId: owner._id, role: "Scroller" },
          { userId: alex._id, role: "Member" },
          { userId: maya._id, role: "Member" },
          { userId: jin._id, role: "Member" },
        ],
        inviteCode: "strato92x",
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await Event.findOneAndUpdate(
    { eventId: "e1" },
    {
      $set: {
        eventId: "e1",
        groupId: group._id,
        name: "Friday Jam Session",
        description: "Three new covers + one original. Build your playlist with full songs or selected sections.",
        image: PIC("fridayjam"),
        date: new Date(Date.now() + 2 * 86400000),
        duration: 90,
        playlists: [
          {
            name: "Main Set",
            description: "Rotate Scroller every 3 songs.",
            items: playlistItems,
          },
          {
            name: "Encore",
            description: "If they're still standing.",
            items: playlistItems.slice(0, 1),
          },
        ],
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  console.log("Seeded group:", group._id.toString());
  console.log("Seeded event: e1");
  console.log("Open frontend group page: /groups/6a36d7e2deeb3ec030ebd970");
  console.log("Open frontend event page: /events/e1");
  await mongoose.disconnect();
}

run().catch((e) => { console.error(e); process.exit(1); });
