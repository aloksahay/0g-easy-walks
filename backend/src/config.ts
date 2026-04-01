import path from "path";

export const config = {
  port: process.env.PORT ? parseInt(process.env.PORT) : 3000,

  // JWT
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-in-production",
  jwtExpiresIn: "24h",

  // 0G Testnet (Galileo)
  og: {
    rpc: process.env.OG_RPC || "https://evmrpc-testnet.0g.ai",
    chainId: 16602,
    indexer:
      process.env.OG_INDEXER ||
      "https://indexer-storage-testnet-turbo.0g.ai",
    flowContract:
      process.env.OG_FLOW_CONTRACT ||
      "0x22E03a6A89B950F1c82ec5e74F8eCa321a105296",
    privateKey: process.env.OG_PRIVATE_KEY || "",
  },

  // Smart contract
  contract: {
    address: process.env.CONTRACT_ADDRESS || "",
  },

  // 0G Compute
  compute: {
    baseUrl:
      process.env.OG_COMPUTE_URL ||
      "https://api.0g.ai/v1",
    authToken: process.env.OG_COMPUTE_TOKEN || "",
    model: process.env.OG_COMPUTE_MODEL || "gpt-3.5-turbo",
  },

  // SQLite
  db: {
    path: process.env.DB_PATH || path.join(__dirname, "..", "data", "easywalk.db"),
  },

  // Media cache
  mediaCache: {
    dir: path.join(__dirname, "..", "data", "media"),
    maxAgeSeconds: 86400,
  },

  // Upload limits
  upload: {
    maxPhotos: 5,
    maxPhotoSizeMb: 10,
  },

  // Route pricing (in wei, 0.001 OG = 1e15 wei)
  routePrice: {
    base: "1000000000000000", // 0.001 OG in wei
  },
};
