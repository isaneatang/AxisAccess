/**
 * src/utils/validation.js
 * -----------------------
 * Form and address validation helpers. Keeps the validation rules in one
 * place so every page behaves the same (and the tests have one target).
 */

import { isAddress as viemIsAddress, getAddress } from "viem";

/**
 * True if value looks like a valid EVM address (0x + 40 hex chars).
 * Checksum is NOT required: most test wallets paste lowercase and that is
 * perfectly fine.
 */
export function isValidAddress(value) {
  if (typeof value !== "string") return false;
  return viemIsAddress(value.trim(), { strict: false });
}

/**
 * Checksum-normalize an address, or return null if invalid.
 * Always store and compare addresses in checksummed form to avoid the
 * classic "0xABC... !== 0xabc..." heisenbug.
 */
export function normalizeAddress(value) {
  if (!isValidAddress(value)) return null;
  return getAddress(value.trim());
}

/** Product name: required, trimmed, reasonable length. */
export function validateProductName(value) {
  const v = (value || "").trim();
  if (!v) return "Product name is required.";
  if (v.length > 60) return "Product name must be 60 characters or fewer.";
  return null;
}

/** Description: required, trimmed, reasonable length. */
export function validateDescription(value) {
  const v = (value || "").trim();
  if (!v) return "Description is required.";
  if (v.length > 500) return "Description must be 500 characters or fewer.";
  return null;
}

/** Access tier: must be one of the known tiers (checked against the list). */
export function validateAccessTier(value, tiers) {
  if (!tiers.includes(value)) return "Please choose an access tier.";
  return null;
}

/**
 * Price: a valid non-negative USDT amount. Accepts "0", "0.5", "1.25" etc.
 * Rejects negative values, NaN, and absurd precision (> 6 decimals, the
 * USDT limit - parseUnits would throw on more).
 */
export function validatePrice(value) {
  const v = String(value ?? "").trim();
  if (v === "") return "Price is required.";
  if (!/^\d+(\.\d+)?$/.test(v)) return "Price must be a valid number of USDT.";
  const decimals = v.split(".")[1] || "";
  if (decimals.length > 6) return "USDT supports at most 6 decimal places.";
  return null;
}

/**
 * Maximum supply: a positive integer. No floats, no zero, no negatives.
 * Kept as a string so big values do not lose precision.
 */
export function validateSupply(value) {
  const v = String(value ?? "").trim();
  if (v === "") return "Maximum supply is required.";
  if (!/^\d+$/.test(v)) return "Supply must be a whole number.";
  if (BigInt(v) <= 0n) return "Supply must be greater than zero.";
  if (BigInt(v) > 100000n) return "Supply is unreasonably large (max 100,000).";
  return null;
}

/**
 * Validate a recipient address for gift/send flows.
 * Returns an error string or null when valid.
 */
export function validateRecipient(value) {
  const v = (value || "").trim();
  if (!v) return "Recipient address is required.";
  if (!isValidAddress(v)) return "That is not a valid EVM address.";
  return null;
}
