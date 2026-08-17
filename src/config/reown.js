/**
 * src/config/reown.js
 * -------------------
 * Reown AppKit (the current official WalletConnect infrastructure) setup.
 *
 * Architecture:
 *
 *   AxisPass
 *      |
 *      v
 *   Reown AppKit (modal, sessions, deep links, injected wallets)
 *      |
 *      v
 *   EIP-1193 provider (exposed via useAppKitProvider)
 *      |
 *      v
 *   viem (reads + writes)
 *      |
 *      v
 *   BOT Chain
 *
 * Reown owns the connection/session layer. viem owns the blockchain layer.
 * This module configures the WagmiAdapter (wagmi 2.x is required by AppKit)
 * and hands the app the wagmi config to wrap with <WagmiProvider>.
 *
 * Only the ACTIVE chain is registered with AppKit. Mainnet stays dormant
 * until someone flips ACTIVE_NETWORK_KEY in chains.js.
 */

import { createAppKit } from "@reown/appkit/react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { ACTIVE_CHAIN } from "./chains";

/**
 * The Reown Project ID comes from the environment. It is a PUBLIC id meant
 * for frontend configuration (see cloud.reown.com), not a private secret.
 * It is documented in .env.example and must be set on Vercel too.
 */
export const projectId = import.meta.env.VITE_REOWN_PROJECT_ID || "";

if (!projectId) {
  // Fail loudly in dev so the missing env var cannot be missed.
  console.warn(
    "VITE_REOWN_PROJECT_ID is not set. Get a free project id at " +
      "https://cloud.reown.com and add it to .env (see .env.example)."
  );
}

/** Application metadata shown to wallets during pairing. */
const metadata = {
  name: "AxisPass",
  description: "NFT Access Infrastructure on BOT Chain",
  url: typeof window !== "undefined" ? window.location.origin : "https://axispass.vercel.app",
  icons: [],
};

/** The networks this dApp supports. Only the ACTIVE chain, by design. */
export const appKitNetworks = [ACTIVE_CHAIN.viemChain];

/**
 * The wagmi adapter bridges Reown's connection layer to wagmi/viem.
 * `ssr: false` because this is a pure client-side Vite SPA.
 */
export const wagmiAdapter = new WagmiAdapter({
  networks: appKitNetworks,
  projectId,
  ssr: false,
});

/**
 * The AppKit modal instance. Calling modal.open() shows the official wallet
 * picker: browser wallets, WalletConnect QR, mobile deep links, the lot.
 * It is created once at module scope (never inside a component).
 */
export const appKitModal = createAppKit({
  adapters: [wagmiAdapter],
  networks: appKitNetworks,
  projectId,
  metadata,
  features: {
    analytics: false,
    socials: false,
    email: false,
  },
  themeMode: "dark",
  themeVariables: {
    "--w3m-accent": "#2f9e6f",
    "--w3m-background-color": "#0b1512",
    "--w3m-color-mix": "#0b1512",
    "--w3m-color-mix-strength": 30,
    "--w3m-border-radius-master": "12px",
  },
});

export default appKitModal;
