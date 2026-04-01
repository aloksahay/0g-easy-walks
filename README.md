# EasyWalks

AI-curated walking tours on the 0G blockchain. Content creators upload place/eatery/activity descriptions for cities. An AI curator (0G Compute) generates personalized routes, and users purchase them with 0G tokens — creators get paid proportionally based on how much of their content made the cut.

## Architecture

```
iOS App (SwiftUI)  →  Node.js Backend  →  0G Blockchain
                                           ├── Storage (photos, content)
                                           ├── Compute (AI route curation)
                                           └── Chain (payment splitting)
```

## Quick Start

### 1. Deploy the Smart Contract

```bash
cd contracts
cp ../.env.example .env  # add OG_PRIVATE_KEY
npm install
npx hardhat test                          # run tests first
npx hardhat run scripts/deploy.ts --network galileo
# Copy the deployed address → set CONTRACT_ADDRESS in backend/.env
```

### 2. Start the Backend

```bash
cd backend
cp .env.example .env   # fill in OG_PRIVATE_KEY, CONTRACT_ADDRESS, OG_COMPUTE_TOKEN
npm install
ts-node src/seed.ts    # seed Tokyo sample data
npx ts-node src/index.ts
# Backend runs on http://localhost:3000
```

### 3. Open the iOS App

Open `ios/EasyWalks/EasyWalks.xcodeproj` in Xcode, set your team, and run on a device or simulator.

For device testing, expose the backend with ngrok:
```bash
ngrok http 3000
# Update APIClient.swift baseURL with the ngrok URL
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `OG_PRIVATE_KEY` | Wallet private key (backend hot wallet for contract calls) |
| `OG_RPC` | 0G Galileo RPC — `https://evmrpc-testnet.0g.ai` |
| `OG_INDEXER` | 0G Storage indexer — `https://indexer-storage-testnet-turbo.0g.ai` |
| `CONTRACT_ADDRESS` | Deployed `EasyWalksMarketplace` contract address |
| `OG_COMPUTE_TOKEN` | 0G Compute auth token |
| `JWT_SECRET` | Secret for JWT signing |

## Testnet Resources

- Faucet: https://faucet.0g.ai (0.1 OG/day) or https://cloud.google.com/application/web3/faucet/0g/galileo
- Chain Explorer: https://chainscan.0g.ai
- Storage Explorer: https://storagescan.0g.ai
- Chain ID: 16602

## HTTP client note

This project does **not** use axios. Recent npm releases axios@1.14.1 and axios@0.30.4 were compromised. All HTTP calls use Node.js built-in `fetch` (Node 18+). The 0G SDK pulls in `axios@0.27.2` transitively (not a compromised version).

## Project Structure

```
0g-easy-walks/
├── contracts/   Hardhat + EasyWalksMarketplace.sol
├── backend/     Node.js/Express/TypeScript API
├── ios/         SwiftUI iOS app
└── PLAN.md      Architecture plan
```
