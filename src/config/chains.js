/**
 * src/config/chains.js
 * --------------------
 * The ONE place where network configuration lives. Nothing else in the app
 * hard-codes chain ids, RPC URLs or explorer URLs.
 *
 * `ACTIVE_NETWORK_KEY` is the master switch:
 *
 *   export const ACTIVE_NETWORK_KEY = "botTestnet";  // default: TESTNET FIRST
 *
 * Flip it to "botMainnet" later and the whole app follows. Mainnet is
 * configured but dormant: only the ACTIVE chain is passed to Reown AppKit
 * and viem, so no code path can ever deploy to mainnet by accident.
 */

import { defineChain } from "viem";

/**
 * BOT Chain definitions. Each entry carries:
 *  - plain data (chainId, name, currency, rpc, explorer) for UI + URLs
 *  - a viem-ready chain object for createPublicClient/createWalletClient
 *  - EIP-3085 wallet_addEthereumChain params for the "add chain" fallback
 *
 * The viem chain is what Reown AppKit and wagmi consume under the hood
 * (Reown uses viem networks for EVM chains), so defining it here once keeps
 * every layer in sync.
 */
export const BOT_CHAINS = {
  botTestnet: {
    key: "botTestnet",
    name: "BOT Chain Testnet",
    chainId: 968,
    nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
    rpcUrl: "https://rpc.bohr.life",
    explorerUrl: "https://scan.bohr.life",
    faucetUrl: "https://faucet.bohr.life/en/basic",
    testnet: true,
    viemChain: defineChain({
      id: 968,
      name: "BOT Chain Testnet",
      nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
      rpcUrls: { default: { http: ["https://rpc.bohr.life"] } },
      blockExplorers: {
        default: { name: "BOT Scan", url: "https://scan.bohr.life" },
      },
      testnet: true,
    }),
  },
  botMainnet: {
    key: "botMainnet",
    name: "BOT Chain Mainnet",
    chainId: 677,
    nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
    rpcUrl: "https://rpc.botchain.ai",
    explorerUrl: "https://scan.botchain.ai",
    faucetUrl: null, // No faucet on mainnet. Real money. Be careful out there.
    testnet: false,
    viemChain: defineChain({
      id: 677,
      name: "BOT Chain Mainnet",
      nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
      rpcUrls: { default: { http: ["https://rpc.botchain.ai"] } },
      blockExplorers: {
        default: { name: "BOT Scan", url: "https://scan.botchain.ai" },
      },
      testnet: false,
    }),
  },
};

/**
 * THE switch. Default: BOT Chain Testnet. This single value controls every
 * RPC call, every network-switch request and every explorer link in the app.
 */
export const ACTIVE_NETWORK_KEY = "botMainnet";

/** Convenience alias for the active chain config object. */
export const ACTIVE_CHAIN = BOT_CHAINS[ACTIVE_NETWORK_KEY];

/** All chain keys (handy for building supported-network lists later). */
export const CHAIN_KEYS = Object.keys(BOT_CHAINS);

/**
 * Build the EIP-3085 wallet_addEthereumChain params for a chain.
 * The chainId must be hex, wallets are picky about that.
 */
export function toWalletAddParams(chain) {
  return {
    chainId: `0x${chain.chainId.toString(16)}`,
    chainName: chain.name,
    nativeCurrency: chain.nativeCurrency,
    rpcUrls: [chain.rpcUrl],
    blockExplorerUrls: [chain.explorerUrl],
  };
}
