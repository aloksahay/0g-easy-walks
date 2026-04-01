"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
function loadConfigWithEnv(overrides) {
    const keys = ["OG_COMPUTE_URL", "OG_COMPUTE_TOKEN", "OG_COMPUTE_MODEL"];
    const previous = {};
    for (const key of keys) {
        previous[key] = process.env[key];
        const value = overrides[key];
        if (value === undefined) {
            delete process.env[key];
        }
        else {
            process.env[key] = value;
        }
    }
    delete require.cache[require.resolve("../config")];
    const loaded = require("../config");
    for (const key of keys) {
        const value = previous[key];
        if (value === undefined) {
            delete process.env[key];
        }
        else {
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
    strict_1.default.equal(configured.compute.baseUrl, "https://compute.example.com/v1");
    strict_1.default.equal(configured.compute.authToken, "token-123");
    strict_1.default.equal(configured.compute.model, "gpt-4o-mini");
    const defaults = loadConfigWithEnv({
        OG_COMPUTE_URL: undefined,
        OG_COMPUTE_TOKEN: undefined,
        OG_COMPUTE_MODEL: undefined,
    });
    strict_1.default.equal(defaults.compute.baseUrl, "https://api.0g.ai/v1");
    strict_1.default.equal(defaults.compute.authToken, "");
    strict_1.default.equal(defaults.compute.model, "gpt-3.5-turbo");
    // Keep output short and CI-friendly.
    console.log("compute env smoke tests passed");
}
run();
//# sourceMappingURL=computeEnv.test.js.map