import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    googleId: { type: String, index: true, sparse: true, unique: true },
    email: { type: String, lowercase: true, trim: true, index: true, sparse: true, unique: true },
    name: { type: String, required: true, trim: true },
    handle: { type: String, index: true },
    usernameLower: { type: String, trim: true, lowercase: true, index: true, sparse: true, unique: true },
    avatar: String,
    bio: String,
    passwordHash: { type: String, select: false },
    authProvider: { type: String, enum: ["google", "local", "guest"], default: "local" },
    isAdmin: { type: Boolean, default: false },
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
