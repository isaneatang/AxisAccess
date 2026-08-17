/**
 * src/utils/image.js
 * ------------------
 * Client-side image compression for NFT metadata.
 *
 * Why: the metadata is stored ON-CHAIN as a data URI. Every kilobyte of
 * image becomes part of a blockchain transaction, and huge base64 blobs
 * make deploys slow and expensive. So we shrink images in the browser
 * before they ever reach the metadata (spec section 17).
 */

import { MAX_IMAGE_DIMENSION, IMAGE_QUALITY } from "../config/constants";

/**
 * Compress an image File into a small JPEG data URL.
 *
 * @param {File} file The file picked from the <input type="file">.
 * @returns {Promise<string>} data:image/jpeg;base64,... (compressed)
 * @throws {Error} If the file is not an image or decoding fails.
 */
export async function compressImage(file) {
  if (!file || !file.type.startsWith("image/")) {
    throw new Error("Please choose an image file (JPEG, PNG, WebP).");
  }

  const bitmap = await createImageBitmap(file);
  const { width, height } = fitWithin(bitmap.width, bitmap.height, MAX_IMAGE_DIMENSION);

  // Draw the image onto a canvas at the target size, then export as JPEG.
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, width, height);

  const dataUrl = canvas.toDataURL("image/jpeg", IMAGE_QUALITY);
  bitmap.close();
  return dataUrl;
}

/**
 * Compute the largest width/height that fit within maxDimension while
 * preserving aspect ratio. Never upscales.
 */
function fitWithin(width, height, maxDimension) {
  if (width <= maxDimension && height <= maxDimension) {
    return { width, height };
  }
  const scale = maxDimension / Math.max(width, height);
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}
