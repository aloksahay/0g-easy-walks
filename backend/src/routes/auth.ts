import { Router, Request, Response } from "express";
import { ethers } from "ethers";
import jwt from "jsonwebtoken";
import { getDb } from "../db/schema";
import { config } from "../config";

const router = Router();

// POST /auth/challenge
router.post("/challenge", (req: Request, res: Response) => {
  const { walletAddress } = req.body as { walletAddress?: string };
  if (!walletAddress || !ethers.isAddress(walletAddress)) {
    res.status(400).json({ error: "Invalid wallet address" });
    return;
  }

  const challenge = `Sign this message to authenticate with EasyWalks.\n\nNonce: ${Math.random().toString(36).slice(2)}\nTimestamp: ${Date.now()}`;
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

  const db = getDb();
  db.prepare(
    `INSERT OR REPLACE INTO auth_challenges (wallet_address, challenge, expires_at)
     VALUES (?, ?, ?)`
  ).run(walletAddress.toLowerCase(), challenge, expiresAt);

  res.json({ challenge, expiresAt });
});

// POST /auth/verify
router.post("/verify", (req: Request, res: Response) => {
  const { walletAddress, signature, challenge } = req.body as {
    walletAddress?: string;
    signature?: string;
    challenge?: string;
  };

  if (!walletAddress || !signature || !challenge) {
    res.status(400).json({ error: "Missing walletAddress, signature, or challenge" });
    return;
  }

  const db = getDb();
  const row = db
    .prepare(
      `SELECT challenge, expires_at FROM auth_challenges WHERE wallet_address = ?`
    )
    .get(walletAddress.toLowerCase()) as
    | { challenge: string; expires_at: number }
    | undefined;

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
    const recovered = ethers.verifyMessage(challenge, signature);
    if (recovered.toLowerCase() !== walletAddress.toLowerCase()) {
      res.status(401).json({ error: "Signature verification failed" });
      return;
    }
  } catch {
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  // Ensure creator row exists
  const now = Date.now();
  db.prepare(
    `INSERT OR IGNORE INTO creators (id, display_name, bio, avatar_hash, created_at)
     VALUES (?, ?, NULL, NULL, ?)`
  ).run(walletAddress.toLowerCase(), walletAddress.slice(0, 10) + "...", now);

  // Clean up challenge
  db.prepare(`DELETE FROM auth_challenges WHERE wallet_address = ?`).run(
    walletAddress.toLowerCase()
  );

  const token = jwt.sign(
    { walletAddress: walletAddress.toLowerCase() },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn } as jwt.SignOptions
  );

  res.json({ token });
});

export default router;
