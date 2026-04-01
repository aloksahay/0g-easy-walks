/**
 * Register a route on-chain. Returns the on-chain route ID.
 */
export declare function registerRoute(creators: string[], sharesBps: number[], priceWei: string, routeHash: string): Promise<number>;
/**
 * Build the calldata for purchaseRoute so the frontend wallet can sign it.
 */
export declare function buildPurchaseCalldata(routeId: number): string;
/**
 * Verify a purchase transaction on-chain.
 * Returns true if the tx emitted RoutePurchased for the given routeId and buyer.
 */
export declare function verifyPurchaseTx(txHash: string, routeId: number, buyerAddress: string): Promise<boolean>;
/**
 * Get a creator's unclaimed earnings balance.
 */
export declare function getCreatorBalance(walletAddress: string): Promise<string>;
/**
 * Check if a buyer has purchased a route.
 */
export declare function hasPurchased(buyerAddress: string, routeId: number): Promise<boolean>;
//# sourceMappingURL=contract.d.ts.map