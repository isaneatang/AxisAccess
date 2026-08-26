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

/** Official BOT Chain testnet faucet. Testnet-only; mainnet has no faucet,
 * so the UI only shows faucet links when the active chain defines one. */
export const FAUCET_URL = "https://faucet.bohr.life/en/basic";

/**
 * Maximum image dimension (px) after client-side compression.
 *
 * 256px (not 512): the image is stored ON-CHAIN as a base64 data URI, so
 * every pixel is deployment gas. A 512px JPEG routinely becomes a 30-60KB
 * base64 blob, pushing a deploy to 20-40M gas and breaking gas estimation
 * on mobile wallets (and on BOT Chain's own RPC past ~48KB of calldata).
 * 256px keeps most images under the MAX_METADATA_URI_LENGTH cap below.
 */
export const MAX_IMAGE_DIMENSION = 256;

/** Target image quality (0..1) for JPEG/WebP compression. */
export const IMAGE_QUALITY = 0.6;

/**
 * Hard cap (chars) for the on-chain metadata data URI.
 *
 * The metadata URI is a constructor argument, so its size is deployment
 * cost. ~20KB keeps total deploy calldata under ~27KB, which BOT Chain's
 * RPC can estimate comfortably (it starts refusing past ~48KB) and keeps
 * deploy gas in the 10-20M range instead of 30M+.
 */
export const MAX_METADATA_URI_LENGTH = 20000;

/**
 * Build the deterministic public mint URL for a collection.
 * No backend involved: the URL is derived purely from chain id + contract.
 */
export function buildMintUrl(contractAddress, chainId) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/mint?chain=${chainId}&contract=${contractAddress}`;
}
