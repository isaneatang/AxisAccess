# AxisPass

**NFT Access Infrastructure**

AxisPass is an NFT-based access-pass creation platform running on BOT Chain Testnet. A product owner creates an NFT collection representing access to a product, service, AI model, SaaS platform, membership, community, API or course. The NFT itself proves entitlement. Buyers mint passes from a public mint page, then view, send and burn them from My Passes.

Built for the BOT Chain Builder Challenge #2 (AI Native + RWA applications on BOT Chain).

---

## Table of contents

1. [Project overview](#project-overview)
2. [Architecture](#architecture)
3. [Installation](#installation)
4. [Environment variables](#environment-variables)
5. [Development](#development)
6. [Production build](#production-build)
7. [BOT Chain Testnet](#bot-chain-testnet)
8. [Smart contract](#smart-contract)
9. [Vercel deployment](#vercel-deployment)
10. [Mobile wallet testing](#mobile-wallet-testing)
11. [Known limitations](#known-limitations)
12. [Future roadmap](#future-roadmap)

---

## Project overview

The core idea:

> Create an NFT access pass in minutes.

- **Creator flow**: connect wallet -> create product -> set tier/price/supply -> deploy a real ERC-721 contract from the wallet -> share the mint link / QR -> manage the collection (gift, withdraw, update metadata).
- **Buyer flow**: open the public mint page -> connect wallet -> mint a pass (pays in BOT) -> see it in My Passes -> send or burn it.
- **Future**: an AxisPass SDK lets external websites check "does this wallet own an AxisPass NFT from this collection?" That SDK is NOT built in this MVP.

Everything is real: real contracts deployed from the user's wallet, real transactions, real on-chain reads. There is no mock blockchain data, no fake addresses, no backend.

## Architecture

```
AxisPass
   |
   v
Reown AppKit (WalletConnect infrastructure)
   |  wallet selection, QR pairing, mobile deep links,
   |  injected wallets, session restore, session events
   v
EIP-1193 provider (useAppKitProvider)
   |
   v
viem (reads + writes)
   |
   v
BOT Chain Testnet
```

Key design decisions:

- **Reown AppKit is the only wallet layer.** No `window.ethereum` as the primary mechanism, no hand-rolled WalletConnect provider, no MetaMask-specific code. Reown owns the connection/session layer; viem owns the blockchain layer.
- **Centralized wallet state** in `src/context/WalletContext.jsx`. Pages never touch providers or wire their own session events; they consume the context. This prevents stale state and the mobile session problems the previous version suffered.
- **Custom network via viem `defineChain`.** BOT Chain Testnet (chain 968) is the only ACTIVE network. Mainnet (677) is configured but dormant; flipping `ACTIVE_NETWORK_KEY` in `src/config/chains.js` activates it later without code rewrites.
- **No backend.** LocalStorage is used only as a UI convenience registry (clearly labeled as such), never as proof of ownership. The contract's `owner()` is authoritative.

### Project structure

```
.
├── index.html
├── package.json
├── vite.config.js
├── vercel.json
├── .env.example
├── contracts/
│   └── AccessPass.sol            # ERC-721 access pass collection
├── scripts/
│   └── compile-contract.js       # solc-js -> src/blockchain/artifact.js
└── src/
    ├── main.jsx                  # entry: Wagmi + QueryClient providers
    ├── App.jsx                   # router, navbar, footer
    ├── index.css                 # dark green design system
    ├── config/
    │   ├── chains.js             # BOT Chain config + ACTIVE_NETWORK_KEY
    │   ├── reown.js              # Reown AppKit setup (WagmiAdapter)
    │   └── constants.js          # app constants, mint URL builder
    ├── blockchain/
    │   ├── clients.js            # viem public/wallet client factories
    │   ├── wallet.js             # thin wallet helpers
    │   ├── contract.js           # all AccessPass contract interactions
    │   └── artifact.js           # AUTO-GENERATED ABI + bytecode
    ├── context/
    │   └── WalletContext.jsx     # centralized wallet state
    ├── components/
    │   ├── Navbar.jsx
    │   ├── WalletButton.jsx
    │   ├── WalletModal.jsx
    │   ├── Modal.jsx
    │   ├── CollectionCard.jsx
    │   ├── NFTCard.jsx
    │   ├── TransactionStatus.jsx
    │   ├── NetworkGate.jsx
    │   └── QRShare.jsx
    ├── pages/
    │   ├── Home.jsx
    │   ├── CreatePass.jsx
    │   ├── Collections.jsx
    │   ├── ManageCollection.jsx
    │   ├── PublicMint.jsx
    │   └── MyPasses.jsx
    └── utils/
        ├── errors.js             # centralized error mapping
        ├── formatting.js         # BOT amounts, addresses, explorer URLs
        ├── validation.js         # form + address validation
        ├── storage.js            # localStorage collection registry
        ├── image.js              # client-side image compression
        └── tx.js                 # transaction state machine hook
```

## Installation

```bash
npm install
```

Requires Node 18+ (Vite 5).

## Environment variables

Copy the example file and fill in your Reown Project ID:

```bash
cp .env.example .env
```

The only variable:

```
VITE_REOWN_PROJECT_ID=YOUR_PROJECT_ID
```

**Where to get it**: create a free project at https://cloud.reown.com (Reown Dashboard -> Projects -> Create). A Reown Project ID is a PUBLIC id intended for frontend configuration; it is not a private credential. It enables the wallet connect relay for the AppKit modal.

A `.env` with the working Project ID is already present for local development.

## Development

```bash
npm run dev
```

Starts Vite on http://localhost:5173. The `predev` script compiles the Solidity contract into `src/blockchain/artifact.js` automatically, so the ABI/bytecode are always fresh.

## Production build

```bash
npm run build
```

Compiles the contract, then builds to `dist/`. SPA routing is handled by `vercel.json` (all paths rewrite to `/index.html`), so deep links like `/mint?chain=968&contract=0x...` work when visited directly.

```bash
npm run preview
```

Serves the production build locally.

## BOT Chain Testnet

| Setting       | Value                          |
| ------------- | ------------------------------ |
| Name          | BOT Chain Testnet              |
| Chain ID      | 968                            |
| Currency      | BOT (18 decimals)              |
| RPC           | https://rpc.bohr.life          |
| Explorer      | https://scan.bohr.life         |
| Faucet        | https://faucet.bohr.life/en/basic |

The app runs on BOT Chain Testnet by default. BOT Chain Mainnet (chain 677) is defined in `src/config/chains.js` but is NOT active; the switch to activate it is a one-line change:

```js
// src/config/chains.js
export const ACTIVE_NETWORK_KEY = "botTestnet"; // -> "botMainnet" later
```

## Smart contract

`contracts/AccessPass.sol` is an ERC-721 collection (OpenZeppelin) representing ONE product access collection. Each creator deploys their own instance.

- `mint(address to)` payable: public paid mint, one pass per wallet, supply capped.
- `giftMint(address to)` owner-only: free mint for partners/testers/team.
- `burn(uint256 tokenId)`: permanent destruction (ERC721Burnable).
- `withdraw()` owner-only: pulls mint proceeds to the owner.
- `tokenURI` / `metadataURI` / `setMetadataURI`: on-chain metadata as a `data:` URI.
- Metadata NEVER contains secrets; the NFT only proves entitlement.

### Compiling the contract

```bash
npm run compile:contract
```

Uses solc-js (no Hardhat/Foundry) and writes `src/blockchain/artifact.js` (marked AUTO-GENERATED). Runs automatically on `predev` and `prebuild`.

### Deploying the contract

There is no fixed contract address for the whole app: each creator deploys their own AccessPass from the Create Pass page, through their wallet. After deployment the app shows the real contract address, transaction hash and explorer links, and saves the collection to the local registry.

For a manual deploy (outside the app) you can compile and use the artifact with any Solidity tooling, or use viem's `deployContract` with `accessPassArtifact` from `src/blockchain/artifact.js`. Constructor args: `name, symbol, productName, accessTier, maxSupply, mintPrice (wei), metadataURI`.

## Vercel deployment

1. Push the repo to GitHub and import it in Vercel.
2. Framework preset: Vite (build command `npm run build`, output `dist`).
3. Add the environment variable `VITE_REOWN_PROJECT_ID` (same value as your local `.env`).
4. Deploy. `vercel.json` already handles SPA routing for `/mint?chain=968&contract=...` deep links.

## Mobile wallet testing

The primary supported scenario: a user with NO browser wallet extension opens the site in Android Chrome and connects a mobile wallet.

Tested flow:

1. Open the deployed URL in Android Chrome (no extension installed).
2. Press **Connect Wallet**.
3. The Reown AppKit modal opens with wallet options.
4. Choose OKX, Bitget, Trust, MetaMask, Coinbase Wallet, Rabby, Rainbow etc.
5. Approve the connection (AppKit handles the deep link / QR bridge).
6. Return to AxisPass. The connected address appears in the navbar.
7. If on the wrong network, press **Switch to BOT Chain Testnet** and approve in the wallet.
8. Mint / deploy transactions ask for approval inside the wallet; on return the app shows the confirmation.

Design notes for mobile reliability:

- Reown owns the session; we never fight the mobile wallet's provider.
- Transactions go through the active Reown EIP-1193 provider via viem.
- We do not treat "deep link opened" as "connected": the UI updates only when the Reown session reports the account.
- Session expiry / account / chain changes propagate through AppKit's state and refresh React automatically.

## Known limitations

- **No backend or indexer.** My Passes scans known collections with `ownerOf` loops over `[0, totalMinted)`. Fine for testnet-scale collections; a real indexer replaces this at scale.
- **Local registry is a UI convenience.** Collections persist per browser via localStorage; they are not blockchain indexing and not proof of ownership.
- **Live wallet interactions were not end-to-end tested** in this environment (no wallet or mobile device here). All code paths, the Reown setup, the contract compilation and the production build are verified; pairing/approval steps require a real wallet.
- **Metadata is on-chain** as a `data:` URI. Very large images would bloat deploys, so images are compressed to 512px JPEG in the browser before deployment.
- **One pass per wallet** is enforced in the contract; burning frees the seat.

## Future roadmap

- **Verification SDK (Phase 3)**: external websites call `balanceOf(wallet)` / `ownerOf(tokenId)` to grant access. The contract already exposes everything needed.
- **Marketplace / discovery (Phase 2)**: browse collections without a share link.
- **Decentralized metadata**: migrate to IPFS/Arweave via the existing `setMetadataURI`.
- **Mainnet rollout**: flip `ACTIVE_NETWORK_KEY` to `"botMainnet"` (chain 677, https://rpc.botchain.ai).
- **AI-native features** if they add real value for access management.

---

Footer: Axis by Equixote Isane
