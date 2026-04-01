# EasyWalks: Walking Tour Marketplace on 0G

## Context

Build an iOS app for a hackathon where content creators upload place/activity/eatery descriptions + photos for cities, stored on 0G decentralized storage. An AI curator (0G Compute) generates custom walking routes from user preferences. Users purchase routes with 0G tokens via a smart contract that proportionally compensates creators based on how many stops they contributed.

**Stack**: iOS (Swift/SwiftUI) + Node.js/TypeScript backend + Solidity smart contract + 0G blockchain (storage, compute, chain)

**Scope**: Working MVP — end-to-end flow, rough UI is fine.

---

## Architecture

```
iOS App (Swift/SwiftUI)
  ├── Creator: upload content + view earnings
  ├── Explorer: set preferences → AI route → purchase → navigate
  └── Wallet: MetaMask deep link for signing transactions
        │
        │ REST API
        ▼
Node.js/Express Backend
  ├── 0G Storage SDK  → upload/download photos + text
  ├── 0G Compute      → OpenAI-compatible LLM for route curation
  ├── ethers.js        → smart contract interaction
  └── SQLite           → indexes, search, caching
        │
        ▼
0G Blockchain (Galileo Testnet, Chain ID 16602)
  ├── Storage: immutable content blobs (photos, descriptions)
  ├── Compute: AI inference for route generation
  └── Chain: EasyWalksMarketplace.sol (payment splitting)
```

**Key decision**: Backend proxies all 0G interactions. iOS app never touches 0G directly — keeps mobile client thin, avoids embedding private keys.

**HTTP client**: Use Node.js built-in `fetch` (Node 18+). Do NOT use axios — recent npm versions (axios@1.14.1, axios@0.30.4) were compromised.

---

## Data Model

### SQLite (backend index)

- **creators**: `id` (wallet addr), `display_name`, `bio`, `avatar_hash`, `created_at`
- **content_items**: `id` (uuid), `creator_id`, `title`, `description`, `category` (place|activity|eatery), `lat`, `lng`, `city`, `tags` (JSON), `photo_hashes` (JSON array of 0G root hashes), `text_hash`, `created_at`
- **routes**: `id` (uuid), `title`, `description`, `city`, `duration_mins`, `distance_km`, `item_ids` (JSON array, ordered), `contributions` (JSON: {creator_id: share_pct}), `price_og` (wei string), `route_hash`, `contract_route_id`, `created_at`
- **purchases**: `id`, `route_id`, `buyer_id` (wallet), `tx_hash`, `price_og`, `purchased_at`

### 0G Storage

- Photos: uploaded as files, get merkle root hash back
- Content descriptions: uploaded as JSON blobs
- Full route definitions: uploaded as JSON blobs

### Why SQLite Still Exists

`backend/data/easywalk.db` is an **index + operational state DB**, not the source of truth for media/content blobs.

- **0G Storage is canonical for blobs**: photos, description payloads, and full route JSON.
- **SQLite stores pointers + queryable metadata**: city/category/tags, creator relationships, contributions, and hash references (`photo_hashes`, `text_hash`, `route_hash`).
- **SQLite also stores app state**: auth challenges, generated route rows, purchase rows, and cached/search-friendly records needed for fast API responses.

This split is intentional: decentralized immutable storage for content, plus fast relational querying for product UX and purchase orchestration.

### Smart Contract (on-chain)

- `routes[routeId]` → `{creators[], sharesBps[], priceWei, routeHash, active}`
- `purchased[buyer][routeId]` → bool
- `creatorBalance[wallet]` → uint256

---

## Smart Contract: `EasyWalksMarketplace.sol`

```solidity
// Key functions:
registerRoute(creators[], sharesBps[], priceWei, routeHash) → routeId  // owner only
purchaseRoute(routeId) payable  // splits payment: platform fee + proportional to creators
withdrawEarnings()  // pull pattern, creator withdraws accumulated balance
hasPurchased(buyer, routeId) → bool
```

- `sharesBps`: basis points (sum to 10000) for precise splitting
- Pull-over-push pattern for creator withdrawals (safe against reentrancy)
- Only backend (owner) registers routes — prevents spam, ensures honest share computation
- Contribution shares: simple formula — each stop contributes equally (3/5 stops = 60%)

---

## Backend API Endpoints

```
POST /api/v1/auth/challenge          → { challenge }
POST /api/v1/auth/verify             → { jwt token }

POST /api/v1/content                 → multipart upload (photos + metadata) → stores on 0G
GET  /api/v1/content?city=&category= → list/search content
GET  /api/v1/content/:id             → single item
GET  /api/v1/content/creator/:wallet → creator's content

POST /api/v1/routes/generate         → { city, duration, categories, interests } → AI route
GET  /api/v1/routes/:id              → route details
GET  /api/v1/routes/purchased        → user's purchased routes
POST /api/v1/routes/:id/prepare-purchase → { contractRouteId, priceWei, calldata }
POST /api/v1/routes/:id/confirm-purchase → { txHash } → verifies on-chain

GET  /api/v1/creators/:wallet        → profile + stats
GET  /api/v1/creators/:wallet/earnings → balance info

GET  /api/v1/media/:rootHash         → proxy download from 0G Storage (cached)
```

---

## iOS App Screens

**Explorer flow**: Preferences → Route Preview (map + stops) → Purchase → Navigation (step-through stops)
**Creator flow**: My Content (list + stats) → Upload Content (photos, location, tags) → Earnings (balance + withdraw)
**Auth**: Connect wallet via MetaMask deep link

---

## Folder Structure

```
0g-easy-walks/
├── contracts/                    # Hardhat + Solidity
│   ├── contracts/EasyWalksMarketplace.sol
│   ├── scripts/deploy.ts
│   ├── test/EasyWalksMarketplace.test.ts
│   └── hardhat.config.ts
├── backend/                      # Node.js/Express/TypeScript
│   └── src/
│       ├── index.ts              # express app
│       ├── config.ts             # env vars, 0G constants
│       ├── db/schema.ts          # SQLite setup
│       ├── routes/{auth,content,routes,creators,media}.ts
│       ├── services/{storage,compute,contract,curator}.ts
│       ├── middleware/{auth,upload}.ts
│       └── types/index.ts
├── ios/EasyWalks/                # SwiftUI app
│   ├── Models/{ContentItem,Route,Creator,User}.swift
│   ├── Views/Explorer/{Preferences,RoutePreview,Navigation,MyRoutes}View.swift
│   ├── Views/Creator/{MyContent,UploadContent,Earnings}View.swift
│   ├── Views/Auth/ConnectWalletView.swift
│   ├── ViewModels/{Auth,Explorer,Creator,Wallet}ViewModel.swift
│   └── Services/{APIClient,WalletService}.swift
└── docs/
```

---

## Status

### ✅ Done

**Phase 1 — Smart Contract** (`contracts/`)
- `EasyWalksMarketplace.sol` written and tested (17/17 tests passing)
- Deployed to Galileo testnet: `0x65C7aC5A1261025868E85fE6dA23A1e4e55517D9`
- Owner wallet: `0x37be1Dcf06eb1abe9168F6467A6fD3476E541263`
- Platform fee: 5% · `CONTRACT_ADDRESS` set in `backend/.env`

**Phase 2 — Backend Foundation** (`backend/src/`)
- Express + TypeScript project, SQLite schema, all tables created
- `services/storage.ts` — 0G Storage SDK wrapper (upload file/data, download)
- `config.ts` — all env vars wired up

**Phase 3 — Backend APIs**
- Auth: wallet challenge/verify → JWT (`routes/auth.ts`)
- Content: multipart upload → 0G Storage → SQLite (`routes/content.ts`)
- Content listing/search with city + category filters
- Media proxy with disk cache (`routes/media.ts`)
- Creator profile + stats (`routes/creators.ts`)

**Phase 4 — AI Route Curation**
- `services/compute.ts` — 0G Compute OpenAI-compatible client (built-in `fetch`, no axios)
- `services/curator.ts` — prompt engineering, contribution share calc, nearest-neighbor fallback
- `POST /routes/generate` end-to-end

**Phase 5 — Purchase Flow**
- `services/contract.ts` — ethers.js register/verify/calldata
- `POST /routes/:id/prepare-purchase` and `confirm-purchase` endpoints
- Fix: added missing `RouteRegistered` ABI event so prepare-purchase can decode route IDs from tx receipts

**Phase 6 — iOS App** (`ios/EasyWalks/`)
- 18 Swift files + `EasyWalks.xcodeproj` created
- Models, APIClient, WalletService (MetaMask deep links)
- Explorer: PreferencesView → RoutePreviewView (MapKit) → NavigationWalkView → MyRoutesView
- Creator: UploadContentView (PhotosPicker + map pin) → MyContentView → EarningsView
- Auth: ConnectWalletView (address input + MetaMask sign)

**Seed data** — 9 Tokyo locations across 3 mock creators (`backend/src/seed.ts`)

**Phase 7 — End-to-end validation updates**
- Switched storage SDK from `@0glabs/0g-ts-sdk` to `@0gfoundation/0g-ts-sdk` in backend
- Verified route generation + storage upload success after SDK change
- Added Cannes scenario E2E script (`backend/src/tests/cannesE2E.test.ts`) and npm script `test:cannes-e2e`
- Validated full flow with two creators (`NPC_1_KEY`, `NPC_2_KEY`) + buyer:
  upload content → generate Cannes route → prepare purchase → on-chain purchase → confirm purchase → creator balances increase

---

### 🔲 Still To Do

**1. Configure 0G Compute token**
- Get an auth token from the 0G Compute network
- Set `OG_COMPUTE_TOKEN` in `backend/.env`
- Or leave blank to use the nearest-neighbor fallback for demos

**2. Start the backend and seed data**
```bash
cd backend
ts-node src/seed.ts        # populate Tokyo sample content
ts-node src/index.ts       # start on :3000
```
Verify: `curl http://localhost:3000/api/v1/content?city=Tokyo`

**3. Test route generation end-to-end (curl/Postman)**
```bash
# Auth
curl -X POST localhost:3000/api/v1/auth/challenge -d '{"walletAddress":"0x..."}' -H 'Content-Type: application/json'
# Sign the challenge in MetaMask, then:
curl -X POST localhost:3000/api/v1/auth/verify -d '{"walletAddress":"...","signature":"...","challenge":"..."}' -H 'Content-Type: application/json'

# Generate route
curl -X POST localhost:3000/api/v1/routes/generate \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"city":"Tokyo","duration":"2h","categories":["place","eatery"],"interests":["History","Street Food"]}'
```

**4. Open the iOS app in Xcode**
- Open `ios/EasyWalks/EasyWalks.xcodeproj`
- Set your development team in signing settings
- Update `APIClient.swift` `baseURL` if testing on device (use ngrok: `ngrok http 3000`)
- Build and run on simulator or device (iOS 17+)

**4.5. Reproduce Cannes 2-creator E2E (backend-only smoke)**
```bash
cd backend
# Ensure backend/.env includes: NPC_1_KEY, NPC_2_KEY, OG_PRIVATE_KEY (and CONTRACT_ADDRESS)
DOTENV_CONFIG_PATH=.env PORT=3000 node -r dotenv/config -r ts-node/register src/index.ts
```

In a second terminal:
```bash
cd backend
DOTENV_CONFIG_PATH=.env API_BASE_URL=http://127.0.0.1:3000 \
  node -r dotenv/config -r ts-node/register src/tests/cannesE2E.test.ts
```

Expected output includes:
- `Cannes E2E passed`
- `Contributions: { ...creator1..., ...creator2... }`
- non-zero creator balance deltas

**5. Test the purchase flow**
- Generate a route, tap "Purchase Route"
- MetaMask deep link opens — confirm the tx
- Copy the tx hash, paste into confirm endpoint
- Verify creator balances on https://chainscan.0g.ai

**6. Demo prep**
- Upload 2–3 real photos via the creator flow (or via curl) to get real 0G Storage hashes
- Pre-fund demo wallets (faucet: https://faucet.0g.ai or https://cloud.google.com/application/web3/faucet/0g/galileo)
- Set route prices low: `routePrice.base = "1000000000000000"` (0.001 OG) — already set

---

### Known issues / gotchas

- **0G Compute docs are sparse** — if `OG_COMPUTE_TOKEN` auth fails, the curator falls back to nearest-neighbor automatically. Check logs for `"0G Compute unavailable, falling back"`.
- **MetaMask deep link on iOS** — the `purchaseRoute` flow opens MetaMask, user signs, but there's no automatic callback with `txHash`. For demo: copy txHash from MetaMask and call `confirm-purchase` manually (or via Postman). A proper WalletConnect integration would automate this.
- **`@types/express` v5** is installed but the project uses Express 5, which has some API differences (route params typed differently). All `req.params.x` casts use `as string` to work around this.
- **hardhat.config.ts** loads `../backend/.env` via dotenv — if you move the `.env` file, update that path.

---

## Key Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| 0G Compute slow/unavailable | Fallback to nearest-neighbor route ordering (no AI) |
| 0G Storage upload latency | Compress photos to 800px max; pre-upload demo content; aggressive caching |
| Wallet integration complexity on iOS | Use MetaMask deep links with pre-filled tx data instead of WalletConnect SDK |
| Testnet faucet limit (0.1 OG/day) | Pre-fund wallets; set route prices very low (0.001 OG); use Google Cloud faucet too |
| Smart contract bugs | Thorough Hardhat tests; simple contract with no upgradability patterns |
| Time pressure (3 components) | Each phase is independently testable; can demo backend via curl/Postman if iOS isn't ready |

---

## Verification Plan

1. **Contract**: Hardhat test suite — register route, purchase, verify balances, withdraw
2. **Backend**: curl/Postman through each endpoint; verify 0G Storage uploads appear on storagescan.0g.ai
3. **iOS**: Manual testing — full creator upload flow, full explorer purchase flow
4. **End-to-end**: Upload 5 places → generate route → purchase → check creator balances on-chain via chainscan.0g.ai
