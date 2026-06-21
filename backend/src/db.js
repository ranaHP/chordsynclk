import mongoose from "mongoose";

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME || "chordsync";
  if (!uri) throw new Error("MONGODB_URI not set");
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, { dbName });
  console.log("MongoDB connected");
}
