import mongoose from "mongoose";

const ArtistSchema = new mongoose.Schema({
  artistId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, index: true },
  slug: { type: String, required: true, unique: true, index: true },
  source: String,
  sourceUrl: { type: String, unique: true, sparse: true, index: true },
  songCount: { type: Number, default: 0 },
}, { timestamps: true });

export default mongoose.model("Artist", ArtistSchema);
