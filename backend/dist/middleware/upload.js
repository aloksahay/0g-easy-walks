"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadMiddleware = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const config_1 = require("../config");
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, os_1.default.tmpdir());
    },
    filename: (_req, file, cb) => {
        const ext = path_1.default.extname(file.originalname);
        cb(null, `upload_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
    },
});
function fileFilter(_req, file, cb) {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) {
        cb(null, true);
    }
    else {
        cb(new Error("Only JPEG, PNG, and WebP images are allowed"));
    }
}
exports.uploadMiddleware = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: {
        fileSize: config_1.config.upload.maxPhotoSizeMb * 1024 * 1024,
        files: config_1.config.upload.maxPhotos,
    },
});
//# sourceMappingURL=upload.js.map