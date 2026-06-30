import mongoose from "mongoose";

const SongHistorySchema = new mongoose.Schema(
  {
    songId: { type: String, index: true },
    title: String,
    artistName: String,
    key: String,
    genre: String,
    language: String,
    tempo: Number,
    source: String,
    cover: String,
    lastViewedAt: Date,
    lastFavoritedAt: Date,
    viewCount: { type: Number, default: 0 },
    isFavorite: { type: Boolean, default: false },
  },
  { _id: false },
);

const UserSchema = new mongoose.Schema(
  {
    googleId: { type: String, index: true, sparse: true, unique: true },
    email: { type: String, lowercase: true, trim: true, index: true, sparse: true, unique: true },
    name: { type: String, required: true, trim: true },
    handle: { type: String, index: true },
    usernameLower: {
      type: String,
      trim: true,
      lowercase: true,
      index: true,
      sparse: true,
      unique: true,
    },
    avatar: String,
    bio: String,
    passwordHash: { type: String, select: false },
    authProvider: { type: String, enum: ["google", "local", "guest"], default: "local" },
    isAdmin: { type: Boolean, default: false },
    favoriteSongIds: [{ type: String, index: true }],
    songHistory: [SongHistorySchema],
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.passwordHash;
        delete ret.usernameLower;
        return ret;
      },
    },
  },
);

export default mongoose.model("User", UserSchema);
