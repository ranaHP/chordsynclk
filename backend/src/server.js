import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import morgan from "morgan";
import { Server as SocketIOServer } from "socket.io";

import { connectDB } from "./db.js";
import { attachSocket } from "./socket.js";
import { authOptional } from "./middleware/auth.js";

import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import artistRoutes from "./routes/artists.js";
import songRoutes from "./routes/songs.js";
import groupRoutes from "./routes/groups.js";
import eventRoutes from "./routes/events.js";
import liveRoutes from "./routes/live.js";
import settingsRoutes from "./routes/settings.js";

const app = express();
const server = http.createServer(app);

const origins = (process.env.CORS_ORIGIN || "*")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(cors({ origin: origins.includes("*") ? true : origins, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));
app.use(authOptional);

app.get("/api/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/artists", artistRoutes);
app.use("/api/songs", songRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/live", liveRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || "Server error" });
});

const io = new SocketIOServer(server, {
  cors: { origin: origins.includes("*") ? true : origins, credentials: true },
});
attachSocket(io);

const port = Number(process.env.PORT) || 4000;
const host = process.env.HOST || "0.0.0.0";
connectDB().then(() => {
  server.listen(port, host, () => console.log(`ChordSync backend on ${host}:${port}`));
});
