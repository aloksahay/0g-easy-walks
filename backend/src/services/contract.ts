import { ethers } from "ethers";
import { config } from "../config";

const ABI = [
  "function registerRoute(address[] calldata creators, uint16[] calldata sharesBps, uint256 priceWei, bytes32 routeHash) external returns (uint256 routeId)",
  "function purchaseRoute(uint256 routeId) external payable",
  "function withdrawEarnings() external",
  "function hasPurchased(address buyer, uint256 routeId) external view returns (bool)",
  "function getRoute(uint256 routeId) external view returns (address[] creators, uint16[] sharesBps, uint256 priceWei, bytes32 routeHash, bool active)",
  "function creatorBalance(address) external view returns (uint256)",
  "function deactivateRoute(uint256 routeId) external",
  "event RouteRegistered(uint256 indexed routeId, uint256 price, uint8 creatorCount)",
  "event RoutePurchased(uint256 indexed routeId, address indexed buyer, uint256 price)",
];

function getContract(signerOrProvider?: ethers.Signer | ethers.Provider) {
  if (!config.contract.address) {
    throw new Error("CONTRACT_ADDRESS not configured");
  }
  const provider = new ethers.JsonRpcProvider(config.og.rpc);
  const runner = signerOrProvider || provider;
  return new ethers.Contract(config.contract.address, ABI, runner);
}

function getSigner(): ethers.Wallet {
  if (!config.og.privateKey) {
    throw new Error("OG_PRIVATE_KEY not configured");
  }
  const provider = new ethers.JsonRpcProvider(config.og.rpc);
  return new ethers.Wallet(config.og.privateKey, provider);
}

/**
 * Register a route on-chain. Returns the on-chain route ID.
 */
export async function registerRoute(
  creators: string[],
  sharesBps: number[],
  priceWei: string,
  routeHash: string // 66-char hex 0G storage hash
): Promise<number> {
  const signer = getSigner();
  const contract = getContract(signer);

  // Convert 0G 66-char hex hash to bytes32 (take first 32 bytes = 64 hex chars + '0x')
  const hashBytes32 = routeHash.length >= 66
    ? ("0x" + routeHash.replace("0x", "").slice(0, 64)) as `0x${string}`
    : ethers.zeroPadBytes(routeHash as `0x${string}`, 32) as `0x${string}`;

  const tx = await contract.registerRoute(
    creators,
    sharesBps,
    BigInt(priceWei),
    hashBytes32
  );
  const receipt = await tx.wait();

  // Parse RouteRegistered event to get routeId
  const iface = new ethers.Interface(ABI);
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed?.name === "RouteRegistered") {
        return Number(parsed.args.routeId);
      }
    } catch {
      // not our event
    }
  }

  throw new Error("RouteRegistered event not found in receipt");
}

/**
 * Build the calldata for purchaseRoute so the frontend wallet can sign it.
 */
export function buildPurchaseCalldata(routeId: number): string {
  const iface = new ethers.Interface(ABI);
  return iface.encodeFunctionData("purchaseRoute", [routeId]);
}

/**
 * Verify a purchase transaction on-chain.
 * Returns true if the tx emitted RoutePurchased for the given routeId and buyer.
 */
export async function verifyPurchaseTx(
  txHash: string,
  routeId: number,
  buyerAddress: string
): Promise<boolean> {
  const provider = new ethers.JsonRpcProvider(config.og.rpc);
  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt || receipt.status !== 1) return false;

  const iface = new ethers.Interface(ABI);
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (
        parsed?.name === "RoutePurchased" &&
        Number(parsed.args.routeId) === routeId &&
        parsed.args.buyer.toLowerCase() === buyerAddress.toLowerCase()
      ) {
        return true;
      }
    } catch {
      // not our event
    }
  }
  return false;
}

/**
 * Get a creator's unclaimed earnings balance.
 */
export async function getCreatorBalance(walletAddress: string): Promise<string> {
  const contract = getContract();
  const balance = await contract.creatorBalance(walletAddress);
  return balance.toString();
}

/**
 * Check if a buyer has purchased a route.
 */
export async function hasPurchased(
  buyerAddress: string,
  routeId: number
): Promise<boolean> {
  const contract = getContract();
  return contract.hasPurchased(buyerAddress, routeId);
}
