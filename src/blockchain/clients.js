/**
 * src/blockchain/clients.js
 * -------------------------
 * viem client factories.
 *
 * Two kinds of client:
 *   - PUBLIC client: reads only, over the BOT Chain RPC. Wallet-independent,
 *     so the public mint page can show collection data before anyone connects.
 *   - WALLET client: writes only, over the active Reown EIP-1193 provider.
 *     The connected address is the viem `account`; the provider is just the
 *     transport that signs (per spec: never use the provider as the account).
 *
 * Reads always target the ACTIVE chain's RPC, regardless of which network
 * the user's wallet happens to be on.
 */

import {
  createPublicClient,
  createWalletClient as viemCreateWalletClient,
  custom,
  http,
} from "viem";
import { ACTIVE_CHAIN } from "../config/chains";

// Module-level singleton for reads. Lazy so the app works before connect.
let publicClient = null;

/**
 * The one public client for the whole app. Cached, so every page shares a
 * single HTTP connection pool to the BOT Chain RPC.
 */
export function getPublicClient() {
  if (!publicClient) {
    publicClient = createPublicClient({
      chain: ACTIVE_CHAIN.viemChain,
      transport: http(ACTIVE_CHAIN.rpcUrl),
    });
  }
  return publicClient;
}

/**
 * Build a wallet client bound to a specific connected address over the
 * Reown EIP-1193 provider.
 *
 * @param {object} provider The EIP-1193 provider from useAppKitProvider.
 * @param {string} address  The connected wallet address (checksummed).
 */
export function createWalletClient(provider, address) {
  return viemCreateWalletClient({
    account: address,
    chain: ACTIVE_CHAIN.viemChain,
    transport: custom(provider),
  });
}
