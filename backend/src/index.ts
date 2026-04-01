import express from "express";
import path from "path";
import { config } from "./config";
import { getDb } from "./db/schema";
import authRouter from "./routes/auth";
import contentRouter from "./routes/content";
import routesRouter from "./routes/routeHandlers";
import creatorsRouter from "./routes/creators";
import mediaRouter from "./routes/media";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS for dev
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  next();
});

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

// Serve web MVP from backend (single-origin deploy for ngrok demos)
const webDir = path.resolve(__dirname, "../../web");
app.use(express.static(webDir));

// API routes
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/content", contentRouter);
app.use("/api/v1/routes", routesRouter);
app.use("/api/v1/creators", creatorsRouter);
app.use("/api/v1/media", mediaRouter);

app.get("/", (_req, res) => {
  res.sendFile(path.join(webDir, "index.html"));
});

// Initialize DB on startup
getDb();

app.listen(config.port, () => {
  console.log(`EasyWalks backend running on port ${config.port}`);
  console.log(`0G RPC: ${config.og.rpc}`);
  console.log(`Contract: ${config.contract.address || "(not configured)"}`);
});

export default app;
