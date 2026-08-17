/**
 * src/utils/storage.js
 * --------------------
 * Lightweight LOCAL registry of collections the user has created or visited
 * in this browser. Backed by localStorage.
 *
 * READ THE FINE PRINT: this is a UI convenience, NOT blockchain state and
 * NOT proof of ownership. The contract's owner() is the single source of
 * truth for who can manage a collection. This registry only decides what
 * shows up on My Collections / My Passes without a backend.
 *
 * Stored per collection:
 *   address, chainId, productName, accessTier, deploymentTx, createdAt
 * plus a display-only snapshot (description/image) for prettier cards.
 */

import { COLLECTIONS_STORAGE_KEY } from "../config/constants";

/** Read the registry. Defensive parse: localStorage is user-editable. */
export function getCollections() {
  try {
    const raw = localStorage.getItem(COLLECTIONS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Write the registry (internal; everything funnels through here). */
function setCollections(collections) {
  try {
    localStorage.setItem(COLLECTIONS_STORAGE_KEY, JSON.stringify(collections));
  } catch {
    // Storage full or blocked (private mode). Degrade silently: the app
    // still works, you just lose the pretty list on reload.
  }
}

/**
 * Add or update a collection, keyed by address + chainId.
 * @param {object} collection see shape above
 */
export function saveCollection(collection) {
  const all = getCollections();
  const idx = all.findIndex(
    (c) => c.address === collection.address && c.chainId === collection.chainId
  );
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...collection };
  } else {
    all.push(collection);
  }
  setCollections(all);
}

/** Fetch one collection by address + chainId (or null). */
export function getCollection(address, chainId) {
  return (
    getCollections().find((c) => c.address === address && c.chainId === chainId) || null
  );
}

/** Remove a collection from the registry. */
export function removeCollection(address, chainId) {
  setCollections(
    getCollections().filter((c) => !(c.address === address && c.chainId === chainId))
  );
}

/** All collections on a given chainId. */
export function getCollectionsByChain(chainId) {
  return getCollections().filter((c) => c.chainId === chainId);
}
