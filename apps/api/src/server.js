// Path: goviet247/apps/api/src/server.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import http from "http";
import path from "path";
import { Server as SocketIOServer } from "socket.io";
import { prisma } from "./utils/db.js";

import authRoutes from "./routes/auth.js";
import tripRoutes from "./routes/trips.js";
import deviceRoutes from "./routes/devices.js";
import tripPublicRoutes from "./routes/tripPublicRoutes.js";
import systemPublicRoutes from "./routes/systemPublicRoutes.js";
import adminRoutes from "./routes/admin.js";
import feedbackRoutes from "./routes/feedback.js";
import { initPendingWatcher } from "./services/pendingWatcher.js";
import adminAuthRoutes from "./routes/adminAuth.js";
import adminCustomersRoutes from "./routes/adminCustomers.js";
import pricingRoutes from "./routes/pricing.js";
import publicConfigRoutes from "./routes/publicConfig.js";
import driverDocumentsRoutes from "./routes/driverDocuments.js";
import driverProfileRoutes from "./routes/driverProfile.js";
import uploadRoutes from "./routes/upload.js";
import mapsRoutes from "./routes/maps.js";


const app = express();

// ✅ Tắt ETag để tránh 304 (admin list cần luôn fresh)
app.set("etag", false);

// --- Parse allowed origins từ .env ---
const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

console.log("[CORS] allowedOrigins =", allowedOrigins);

// --- CORS config dùng chung cho REST + Socket.IO ---
const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }

    // Dev fallback: nếu không cấu hình gì thì cho hết
    if (allowedOrigins.length === 0) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.log("[CORS] Blocked origin:", origin);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-App-Version",
    "x-app-version",
    "Accept",
  ],
};

// --- Middlewares ---
app.use(express.json());
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use(
  helmet({
    crossOriginResourcePolicy: false,
  }),
);

app.use(morgan("dev"));

// --- Serve file uploads local ---
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// --- Health check ---
app.get("/health", (req, res) => {
  res.json({ ok: true, service: "GoViet247 API" });
});

// --- REST routes ---
app.use("/api/auth", authRoutes);
app.use("/api/driver/documents", driverDocumentsRoutes);
app.use("/api/driver/profile", driverProfileRoutes);
app.use("/api/trips", tripRoutes);
app.use("/api/devices", deviceRoutes);
app.use("/api/feedbacks", feedbackRoutes);
app.use("/api/public/trips", tripPublicRoutes);
app.use("/api/public", publicConfigRoutes);
app.use("/api/public", systemPublicRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin/auth", adminAuthRoutes);
app.use("/api/admin/customers", adminCustomersRoutes);
app.use("/api/pricing", pricingRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/maps", mapsRoutes);

// --- Tạo HTTP server & gắn Socket.IO ---
const server = http.createServer(app);

// Khởi tạo Socket.IO
const io = new SocketIOServer(server, {
  cors: {
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.log("[Socket CORS] Blocked origin:", origin);
      return callback(new Error(`Socket CORS blocked for origin: ${origin}`));
    },
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Lưu `io` vào app để controllers/routes dùng lại
app.set("io", io);

// Map để lưu thông tin socket của tài xế / rider
const driverSockets = new Map(); // socket.id -> { userId }
const riderSockets = new Map(); // socket.id -> { userId }

// Lắng nghe kết nối Socket.IO
io.on("connection", (socket) => {
  console.log("[Socket] Client connected:", socket.id);

  // --- ADMIN: join room "admins"
  socket.on("registerAdmin", (payload) => {
    console.log(
      "[Socket] registerAdmin:",
      payload?.username || "(no-username)",
    );
    socket.join("admins");
    console.log(`[Socket] Socket ${socket.id} joined room "admins"`);
  });

  // --- DRIVER: join room "drivers" + room riêng theo userId
  socket.on("registerDriver", (payload) => {
    console.log("[Socket] registerDriver:", payload);

    const userId =
      payload?.userId && String(payload.userId).trim()
        ? String(payload.userId).trim()
        : null;

    driverSockets.set(socket.id, { userId });

    socket.join("drivers");
    console.log(`[Socket] Socket ${socket.id} joined room "drivers"`);

    if (userId) {
      const privateRoom = `driver:${userId}`;
      socket.join(privateRoom);
      console.log(`[Socket] Socket ${socket.id} joined room "${privateRoom}"`);
    }
  });

  // --- RIDER: join room riêng theo userId
  socket.on("registerRider", (payload) => {
    console.log("[Socket] registerRider:", payload);

    const userId =
      payload?.userId && String(payload.userId).trim()
        ? String(payload.userId).trim()
        : null;

    riderSockets.set(socket.id, { userId });

    socket.join("riders");
    console.log(`[Socket] Socket ${socket.id} joined room "riders"`);

    if (userId) {
      const privateRoom = `rider:${userId}`;
      socket.join(privateRoom);
      console.log(`[Socket] Socket ${socket.id} joined room "${privateRoom}"`);
    }
  });

  socket.on("disconnect", () => {
    console.log("[Socket] Client disconnected:", socket.id);
    driverSockets.delete(socket.id);
    riderSockets.delete(socket.id);
  });
});

// Pending watcher
const watcher = initPendingWatcher({ io, prisma });
watcher.runOnce();

const port = process.env.PORT || process.env.API_PORT || 5050;
server.listen(port, () => {
  console.log(`[API] chạy ở http://localhost:${port}`);
});
