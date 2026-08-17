/**
 * src/config/constants.js
 * -----------------------
 * App-wide constants that are not network config (that lives in chains.js).
 * Anything you would otherwise type in two places ends up here.
 */

/** Brand name shown in the navbar and footer. */
export const APP_NAME = "AxisPass";

/** Tagline used on the landing page and metadata. */
export const TAGLINE = "NFT Access Infrastructure";

/** The four supported access tiers, in display order. */
export const ACCESS_TIERS = ["Basic", "Pro", "Premium", "Enterprise"];

/** localStorage key for the local collection registry (UI convenience only). */
export const COLLECTIONS_STORAGE_KEY = "axispass.collections.v1";

/** Official BOT Chain testnet faucet. Do not invent another one. */
export const FAUCET_URL = "https://faucet.bohr.life/en/basic";

/** Maximum image dimension (px) after client-side compression. */
export const MAX_IMAGE_DIMENSION = 512;

/** Target image quality (0..1) for JPEG/WebP compression. */
export const IMAGE_QUALITY = 0.7;

/**
 * Build the deterministic public mint URL for a collection.
 * No backend involved: the URL is derived purely from chain id + contract.
 */
export function buildMintUrl(contractAddress, chainId) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/mint?chain=${chainId}&contract=${contractAddress}`;
}
