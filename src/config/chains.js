/**
 * src/config/chains.js
 * --------------------
 * The ONE place where network configuration lives. Nothing else in the app
 * hard-codes chain ids, RPC URLs or explorer URLs.
 *
 * `ACTIVE_NETWORK_KEY` is the master switch:
 *
 *   export const ACTIVE_NETWORK_KEY = "botMainnet";  // active: MAINNET
 *
 * The app currently runs on BOT Chain Mainnet. Testnet stays configured but
 * dormant: only the ACTIVE chain is passed to Reown AppKit and viem, so no
 * code path can ever touch the dormant chain by accident.
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
/**
 * USDT payment token (bridged via the official BOT Bridge). Prices are
 * denominated in USDT so creators are insulated from BOT price swings.
 * Both deployments carry 6 decimals (verified on-chain, not assumed).
 * Sources: dev-docs.botchain.ai/docs/Bridge/contract-addresses/
 */
export const USDT_DECIMALS = 6;

export const BOT_CHAINS = {
  botTestnet: {
    key: "botTestnet",
    name: "BOT Chain Testnet",
    chainId: 968,
    nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
    usdtAddress: "0x75edC9335175Fc0552D51D48439F229c10420fe3",
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
    usdtAddress: "0xaBabc7Ddc03e501d190C676BF3d92ef0e6e87a3C",
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
 * THE switch. Default: BOT Chain Mainnet. This single value controls every
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
