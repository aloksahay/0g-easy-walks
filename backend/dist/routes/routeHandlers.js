"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const uuid_1 = require("uuid");
const schema_1 = require("../db/schema");
const auth_1 = require("../middleware/auth");
const storage_1 = require("../services/storage");
const contract_1 = require("../services/contract");
const curator_1 = require("../services/curator");
const config_1 = require("../config");
const router = (0, express_1.Router)();
function rowToRoute(row) {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        city: row.city,
        duration_mins: row.duration_mins,
        distance_km: row.distance_km,
        item_ids: JSON.parse(row.item_ids),
        contributions: JSON.parse(row.contributions),
        price_og: row.price_og,
        route_hash: row.route_hash,
        contract_route_id: row.contract_route_id,
        created_at: row.created_at,
    };
}
/**
 * Register route on marketplace contract in the background so prepare-purchase
 * can return quickly (no long tx.wait in the request path).
 */
function registerRouteOnChainInBackground(routeId) {
    void (async () => {
        try {
            const db = (0, schema_1.getDb)();
            const row = db.prepare(`SELECT * FROM routes WHERE id = ?`).get(routeId);
            if (!row)
                return;
            const route = rowToRoute(row);
            if (route.contract_route_id != null)
                return;
            const { creators, sharesBps } = (0, curator_1.contributionsToBps)(route.contributions);
            const contractRouteId = await (0, contract_1.registerRoute)(creators, sharesBps, route.price_og, route.route_hash || "0x" + "0".repeat(64));
            db.prepare(`UPDATE routes SET contract_route_id = ? WHERE id = ?`).run(contractRouteId, routeId);
            console.log(`Route ${routeId} registered on-chain: ${contractRouteId}`);
        }
        catch (e) {
            console.warn("Background registerRoute failed:", e);
        }
    })();
}
function rowToContentItem(row) {
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
// POST /routes/generate
router.post("/generate", auth_1.requireAuth, async (req, res) => {
    const preferences = req.body;
    if (!preferences.city || !preferences.duration || !preferences.categories?.length) {
        res.status(400).json({ error: "Missing required fields: city, duration, categories" });
        return;
    }
    try {
        const db = (0, schema_1.getDb)();
        // Fetch candidate content items from this city
        const rows = db
            .prepare(`SELECT * FROM content_items
         WHERE LOWER(city) = LOWER(?) AND status = 'active'
         ORDER BY created_at DESC LIMIT 100`)
            .all(preferences.city);
        if (rows.length === 0) {
            res.status(404).json({ error: `No content found for city: ${preferences.city}` });
            return;
        }
        const items = rows.map(rowToContentItem);
        // AI curation
        const curated = await (0, curator_1.curateRoute)(items, preferences, preferences.startLocation);
        const itemsById = new Map(items.map((i) => [i.id, i]));
        const routeId = (0, uuid_1.v4)();
        const built = (0, curator_1.buildGeneratedRoute)(routeId, curated, itemsById);
        // Upload full route JSON to 0G Storage
        const routeJson = JSON.stringify({
            id: routeId,
            title: built.title,
            description: built.description,
            city: preferences.city,
            stops: built.stops.map((s) => ({
                id: s.contentItem.id,
                title: s.contentItem.title,
                category: s.contentItem.category,
                lat: s.contentItem.latitude,
                lng: s.contentItem.longitude,
                order: s.order,
                walkTimeMins: s.walkTimeMins,
            })),
            contributions: built.contributions,
        });
        const now = Date.now();
        const orderedItems = built.stops.map((s) => s.contentItem);
        // Persist immediately so the API returns fast. 0G Storage upload can take minutes
        // (waiting for on-chain finality); we upload in the background and patch route_hash.
        db.prepare(`INSERT INTO routes
       (id, title, description, city, duration_mins, distance_km, item_ids, contributions, price_og, route_hash, contract_route_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?)`).run(routeId, built.title, built.description, preferences.city, built.totalDuration, built.distance, JSON.stringify(orderedItems.map((i) => i.id)), JSON.stringify(built.contributions), config_1.config.routePrice.base, now);
        void (0, storage_1.uploadData)(Buffer.from(routeJson, "utf8"))
            .then((hash) => {
            (0, schema_1.getDb)()
                .prepare(`UPDATE routes SET route_hash = ? WHERE id = ?`)
                .run(hash, routeId);
            console.log(`Route ${routeId} uploaded to 0G Storage: ${hash}`);
        })
            .catch((uploadErr) => {
            console.warn("Background route upload to 0G Storage failed:", uploadErr);
        });
        registerRouteOnChainInBackground(routeId);
        res.json({
            route: {
                id: routeId,
                title: built.title,
                description: built.description,
                stops: built.stops,
                totalDuration: built.totalDuration,
                totalDistance: built.distance,
                contributions: built.contributions,
                priceOg: config_1.config.routePrice.base,
            },
        });
    }
    catch (err) {
        console.error("Route generation error:", err);
        res.status(500).json({ error: "Route generation failed", detail: String(err) });
    }
});
// GET /routes/purchased
router.get("/purchased", auth_1.requireAuth, (req, res) => {
    const db = (0, schema_1.getDb)();
    const rows = db
        .prepare(`SELECT r.* FROM routes r
       JOIN purchases p ON p.route_id = r.id
       WHERE p.buyer_id = ?
       ORDER BY p.purchased_at DESC`)
        .all(req.walletAddress);
    res.json({ routes: rows.map(rowToRoute) });
});
// GET /routes/:id
router.get("/:id", (req, res) => {
    const db = (0, schema_1.getDb)();
    const row = db
        .prepare(`SELECT * FROM routes WHERE id = ?`)
        .get(req.params.id);
    if (!row) {
        res.status(404).json({ error: "Route not found" });
        return;
    }
    const route = rowToRoute(row);
    // Fetch full stop content
    const itemIds = route.item_ids;
    const stops = itemIds
        .map((itemId) => {
        const itemRow = db
            .prepare(`SELECT * FROM content_items WHERE id = ?`)
            .get(itemId);
        return itemRow ? rowToContentItem(itemRow) : null;
    })
        .filter(Boolean);
    res.json({ ...route, stops });
});
// POST /routes/:id/prepare-purchase
router.post("/:id/prepare-purchase", auth_1.requireAuth, async (req, res) => {
    const db = (0, schema_1.getDb)();
    const row = db
        .prepare(`SELECT * FROM routes WHERE id = ?`)
        .get(req.params.id);
    if (!row) {
        res.status(404).json({ error: "Route not found" });
        return;
    }
    const route = rowToRoute(row);
    // Check not already purchased
    const existing = db
        .prepare(`SELECT id FROM purchases WHERE route_id = ? AND buyer_id = ?`)
        .get(route.id, req.walletAddress);
    if (existing) {
        res.status(400).json({ error: "Already purchased" });
        return;
    }
    try {
        // Register on-chain if not yet registered
        let contractRouteId = route.contract_route_id;
        if (!contractRouteId) {
            const { creators, sharesBps } = (0, curator_1.contributionsToBps)(route.contributions);
            contractRouteId = await (0, contract_1.registerRoute)(creators, sharesBps, route.price_og, route.route_hash || "0x" + "0".repeat(64));
            db.prepare(`UPDATE routes SET contract_route_id = ? WHERE id = ?`).run(contractRouteId, route.id);
        }
        const calldata = (0, contract_1.buildPurchaseCalldata)(contractRouteId);
        res.json({
            contractRouteId,
            priceWei: route.price_og,
            contractAddress: config_1.config.contract.address,
            calldata,
        });
    }
    catch (err) {
        console.error("Prepare purchase error:", err);
        res.status(500).json({ error: "Failed to prepare purchase", detail: String(err) });
    }
});
// POST /routes/:id/confirm-purchase
router.post("/:id/confirm-purchase", auth_1.requireAuth, async (req, res) => {
    const { txHash } = req.body;
    if (!txHash) {
        res.status(400).json({ error: "Missing txHash" });
        return;
    }
    const db = (0, schema_1.getDb)();
    const row = db
        .prepare(`SELECT * FROM routes WHERE id = ?`)
        .get(req.params.id);
    if (!row) {
        res.status(404).json({ error: "Route not found" });
        return;
    }
    const route = rowToRoute(row);
    if (!route.contract_route_id) {
        res.status(400).json({ error: "Route not yet registered on-chain" });
        return;
    }
    try {
        const verified = await (0, contract_1.verifyPurchaseTx)(txHash, route.contract_route_id, req.walletAddress);
        if (!verified) {
            res.status(400).json({ error: "Transaction not verified on-chain" });
            return;
        }
        const id = (0, uuid_1.v4)();
        db.prepare(`INSERT OR IGNORE INTO purchases (id, route_id, buyer_id, tx_hash, price_og, purchased_at)
       VALUES (?, ?, ?, ?, ?, ?)`).run(id, route.id, req.walletAddress, txHash, route.price_og, Date.now());
        // Return full route with stops
        const itemIds = route.item_ids;
        const stops = itemIds.map((itemId) => {
            const itemRow = db
                .prepare(`SELECT * FROM content_items WHERE id = ?`)
                .get(itemId);
            return itemRow ? rowToContentItem(itemRow) : null;
        }).filter(Boolean);
        res.json({ success: true, route: { ...route, stops } });
    }
    catch (err) {
        console.error("Confirm purchase error:", err);
        res.status(500).json({ error: "Purchase confirmation failed", detail: String(err) });
    }
});
// POST /routes/:id/store-verification
router.post("/:id/store-verification", auth_1.requireAuth, async (req, res) => {
    const { txHash, creditsNote, sourceMaterials } = req.body;
    if (!txHash) {
        res.status(400).json({ error: "Missing txHash" });
        return;
    }
    const db = (0, schema_1.getDb)();
    const routeRow = db
        .prepare(`SELECT * FROM routes WHERE id = ?`)
        .get(req.params.id);
    if (!routeRow) {
        res.status(404).json({ error: "Route not found" });
        return;
    }
    const route = rowToRoute(routeRow);
    const purchaseRow = db
        .prepare(`SELECT tx_hash, purchased_at FROM purchases WHERE route_id = ? AND buyer_id = ?`)
        .get(route.id, req.walletAddress);
    if (!purchaseRow || purchaseRow.tx_hash.toLowerCase() !== txHash.toLowerCase()) {
        res.status(400).json({ error: "No matching verified purchase found for this txHash and buyer" });
        return;
    }
    const itemRows = db
        .prepare(`SELECT id, title, creator_id, text_hash FROM content_items WHERE id IN (${route.item_ids.map(() => "?").join(",")})`)
        .all(...route.item_ids);
    const proofPayload = {
        type: "easywalks.verification.v1",
        routeId: route.id,
        routeHash: route.route_hash,
        contractRouteId: route.contract_route_id,
        buyer: req.walletAddress,
        payment: {
            txHash: purchaseRow.tx_hash,
            priceWei: route.price_og,
            purchasedAt: purchaseRow.purchased_at,
        },
        contributors: route.contributions,
        contentReferences: itemRows,
        sourceMaterials: sourceMaterials || [],
        creditsNote: creditsNote || "Credits attached by buyer in web frontend.",
        generatedAt: Date.now(),
    };
    try {
        const verificationHash = await (0, storage_1.uploadData)(Buffer.from(JSON.stringify(proofPayload), "utf8"));
        res.json({ verificationHash, proofPayload });
    }
    catch (err) {
        console.error("Store verification error:", err);
        res.status(500).json({ error: "Failed to store verification proof", detail: String(err) });
    }
});
exports.default = router;
//# sourceMappingURL=routeHandlers.js.map