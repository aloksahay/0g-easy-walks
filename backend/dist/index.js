"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const config_1 = require("./config");
const schema_1 = require("./db/schema");
const auth_1 = __importDefault(require("./routes/auth"));
const content_1 = __importDefault(require("./routes/content"));
const routeHandlers_1 = __importDefault(require("./routes/routeHandlers"));
const creators_1 = __importDefault(require("./routes/creators"));
const media_1 = __importDefault(require("./routes/media"));
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// CORS for dev
app.use((_req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    next();
});
// Health check
app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: Date.now() });
});
// API routes
app.use("/api/v1/auth", auth_1.default);
app.use("/api/v1/content", content_1.default);
app.use("/api/v1/routes", routeHandlers_1.default);
app.use("/api/v1/creators", creators_1.default);
app.use("/api/v1/media", media_1.default);
// Initialize DB on startup
(0, schema_1.getDb)();
app.listen(config_1.config.port, () => {
    console.log(`EasyWalks backend running on port ${config_1.config.port}`);
    console.log(`0G RPC: ${config_1.config.og.rpc}`);
    console.log(`Contract: ${config_1.config.contract.address || "(not configured)"}`);
});
exports.default = app;
//# sourceMappingURL=index.js.map