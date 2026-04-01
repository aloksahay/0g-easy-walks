import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import { getDb } from "../db/schema";
import { requireAuth } from "../middleware/auth";
import { uploadMiddleware } from "../middleware/upload";
import { uploadFile, uploadData } from "../services/storage";
import { ContentItem } from "../types";

const router = Router();

function rowToItem(row: Record<string, unknown>): ContentItem {
  return {
    id: row.id as string,
    creator_id: row.creator_id as string,
    title: row.title as string,
    description: row.description as string,
    category: row.category as ContentItem["category"],
    latitude: row.latitude as number,
    longitude: row.longitude as number,
    city: row.city as string,
    tags: JSON.parse(row.tags as string),
    photo_hashes: JSON.parse(row.photo_hashes as string),
    text_hash: row.text_hash as string,
    created_at: row.created_at as number,
    status: row.status as ContentItem["status"],
  };
}

// GET /content
router.get("/", (req: Request, res: Response) => {
  const { city, category, creator, page = "1", limit = "20" } = req.query as Record<string, string | undefined>;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
  const offset = (pageNum - 1) * limitNum;

  let sql = `SELECT * FROM content_items WHERE status = 'active'`;
  const params: (string | number)[] = [];

  if (city) { sql += ` AND LOWER(city) = LOWER(?)`; params.push(city); }
  if (category) { sql += ` AND category = ?`; params.push(category); }
  if (creator) { sql += ` AND creator_id = ?`; params.push((creator as string).toLowerCase()); }

  sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(limitNum, offset);

  const db = getDb();
  const rows = db.prepare(sql).all(...params) as Record<string, unknown>[];
  const total = (db.prepare(sql.replace("SELECT *", "SELECT COUNT(*) as cnt").split(" LIMIT")[0]).get(...params.slice(0, -2)) as { cnt: number }).cnt;

  res.json({ items: rows.map(rowToItem), total, page: pageNum, limit: limitNum });
});

// GET /content/creator/:wallet
router.get("/creator/:wallet", (req: Request, res: Response) => {
  const wallet = (req.params.wallet as string).toLowerCase();
  const db = getDb();
  const rows = db
    .prepare(`SELECT * FROM content_items WHERE creator_id = ? AND status = 'active' ORDER BY created_at DESC`)
    .all(wallet) as Record<string, unknown>[];
  res.json({ items: rows.map(rowToItem) });
});

// GET /content/:id
router.get("/:id", (req: Request, res: Response) => {
  const db = getDb();
  const row = db
    .prepare(`SELECT * FROM content_items WHERE id = ?`)
    .get(req.params.id) as Record<string, unknown> | undefined;

  if (!row) {
    res.status(404).json({ error: "Content not found" });
    return;
  }
  res.json(rowToItem(row));
});

// POST /content — create new content item
router.post(
  "/",
  requireAuth,
  uploadMiddleware.array("photos", 5),
  async (req: Request, res: Response) => {
    const { title, description, category, latitude, longitude, city, tags } =
      req.body as {
        title?: string;
        description?: string;
        category?: string;
        latitude?: string;
        longitude?: string;
        city?: string;
        tags?: string;
      };

    if (!title || !description || !category || !latitude || !longitude || !city) {
      res.status(400).json({ error: "Missing required fields: title, description, category, latitude, longitude, city" });
      return;
    }

    const validCategories = ["place", "activity", "eatery"];
    if (!validCategories.includes(category)) {
      res.status(400).json({ error: "category must be place, activity, or eatery" });
      return;
    }

    const files = (req.files as Express.Multer.File[]) || [];

    try {
      // Upload photos to 0G Storage
      const photoHashes: string[] = [];
      for (const file of files) {
        const hash = await uploadFile(file.path);
        photoHashes.push(hash);
        fs.unlinkSync(file.path); // clean up temp file
      }

      // Upload description to 0G Storage
      const descPayload = JSON.stringify({ title, description, city, category });
      const textHash = await uploadData(Buffer.from(descPayload, "utf8"));

      const id = uuidv4();
      const now = Date.now();
      const parsedTags: string[] = tags ? JSON.parse(tags) : [];

      const db = getDb();
      db.prepare(
        `INSERT INTO content_items
         (id, creator_id, title, description, category, latitude, longitude, city, tags, photo_hashes, text_hash, created_at, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`
      ).run(
        id,
        req.walletAddress!,
        title,
        description,
        category,
        parseFloat(latitude),
        parseFloat(longitude),
        city,
        JSON.stringify(parsedTags),
        JSON.stringify(photoHashes),
        textHash,
        now
      );

      const row = db.prepare(`SELECT * FROM content_items WHERE id = ?`).get(id) as Record<string, unknown>;
      res.status(201).json(rowToItem(row));
    } catch (err) {
      console.error("Content upload error:", err);
      // Clean up any temp files
      for (const file of files) {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      }
      res.status(500).json({ error: "Upload failed", detail: String(err) });
    }
  }
);

export default router;
