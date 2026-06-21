import "dotenv/config";
import { readFile } from "node:fs/promises";
import mongoose from "mongoose";
import { connectDB } from "./db.js";
import Artist from "./models/Artist.js";
import Song from "./models/Song.js";

function unwrap(value) {
  if (Array.isArray(value)) return value.map(unwrap);
  if (!value || typeof value !== "object") return value;
  if ("$oid" in value) return value.$oid;
  if ("$date" in value) return new Date(value.$date);

  return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, unwrap(nested)]));
}

async function run() {
  const filePath = process.argv[2];
  if (!filePath) {
    throw new Error("Usage: npm run import:song -- <path-to-song-json>");
  }

  await connectDB();

  const raw = await readFile(filePath, "utf8");
  const parsed = unwrap(JSON.parse(raw));
  const song = Array.isArray(parsed) ? parsed[0] : parsed;

  if (!song?.songId || !song?.title) {
    throw new Error("Song JSON must include at least songId and title");
  }

  if (song.artistId && song.artistName && song.artistSlug) {
    await Artist.findOneAndUpdate(
      { artistId: song.artistId },
      {
        $set: {
          artistId: song.artistId,
          name: song.artistName,
          slug: song.artistSlug,
          source: song.source || "import",
          sourceUrl: song.artistUrl || undefined,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }

  delete song._id;
  delete song.createdAt;
  delete song.updatedAt;

  await Song.findOneAndUpdate({ songId: song.songId }, { $set: song }, { upsert: true, new: true });

  console.log(`Imported song: ${song.title} (${song.songId})`);
  await mongoose.disconnect();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
