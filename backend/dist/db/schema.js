"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDb = getDb;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const config_1 = require("../config");
let db;
function getDb() {
    if (!db) {
        // Ensure data directory exists
        const dataDir = path_1.default.dirname(config_1.config.db.path);
        if (!fs_1.default.existsSync(dataDir)) {
            fs_1.default.mkdirSync(dataDir, { recursive: true });
        }
        db = new better_sqlite3_1.default(config_1.config.db.path);
        db.pragma("journal_mode = WAL");
        db.pragma("foreign_keys = ON");
        initSchema(db);
    }
    return db;
}
function initSchema(db) {
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
//# sourceMappingURL=schema.js.map