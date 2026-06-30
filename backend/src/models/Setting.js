import mongoose from "mongoose";

const SettingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    siteFontScalePercent: { type: Number, default: 100 },
    songReaderFontPercent: { type: Number, default: 73 },
    stageReaderFontPercent: { type: Number, default: 100 },
    adminTerminalTitle: { type: String, default: "ChordSync Admin Terminal" },
    recommendationTrackingEnabled: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export default mongoose.model("Setting", SettingSchema);
