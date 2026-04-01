/**
 * Upload a file to 0G Storage.
 * Returns the merkle root hash (66-char hex string).
 */
export declare function uploadFile(filePath: string): Promise<string>;
/**
 * Upload raw data (Buffer or string) to 0G Storage.
 * Returns the merkle root hash.
 */
export declare function uploadData(data: Buffer | string): Promise<string>;
/**
 * Download a file from 0G Storage by its root hash to a local path.
 */
export declare function downloadToFile(rootHash: string, outputPath: string): Promise<void>;
/**
 * Download and return data as a Buffer.
 */
export declare function downloadData(rootHash: string): Promise<Buffer>;
//# sourceMappingURL=storage.d.ts.map