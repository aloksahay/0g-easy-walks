"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ethers_1 = require("ethers");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const schema_1 = require("../db/schema");
const config_1 = require("../config");
const router = (0, express_1.Router)();
// POST /auth/challenge
router.post("/challenge", (req, res) => {
    const { walletAddress } = req.body;
    if (!walletAddress || !ethers_1.ethers.isAddress(walletAddress)) {
        res.status(400).json({ error: "Invalid wallet address" });
        return;
    }
    const challenge = `Sign this message to authenticate with EasyWalks.\n\nNonce: ${Math.random().toString(36).slice(2)}\nTimestamp: ${Date.now()}`;
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes
    const db = (0, schema_1.getDb)();
    db.prepare(`INSERT OR REPLACE INTO auth_challenges (wallet_address, challenge, expires_at)
     VALUES (?, ?, ?)`).run(walletAddress.toLowerCase(), challenge, expiresAt);
    res.json({ challenge, expiresAt });
});
// POST /auth/verify
router.post("/verify", (req, res) => {
    const { walletAddress, signature, challenge } = req.body;
    if (!walletAddress || !signature || !challenge) {
        res.status(400).json({ error: "Missing walletAddress, signature, or challenge" });
        return;
    }
    const db = (0, schema_1.getDb)();
    const row = db
        .prepare(`SELECT challenge, expires_at FROM auth_challenges WHERE wallet_address = ?`)
        .get(walletAddress.toLowerCase());
    if (!row || row.challenge !== challenge) {
        res.status(401).json({ error: "Invalid challenge" });
        return;
    }
    if (Date.now() > row.expires_at) {
        res.status(401).json({ error: "Challenge expired" });
        return;
    }
    // Verify the signature
    try {
        const recovered = ethers_1.ethers.verifyMessage(challenge, signature);
        if (recovered.toLowerCase() !== walletAddress.toLowerCase()) {
            res.status(401).json({ error: "Signature verification failed" });
            return;
        }
    }
    catch {
        res.status(401).json({ error: "Invalid signature" });
        return;
    }
    // Ensure creator row exists
    const now = Date.now();
    db.prepare(`INSERT OR IGNORE INTO creators (id, display_name, bio, avatar_hash, created_at)
     VALUES (?, ?, NULL, NULL, ?)`).run(walletAddress.toLowerCase(), walletAddress.slice(0, 10) + "...", now);
    // Clean up challenge
    db.prepare(`DELETE FROM auth_challenges WHERE wallet_address = ?`).run(walletAddress.toLowerCase());
    const token = jsonwebtoken_1.default.sign({ walletAddress: walletAddress.toLowerCase() }, config_1.config.jwtSecret, { expiresIn: config_1.config.jwtExpiresIn });
    res.json({ token });
});
exports.default = router;
//# sourceMappingURL=auth.js.map