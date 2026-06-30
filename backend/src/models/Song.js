import mongoose from "mongoose";
import { buildSongSearchDocument } from "../lib/song-search.js";

const SegmentSchema = new mongoose.Schema(
  {
    chord: String,
    charIndex: Number,
    lyric: String,
  },
  { _id: false },
);

const LineSchema = new mongoose.Schema(
  {
    order: Number,
    type: String,
    chordLine: String,
    lyricLine: String,
    section: String,
    sectionOrder: Number,
    segments: [SegmentSchema],
  },
  { _id: false },
);

const SectionSchema = new mongoose.Schema(
  {
    order: Number,
    name: String,
    category: { type: String, index: true },
    lineCount: Number,
    chordsUsed: [String],
    autoDetected: Boolean,
    lines: [LineSchema],
  },
  { _id: false },
);

const SongSchema = new mongoose.Schema(
  {
    songId: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true, index: true },
    slug: String,
    artistId: { type: String, index: true },
    artistSlug: { type: String, index: true },
    artistName: { type: String, index: true },
    artistPageName: String,
    artistUrl: String,
    key: String,
    timeSignature: String,
    views: String,
    source: String,
    sourceUrl: { type: String, unique: true, sparse: true, index: true },
    rawText: String,
    description: String,
    cover: String,
    tempo: Number,
    vibe: String,
    genre: String,
    year: Number,
    language: String,
    difficulty: String,
    capo: String,
    tags: [String],
    chordsUsed: [String],
    lines: [LineSchema],
    sections: [SectionSchema],
    sectionFlow: [String],
    lineCount: Number,
    sectionCount: Number,
    sectionNames: [String],
    searchTokens: [String],
    searchText: String,
  },
  { timestamps: true },
);

SongSchema.index({ title: 1, artistName: 1, sectionNames: 1, sectionFlow: 1, tags: 1, chordsUsed: 1 });
SongSchema.index({ searchTokens: 1 });
SongSchema.index({ title: "text", artistName: "text", searchText: "text" });

SongSchema.pre("save", function syncSearchFields(next) {
  const { sectionNames, searchTokens, searchText } = buildSongSearchDocument(this);
  this.sectionNames = sectionNames;
  this.searchTokens = searchTokens;
  this.searchText = searchText;
  next();
});

export default mongoose.model("Song", SongSchema);
