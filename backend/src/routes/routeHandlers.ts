import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../db/schema";
import { requireAuth } from "../middleware/auth";
import { uploadData } from "../services/storage";
import { registerRoute as registerOnChain, buildPurchaseCalldata, verifyPurchaseTx, hasPurchased } from "../services/contract";
import { curateRoute, buildGeneratedRoute, contributionsToBps } from "../services/curator";
import { ContentItem, GenerateRouteRequest, Route } from "../types";
import { config } from "../config";

const router = Router();

function rowToRoute(row: Record<string, unknown>): Route {
  return {
    id: row.id as string,
    title: row.title as string,
    description: row.description as string,
    city: row.city as string,
    duration_mins: row.duration_mins as number | null,
    distance_km: row.distance_km as number | null,
    item_ids: JSON.parse(row.item_ids as string),
    contributions: JSON.parse(row.contributions as string),
    price_og: row.price_og as string,
    route_hash: row.route_hash as string | null,
    contract_route_id: row.contract_route_id as number | null,
    created_at: row.created_at as number,
  };
}

function rowToContentItem(row: Record<string, unknown>): ContentItem {
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

// POST /routes/generate
router.post("/generate", requireAuth, async (req: Request, res: Response) => {
  const preferences = req.body as GenerateRouteRequest;

  if (!preferences.city || !preferences.duration || !preferences.categories?.length) {
    res.status(400).json({ error: "Missing required fields: city, duration, categories" });
    return;
  }

  try {
    const db = getDb();

    // Fetch candidate content items from this city
    const rows = db
      .prepare(
        `SELECT * FROM content_items
         WHERE LOWER(city) = LOWER(?) AND status = 'active'
         ORDER BY created_at DESC LIMIT 100`
      )
      .all(preferences.city) as Record<string, unknown>[];

    if (rows.length === 0) {
      res.status(404).json({ error: `No content found for city: ${preferences.city}` });
      return;
    }

    const items = rows.map(rowToContentItem);

    // AI curation
    const curated = await curateRoute(items, preferences, preferences.startLocation);

    const itemsById = new Map(items.map((i) => [i.id, i]));
    const routeId = uuidv4();
    const built = buildGeneratedRoute(routeId, curated, itemsById);

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

    let routeHash: string | null = null;
    try {
      routeHash = await uploadData(Buffer.from(routeJson, "utf8"));
    } catch (uploadErr) {
      console.warn("Failed to upload route to 0G Storage:", uploadErr);
    }

    const now = Date.now();
    const orderedItems = built.stops.map((s) => s.contentItem);

    db.prepare(
      `INSERT INTO routes
       (id, title, description, city, duration_mins, distance_km, item_ids, contributions, price_og, route_hash, contract_route_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`
    ).run(
      routeId,
      built.title,
      built.description,
      preferences.city,
      built.totalDuration,
      built.distance,
      JSON.stringify(orderedItems.map((i) => i.id)),
      JSON.stringify(built.contributions),
      config.routePrice.base,
      routeHash,
      now
    );

    res.json({
      route: {
        id: routeId,
        title: built.title,
        description: built.description,
        stops: built.stops,
        totalDuration: built.totalDuration,
        totalDistance: built.distance,
        contributions: built.contributions,
        priceOg: config.routePrice.base,
      },
    });
  } catch (err) {
    console.error("Route generation error:", err);
    res.status(500).json({ error: "Route generation failed", detail: String(err) });
  }
});

// GET /routes/purchased
router.get("/purchased", requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT r.* FROM routes r
       JOIN purchases p ON p.route_id = r.id
       WHERE p.buyer_id = ?
       ORDER BY p.purchased_at DESC`
    )
    .all(req.walletAddress!) as Record<string, unknown>[];
  res.json({ routes: rows.map(rowToRoute) });
});

// GET /routes/:id
router.get("/:id", (req: Request, res: Response) => {
  const db = getDb();
  const row = db
    .prepare(`SELECT * FROM routes WHERE id = ?`)
    .get(req.params.id) as Record<string, unknown> | undefined;

  if (!row) {
    res.status(404).json({ error: "Route not found" });
    return;
  }

  const route = rowToRoute(row);

  // Fetch full stop content
  const itemIds: string[] = route.item_ids;
  const stops = itemIds
    .map((itemId) => {
      const itemRow = db
        .prepare(`SELECT * FROM content_items WHERE id = ?`)
        .get(itemId) as Record<string, unknown> | undefined;
      return itemRow ? rowToContentItem(itemRow) : null;
    })
    .filter(Boolean);

  res.json({ ...route, stops });
});

// POST /routes/:id/prepare-purchase
router.post("/:id/prepare-purchase", requireAuth, async (req: Request, res: Response) => {
  const db = getDb();
  const row = db
    .prepare(`SELECT * FROM routes WHERE id = ?`)
    .get(req.params.id) as Record<string, unknown> | undefined;

  if (!row) {
    res.status(404).json({ error: "Route not found" });
    return;
  }

  const route = rowToRoute(row);

  // Check not already purchased
  const existing = db
    .prepare(`SELECT id FROM purchases WHERE route_id = ? AND buyer_id = ?`)
    .get(route.id, req.walletAddress!) as { id: string } | undefined;
  if (existing) {
    res.status(400).json({ error: "Already purchased" });
    return;
  }

  try {
    // Register on-chain if not yet registered
    let contractRouteId = route.contract_route_id;
    if (!contractRouteId) {
      const { creators, sharesBps } = contributionsToBps(route.contributions);
      contractRouteId = await registerOnChain(
        creators,
        sharesBps,
        route.price_og,
        route.route_hash || "0x" + "0".repeat(64)
      );

      db.prepare(`UPDATE routes SET contract_route_id = ? WHERE id = ?`).run(
        contractRouteId,
        route.id
      );
    }

    const calldata = buildPurchaseCalldata(contractRouteId);

    res.json({
      contractRouteId,
      priceWei: route.price_og,
      contractAddress: config.contract.address,
      calldata,
    });
  } catch (err) {
    console.error("Prepare purchase error:", err);
    res.status(500).json({ error: "Failed to prepare purchase", detail: String(err) });
  }
});

// POST /routes/:id/confirm-purchase
router.post("/:id/confirm-purchase", requireAuth, async (req: Request, res: Response) => {
  const { txHash } = req.body as { txHash?: string };
  if (!txHash) {
    res.status(400).json({ error: "Missing txHash" });
    return;
  }

  const db = getDb();
  const row = db
    .prepare(`SELECT * FROM routes WHERE id = ?`)
    .get(req.params.id) as Record<string, unknown> | undefined;

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
    const verified = await verifyPurchaseTx(txHash, route.contract_route_id, req.walletAddress!);
    if (!verified) {
      res.status(400).json({ error: "Transaction not verified on-chain" });
      return;
    }

    const id = uuidv4();
    db.prepare(
      `INSERT OR IGNORE INTO purchases (id, route_id, buyer_id, tx_hash, price_og, purchased_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, route.id, req.walletAddress!, txHash, route.price_og, Date.now());

    // Return full route with stops
    const itemIds: string[] = route.item_ids;
    const stops = itemIds.map((itemId) => {
      const itemRow = db
        .prepare(`SELECT * FROM content_items WHERE id = ?`)
        .get(itemId) as Record<string, unknown> | undefined;
      return itemRow ? rowToContentItem(itemRow) : null;
    }).filter(Boolean);

    res.json({ success: true, route: { ...route, stops } });
  } catch (err) {
    console.error("Confirm purchase error:", err);
    res.status(500).json({ error: "Purchase confirmation failed", detail: String(err) });
  }
});

export default router;
