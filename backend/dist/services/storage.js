"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadFile = uploadFile;
exports.uploadData = uploadData;
exports.downloadToFile = downloadToFile;
exports.downloadData = downloadData;
const _0g_ts_sdk_1 = require("@0gfoundation/0g-ts-sdk");
const ethers_1 = require("ethers");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const config_1 = require("../config");
function getProvider() {
    return new ethers_1.ethers.JsonRpcProvider(config_1.config.og.rpc);
}
function getSigner() {
    if (!config_1.config.og.privateKey) {
        throw new Error("OG_PRIVATE_KEY not set");
    }
    return new ethers_1.ethers.Wallet(config_1.config.og.privateKey, getProvider());
}
function getIndexer() {
    return new _0g_ts_sdk_1.Indexer(config_1.config.og.indexer);
}
/**
 * Upload a file to 0G Storage.
 * Returns the merkle root hash (66-char hex string).
 */
async function uploadFile(filePath) {
    const signer = getSigner();
    const indexer = getIndexer();
    const file = await _0g_ts_sdk_1.ZgFile.fromFilePath(filePath);
    const [tree, treeErr] = await file.merkleTree();
    if (treeErr || !tree) {
        await file.close();
        throw new Error(`Failed to build merkle tree: ${treeErr}`);
    }
    const rootHash = tree.rootHash();
    if (!rootHash) {
        await file.close();
        throw new Error("Empty root hash from merkle tree");
    }
    const [_result, uploadErr] = await indexer.upload(file, config_1.config.og.rpc, signer);
    await file.close();
    if (uploadErr) {
        throw new Error(`Upload failed: ${uploadErr}`);
    }
    return rootHash;
}
/**
 * Upload raw data (Buffer or string) to 0G Storage.
 * Returns the merkle root hash.
 */
async function uploadData(data) {
    if (!fs_1.default.existsSync(config_1.config.mediaCache.dir)) {
        fs_1.default.mkdirSync(config_1.config.mediaCache.dir, { recursive: true });
    }
    const tmpFile = path_1.default.join(config_1.config.mediaCache.dir, `tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`);
    fs_1.default.writeFileSync(tmpFile, data);
    try {
        return await uploadFile(tmpFile);
    }
    finally {
        if (fs_1.default.existsSync(tmpFile))
            fs_1.default.unlinkSync(tmpFile);
    }
}
/**
 * Download a file from 0G Storage by its root hash to a local path.
 */
async function downloadToFile(rootHash, outputPath) {
    const indexer = getIndexer();
    const downloadErr = await indexer.download(rootHash, outputPath, false);
    if (downloadErr) {
        throw new Error(`Download failed: ${downloadErr}`);
    }
}
/**
 * Download and return data as a Buffer.
 */
async function downloadData(rootHash) {
    if (!fs_1.default.existsSync(config_1.config.mediaCache.dir)) {
        fs_1.default.mkdirSync(config_1.config.mediaCache.dir, { recursive: true });
    }
    const tmpFile = path_1.default.join(config_1.config.mediaCache.dir, `dl_${rootHash}`);
    await downloadToFile(rootHash, tmpFile);
    const data = fs_1.default.readFileSync(tmpFile);
    return data;
}
//# sourceMappingURL=storage.js.map