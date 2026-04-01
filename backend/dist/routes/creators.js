"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const schema_1 = require("../db/schema");
const auth_1 = require("../middleware/auth");
const contract_1 = require("../services/contract");
const router = (0, express_1.Router)();
// GET /creators/:wallet
router.get("/:wallet", (req, res) => {
    const wallet = req.params.wallet.toLowerCase();
    const db = (0, schema_1.getDb)();
    const creator = db
        .prepare(`SELECT * FROM creators WHERE id = ?`)
        .get(wallet);
    if (!creator) {
        res.status(404).json({ error: "Creator not found" });
        return;
    }
    const totalContent = db
        .prepare(`SELECT COUNT(*) as cnt FROM content_items WHERE creator_id = ? AND status = 'active'`)
        .get(wallet).cnt;
    // Count routes where this creator contributed
    const allRoutes = db
        .prepare(`SELECT contributions FROM routes`)
        .all();
    const routesUsedIn = allRoutes.filter((r) => {
        const contributions = JSON.parse(r.contributions);
        return wallet in contributions;
    }).length;
    res.json({
        profile: creator,
        stats: { totalContent, routesUsedIn },
    });
});
// GET /creators/:wallet/earnings
router.get("/:wallet/earnings", auth_1.requireAuth, async (req, res) => {
    const wallet = req.params.wallet.toLowerCase();
    if (req.walletAddress !== wallet) {
        res.status(403).json({ error: "Forbidden" });
        return;
    }
    try {
        const unclaimed = await (0, contract_1.getCreatorBalance)(wallet);
        res.json({ unclaimed });
    }
    catch (err) {
        res.status(500).json({ error: "Failed to fetch earnings", detail: String(err) });
    }
});
exports.default = router;
//# sourceMappingURL=creators.js.map