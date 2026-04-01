import assert from "node:assert/strict";

type ConfigModule = typeof import("../config");

function loadConfigWithEnv(overrides: Record<string, string | undefined>) {
  const keys = ["OG_COMPUTE_URL", "OG_COMPUTE_TOKEN", "OG_COMPUTE_MODEL"] as const;
  const previous: Record<string, string | undefined> = {};

  for (const key of keys) {
    previous[key] = process.env[key];
    const value = overrides[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  delete require.cache[require.resolve("../config")];
  const loaded = require("../config") as ConfigModule;

  for (const key of keys) {
    const value = previous[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  return loaded.config;
}

function run() {
  const configured = loadConfigWithEnv({
    OG_COMPUTE_URL: "https://compute.example.com/v1",
    OG_COMPUTE_TOKEN: "token-123",
    OG_COMPUTE_MODEL: "gpt-4o-mini",
  });

  assert.equal(configured.compute.baseUrl, "https://compute.example.com/v1");
  assert.equal(configured.compute.authToken, "token-123");
  assert.equal(configured.compute.model, "gpt-4o-mini");

  const defaults = loadConfigWithEnv({
    OG_COMPUTE_URL: undefined,
    OG_COMPUTE_TOKEN: undefined,
    OG_COMPUTE_MODEL: undefined,
  });

  assert.equal(defaults.compute.baseUrl, "https://api.0g.ai/v1");
  assert.equal(defaults.compute.authToken, "");
  assert.equal(defaults.compute.model, "gpt-3.5-turbo");

  // Keep output short and CI-friendly.
  console.log("compute env smoke tests passed");
}

run();
