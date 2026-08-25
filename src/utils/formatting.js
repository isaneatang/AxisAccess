/**
 * src/utils/formatting.js
 * -----------------------
 * Display helpers: USDT amounts, shortened addresses, explorer URLs.
 * All blockchain values arrive as bigint base units and are formatted here
 * with viem's formatUnits, NEVER with Number()/toFixed on raw amounts
 * (that is how decimal precision goes to die).
 */

import { formatUnits } from "viem";
import { ACTIVE_CHAIN, USDT_DECIMALS } from "../config/chains";

/**
 * Format a USDT amount in base units (6 decimals) as a readable string.
 * Strips trailing zeros ("5.000000" -> "5") and keeps 4 decimals max,
 * enough for a dashboard and easy on the eyes.
 */
export function formatUSDT(amount) {
  if (amount === null || amount === undefined) return "0";
  const formatted = formatUnits(amount, USDT_DECIMALS);
  const parts = formatted.split(".");
  if (parts.length === 1) return parts[0];
  const decimals = parts[1].replace(/0+$/, "").slice(0, 4);
  return decimals ? `${parts[0]}.${decimals}` : parts[0];
}

/**
 * Shorten an address or tx hash for UI: 0x1234...abcd.
 * viem does not ship this, so here is a tiny one.
 */
export function shortenAddress(address, start = 6, end = 4) {
  if (!address) return "";
  const s = String(address);
  if (s.length <= start + end + 1) return s;
  return `${s.slice(0, start)}...${s.slice(-end)}`;
}

/** Explorer URL for a transaction hash on the active chain. */
export function txExplorerUrl(hash, chain = ACTIVE_CHAIN) {
  return `${chain.explorerUrl}/tx/${hash}`;
}

/** Explorer URL for a contract or account address on the active chain. */
export function addressExplorerUrl(address, chain = ACTIVE_CHAIN) {
  return `${chain.explorerUrl}/address/${address}`;
}

/** Explorer URL for a specific token id (Etherscan-style ?a= param). */
export function tokenExplorerUrl(contractAddress, tokenId, chain = ACTIVE_CHAIN) {
  return `${chain.explorerUrl}/token/${contractAddress}?a=${tokenId}`;
}

/**
 * Cheap-but-honest copy helper: returns true if the text made it to the
 * clipboard. Falls back to a hidden textarea for older browsers.
 */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      return true;
    } catch {
      return false;
    }
  }
}
