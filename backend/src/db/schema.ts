import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { config } from "../config";

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    // Ensure data directory exists
    const dataDir = path.dirname(config.db.path);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    db = new Database(config.db.path);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initSchema(db);
  }
  return db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS creators (
      id           TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      bio          TEXT,
      avatar_hash  TEXT,
      created_at   INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS content_items (
      id           TEXT PRIMARY KEY,
      creator_id   TEXT NOT NULL REFERENCES creators(id),
      title        TEXT NOT NULL,
      description  TEXT NOT NULL,
      category     TEXT NOT NULL CHECK(category IN ('place','activity','eatery')),
      latitude     REAL NOT NULL,
      longitude    REAL NOT NULL,
      city         TEXT NOT NULL,
      tags         TEXT NOT NULL DEFAULT '[]',
      photo_hashes TEXT NOT NULL DEFAULT '[]',
      text_hash    TEXT NOT NULL DEFAULT '',
      created_at   INTEGER NOT NULL,
      status       TEXT NOT NULL DEFAULT 'active'
        CHECK(status IN ('active','flagged','removed'))
    );

    CREATE INDEX IF NOT EXISTS idx_content_city     ON content_items(city);
    CREATE INDEX IF NOT EXISTS idx_content_category ON content_items(category);
    CREATE INDEX IF NOT EXISTS idx_content_creator  ON content_items(creator_id);
    CREATE INDEX IF NOT EXISTS idx_content_status   ON content_items(status);

    CREATE TABLE IF NOT EXISTS routes (
      id                 TEXT PRIMARY KEY,
      title              TEXT NOT NULL,
      description        TEXT NOT NULL,
      city               TEXT NOT NULL,
      duration_mins      INTEGER,
      distance_km        REAL,
      item_ids           TEXT NOT NULL DEFAULT '[]',
      contributions      TEXT NOT NULL DEFAULT '{}',
      price_og           TEXT NOT NULL,
      route_hash         TEXT,
      contract_route_id  INTEGER,
      created_at         INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_routes_city ON routes(city);

    CREATE TABLE IF NOT EXISTS purchases (
      id           TEXT PRIMARY KEY,
      route_id     TEXT NOT NULL REFERENCES routes(id),
      buyer_id     TEXT NOT NULL,
      tx_hash      TEXT NOT NULL UNIQUE,
      price_og     TEXT NOT NULL,
      purchased_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_purchases_buyer ON purchases(buyer_id);
    CREATE INDEX IF NOT EXISTS idx_purchases_route ON purchases(route_id);

    CREATE TABLE IF NOT EXISTS auth_challenges (
      wallet_address TEXT PRIMARY KEY,
      challenge      TEXT NOT NULL,
      expires_at     INTEGER NOT NULL
    );
  `);
}
