import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  googleId: { type: String, index: true, sparse: true, unique: true },
  email: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  handle: { type: String, index: true },
  avatar: String,
  bio: String,
  isAdmin: { type: Boolean, default: false },
}, { timestamps: true });

export default mongoose.model("User", UserSchema);
