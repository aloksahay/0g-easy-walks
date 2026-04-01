import { Router, Request, Response } from "express";
import { getDb } from "../db/schema";
import { requireAuth } from "../middleware/auth";
import { getCreatorBalance } from "../services/contract";

const router = Router();

// GET /creators/:wallet
router.get("/:wallet", (req: Request, res: Response) => {
  const wallet = (req.params.wallet as string).toLowerCase();
  const db = getDb();

  const creator = db
    .prepare(`SELECT * FROM creators WHERE id = ?`)
    .get(wallet) as Record<string, unknown> | undefined;

  if (!creator) {
    res.status(404).json({ error: "Creator not found" });
    return;
  }

  const totalContent = (
    db
      .prepare(`SELECT COUNT(*) as cnt FROM content_items WHERE creator_id = ? AND status = 'active'`)
      .get(wallet) as { cnt: number }
  ).cnt;

  // Count routes where this creator contributed
  const allRoutes = db
    .prepare(`SELECT contributions FROM routes`)
    .all() as Array<{ contributions: string }>;
  const routesUsedIn = allRoutes.filter((r) => {
    const contributions: Record<string, number> = JSON.parse(r.contributions);
    return wallet in contributions;
  }).length;

  res.json({
    profile: creator,
    stats: { totalContent, routesUsedIn },
  });
});

// GET /creators/:wallet/earnings
router.get("/:wallet/earnings", requireAuth, async (req: Request, res: Response) => {
  const wallet = (req.params.wallet as string).toLowerCase();
  if (req.walletAddress !== wallet) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  try {
    const unclaimed = await getCreatorBalance(wallet);
    res.json({ unclaimed });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch earnings", detail: String(err) });
  }
});

export default router;
