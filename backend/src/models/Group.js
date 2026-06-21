import mongoose from "mongoose";
import crypto from "crypto";

const MemberSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  role: { type: String, enum: ["Owner", "Scroller", "Member"], default: "Member" },
}, { _id: false });

const GroupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  image: String,
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  members: [MemberSchema],
  inviteCode: { type: String, unique: true, default: () => crypto.randomBytes(5).toString("hex") },
}, { timestamps: true });

export default mongoose.model("Group", GroupSchema);
