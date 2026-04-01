import { Indexer, ZgFile } from "@0gfoundation/0g-ts-sdk";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { config } from "../config";

function getProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(config.og.rpc);
}

function getSigner(): ethers.Wallet {
  if (!config.og.privateKey) {
    throw new Error("OG_PRIVATE_KEY not set");
  }
  return new ethers.Wallet(config.og.privateKey, getProvider());
}

function getIndexer(): Indexer {
  return new Indexer(config.og.indexer);
}

/**
 * Upload a file to 0G Storage.
 * Returns the merkle root hash (66-char hex string).
 */
export async function uploadFile(filePath: string): Promise<string> {
  const signer = getSigner();
  const indexer = getIndexer();

  const file = await ZgFile.fromFilePath(filePath);
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

  const [_result, uploadErr] = await indexer.upload(file, config.og.rpc, signer);
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
export async function uploadData(data: Buffer | string): Promise<string> {
  if (!fs.existsSync(config.mediaCache.dir)) {
    fs.mkdirSync(config.mediaCache.dir, { recursive: true });
  }

  const tmpFile = path.join(
    config.mediaCache.dir,
    `tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`
  );

  fs.writeFileSync(tmpFile, data);
  try {
    return await uploadFile(tmpFile);
  } finally {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  }
}

/**
 * Download a file from 0G Storage by its root hash to a local path.
 */
export async function downloadToFile(
  rootHash: string,
  outputPath: string
): Promise<void> {
  const indexer = getIndexer();
  const downloadErr = await indexer.download(rootHash, outputPath, false);
  if (downloadErr) {
    throw new Error(`Download failed: ${downloadErr}`);
  }
}

/**
 * Download and return data as a Buffer.
 */
export async function downloadData(rootHash: string): Promise<Buffer> {
  if (!fs.existsSync(config.mediaCache.dir)) {
    fs.mkdirSync(config.mediaCache.dir, { recursive: true });
  }

  const tmpFile = path.join(config.mediaCache.dir, `dl_${rootHash}`);
  await downloadToFile(rootHash, tmpFile);
  const data = fs.readFileSync(tmpFile);
  return data;
}
