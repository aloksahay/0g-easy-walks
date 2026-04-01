"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const storage_1 = require("../services/storage");
const config_1 = require("../config");
const router = (0, express_1.Router)();
// GET /media/:rootHash
router.get("/:rootHash", async (req, res) => {
    const rootHash = req.params.rootHash;
    // Basic validation — 0G hashes are 66-char hex
    if (!/^0x[0-9a-fA-F]{64}$/.test(rootHash)) {
        res.status(400).json({ error: "Invalid root hash format" });
        return;
    }
    const cacheDir = config_1.config.mediaCache.dir;
    if (!fs_1.default.existsSync(cacheDir)) {
        fs_1.default.mkdirSync(cacheDir, { recursive: true });
    }
    const cachedPath = path_1.default.join(cacheDir, rootHash);
    // Serve from cache if available
    if (fs_1.default.existsSync(cachedPath)) {
        res.setHeader("Cache-Control", `public, max-age=${config_1.config.mediaCache.maxAgeSeconds}`);
        res.setHeader("Content-Type", "application/octet-stream");
        res.sendFile(cachedPath);
        return;
    }
    try {
        await (0, storage_1.downloadToFile)(rootHash, cachedPath);
        res.setHeader("Cache-Control", `public, max-age=${config_1.config.mediaCache.maxAgeSeconds}`);
        res.setHeader("Content-Type", "application/octet-stream");
        res.sendFile(cachedPath);
    }
    catch (err) {
        console.error("Media download error:", err);
        res.status(404).json({ error: "Media not found", detail: String(err) });
    }
});
exports.default = router;
//# sourceMappingURL=media.js.map