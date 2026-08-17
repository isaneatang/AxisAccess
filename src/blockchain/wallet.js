/**
 * src/blockchain/wallet.js
 * ------------------------
 * Thin wallet helpers.
 *
 * IMPORTANT: Reown AppKit owns the connection/session layer in this app
 * (wallet selection, QR pairing, mobile deep links, session restore).
 * This module deliberately does NOT re-implement any of that. It only holds
 * small pure helpers that do not belong inside a React component:
 *
 *   - isWalletInstalled()      informational: is there any injected wallet?
 *   - buildAddChainParams()    EIP-3085 params for the manual add-chain path
 *
 * Everything else (connect, disconnect, switch network, session events)
 * flows through the WalletContext, which wraps Reown AppKit + wagmi hooks.
 */

import { ACTIVE_CHAIN, toWalletAddParams } from "../config/chains";

/**
 * True if the browser exposes an injected EIP-1193 wallet.
 * Informational only: Reown decides what to offer, we just use the flag for
 * UI copy ("you have a browser wallet" vs "scan with your mobile wallet").
 */
export function isWalletInstalled() {
  return typeof window !== "undefined" && !!window.ethereum;
}

/**
 * EIP-3085 params to add the ACTIVE chain to a wallet manually.
 * Used as a fallback when automatic switching fails and the wallet does not
 * know the chain (mostly a WalletConnect edge case).
 */
export function buildAddChainParams() {
  return [toWalletAddParams(ACTIVE_CHAIN)];
}

/**
 * Human-readable label for the active chain, used in network banners.
 */
export function activeChainLabel() {
  return ACTIVE_CHAIN.name;
}
