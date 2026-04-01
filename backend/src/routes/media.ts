import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { downloadToFile } from "../services/storage";
import { config } from "../config";

const router = Router();

// GET /media/:rootHash
router.get("/:rootHash", async (req: Request, res: Response) => {
  const rootHash = req.params.rootHash as string;

  // Basic validation — 0G hashes are 66-char hex
  if (!/^0x[0-9a-fA-F]{64}$/.test(rootHash)) {
    res.status(400).json({ error: "Invalid root hash format" });
    return;
  }

  const cacheDir = config.mediaCache.dir;
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  const cachedPath = path.join(cacheDir, rootHash);

  // Serve from cache if available
  if (fs.existsSync(cachedPath)) {
    res.setHeader("Cache-Control", `public, max-age=${config.mediaCache.maxAgeSeconds}`);
    res.setHeader("Content-Type", "application/octet-stream");
    res.sendFile(cachedPath);
    return;
  }

  try {
    await downloadToFile(rootHash, cachedPath);

    res.setHeader("Cache-Control", `public, max-age=${config.mediaCache.maxAgeSeconds}`);
    res.setHeader("Content-Type", "application/octet-stream");
    res.sendFile(cachedPath);
  } catch (err) {
    console.error("Media download error:", err);
    res.status(404).json({ error: "Media not found", detail: String(err) });
  }
});

export default router;
