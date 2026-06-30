import mongoose from "mongoose";

const ArrangementLineSchema = new mongoose.Schema(
  {
    type: String,
    chordLine: String,
    lyricLine: String,
  },
  { _id: false },
);

const ArrangementSectionSchema = new mongoose.Schema(
  {
    sectionId: String,
    name: String,
    sourcePartName: String,
    lines: [ArrangementLineSchema],
  },
  { _id: false },
);

const PlaylistItemSchema = new mongoose.Schema(
  {
    songId: { type: String, required: true },
    partName: String,
    transpose: { type: Number, default: 0 },
    arrangement: [ArrangementSectionSchema],
    order: { type: Number, default: 0 },
  },
  { _id: true },
);

const PlaylistSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  items: [PlaylistItemSchema],
}, { _id: true, timestamps: true });

const EventSchema = new mongoose.Schema({
  eventId: { type: String, unique: true, sparse: true, index: true },
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true, index: true },
  name: { type: String, required: true },
  description: String,
  image: String,
  date: Date,
  duration: Number,
  playlists: [PlaylistSchema],
}, { timestamps: true });

export default mongoose.model("Event", EventSchema);
