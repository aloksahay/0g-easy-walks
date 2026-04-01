import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

// Load from backend/.env since that's where the keys live
dotenv.config({ path: "../backend/.env" });

const privateKey = process.env.OG_PRIVATE_KEY;

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "cancun",
    },
  },
  networks: {
    galileo: {
      url: process.env.OG_RPC || "https://evmrpc-testnet.0g.ai",
      chainId: 16602,
      accounts: privateKey ? [privateKey] : [],
    },
  },
};

export default config;
