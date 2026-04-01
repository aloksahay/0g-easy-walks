"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const uuid_1 = require("uuid");
const fs_1 = __importDefault(require("fs"));
const schema_1 = require("../db/schema");
const auth_1 = require("../middleware/auth");
const upload_1 = require("../middleware/upload");
const storage_1 = require("../services/storage");
const router = (0, express_1.Router)();
function rowToItem(row) {
    return {
        id: row.id,
        creator_id: row.creator_id,
        title: row.title,
        description: row.description,
        category: row.category,
        latitude: row.latitude,
        longitude: row.longitude,
        city: row.city,
        tags: JSON.parse(row.tags),
        photo_hashes: JSON.parse(row.photo_hashes),
        text_hash: row.text_hash,
        created_at: row.created_at,
        status: row.status,
    };
}
// GET /content
router.get("/", (req, res) => {
    const { city, category, creator, page = "1", limit = "20" } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;
    let sql = `SELECT * FROM content_items WHERE status = 'active'`;
    const params = [];
    if (city) {
        sql += ` AND LOWER(city) = LOWER(?)`;
        params.push(city);
    }
    if (category) {
        sql += ` AND category = ?`;
        params.push(category);
    }
    if (creator) {
        sql += ` AND creator_id = ?`;
        params.push(creator.toLowerCase());
    }
    sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(limitNum, offset);
    const db = (0, schema_1.getDb)();
    const rows = db.prepare(sql).all(...params);
    const total = db.prepare(sql.replace("SELECT *", "SELECT COUNT(*) as cnt").split(" LIMIT")[0]).get(...params.slice(0, -2)).cnt;
    res.json({ items: rows.map(rowToItem), total, page: pageNum, limit: limitNum });
});
// GET /content/creator/:wallet
router.get("/creator/:wallet", (req, res) => {
    const wallet = req.params.wallet.toLowerCase();
    const db = (0, schema_1.getDb)();
    const rows = db
        .prepare(`SELECT * FROM content_items WHERE creator_id = ? AND status = 'active' ORDER BY created_at DESC`)
        .all(wallet);
    res.json({ items: rows.map(rowToItem) });
});
// GET /content/:id
router.get("/:id", (req, res) => {
    const db = (0, schema_1.getDb)();
    const row = db
        .prepare(`SELECT * FROM content_items WHERE id = ?`)
        .get(req.params.id);
    if (!row) {
        res.status(404).json({ error: "Content not found" });
        return;
    }
    res.json(rowToItem(row));
});
// POST /content — create new content item
router.post("/", auth_1.requireAuth, upload_1.uploadMiddleware.array("photos", 5), async (req, res) => {
    const { title, description, category, latitude, longitude, city, tags } = req.body;
    if (!title || !description || !category || !latitude || !longitude || !city) {
        res.status(400).json({ error: "Missing required fields: title, description, category, latitude, longitude, city" });
        return;
    }
    const validCategories = ["place", "activity", "eatery"];
    if (!validCategories.includes(category)) {
        res.status(400).json({ error: "category must be place, activity, or eatery" });
        return;
    }
    const files = req.files || [];
    try {
        // Upload photos to 0G Storage
        const photoHashes = [];
        for (const file of files) {
            const hash = await (0, storage_1.uploadFile)(file.path);
            photoHashes.push(hash);
            fs_1.default.unlinkSync(file.path); // clean up temp file
        }
        // Upload description to 0G Storage
        const descPayload = JSON.stringify({ title, description, city, category });
        const textHash = await (0, storage_1.uploadData)(Buffer.from(descPayload, "utf8"));
        const id = (0, uuid_1.v4)();
        const now = Date.now();
        const parsedTags = tags ? JSON.parse(tags) : [];
        const db = (0, schema_1.getDb)();
        db.prepare(`INSERT INTO content_items
         (id, creator_id, title, description, category, latitude, longitude, city, tags, photo_hashes, text_hash, created_at, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`).run(id, req.walletAddress, title, description, category, parseFloat(latitude), parseFloat(longitude), city, JSON.stringify(parsedTags), JSON.stringify(photoHashes), textHash, now);
        const row = db.prepare(`SELECT * FROM content_items WHERE id = ?`).get(id);
        res.status(201).json(rowToItem(row));
    }
    catch (err) {
        console.error("Content upload error:", err);
        // Clean up any temp files
        for (const file of files) {
            if (fs_1.default.existsSync(file.path))
                fs_1.default.unlinkSync(file.path);
        }
        res.status(500).json({ error: "Upload failed", detail: String(err) });
    }
});
exports.default = router;
//# sourceMappingURL=content.js.map