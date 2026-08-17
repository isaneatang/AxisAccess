/**
 * src/utils/tx.js
 * ---------------
 * A tiny transaction state machine shared by every page that sends a
 * transaction (deploy, mint, gift, burn, send, withdraw).
 *
 * States (spec section 30):
 *   idle      -> nothing happening
 *   preparing -> validating/building the tx before asking the wallet
 *   waiting   -> we have called the wallet, user has NOT confirmed yet
 *   pending   -> wallet signed, tx broadcast, waiting for confirmation
 *   confirming-> tx mined, reading the receipt
 *   success   -> confirmed on-chain
 *   error     -> something failed (friendly message included)
 *
 * It also guards against duplicate submission: run() no-ops while a
 * transaction is active, so double-clicks cannot double-spend.
 */

import { useCallback, useRef, useState } from "react";
import { friendlyErrorMessage } from "./errors";

/**
 * Hook: returns { status, message, result, rawError, run, reset }.
 *
 * @returns
 *   status   one of the states above
 *   message  friendly status text for the UI (NEVER a raw RPC error)
 *   result   whatever the tx resolved with (txHash, tokenId, ...)
 *   rawError the original thrown error, kept for the technical-details
 *            accordion in TransactionStatus - NOT for the visible copy
 *   run      async fn: wraps your tx, drives the state machine
 *   reset    back to idle
 */
export function useTxFlow() {
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState(null);
  const [rawError, setRawError] = useState(null);
  const active = useRef(false);

  /**
   * Execute a transaction through the state machine.
   *
   * The caller supplies two functions so the UI can show accurate states:
   *
   * @param {Function} broadcast  async () => txHash   signs + broadcasts
   * @param {Function} confirm    async (txHash) => receipt   waits for mining
   * @param {object}   steps      { preparing, waiting, pending, confirming, success }
   * @param {string}   [context]  "deployment" | "transaction" | "connect" | "network"
   *                              (tweaks the friendly error fallback wording)
   * @returns {Promise<object|null>} { status, result } or null if skipped
   */
  const run = useCallback(async (broadcast, confirm, steps = {}, context = "transaction") => {
    if (active.current) return null; // duplicate submission guard
    active.current = true;
    setResult(null);
    setRawError(null);
    setStatus("preparing");
    setMessage(steps.preparing || "Preparing transaction...");
    try {
      setStatus("waiting");
      setMessage(steps.waiting || "Waiting for your wallet to confirm...");
      const txHash = await broadcast();
      setStatus("pending");
      setMessage(steps.pending || "Transaction submitted. Waiting for confirmation...");
      const receipt = confirm ? await confirm(txHash) : null;
      setStatus("confirming");
      setMessage(steps.confirming || "Transaction confirmed. Finalizing...");
      setResult({ txHash, receipt });
      setStatus("success");
      setMessage(steps.success || "Done.");
      return { status: "success", result: { txHash, receipt } };
    } catch (err) {
      setStatus("error");
      // Friendly message only. The raw error (which for a failed deploy
      // contains the ENTIRE bytecode as "Request Arguments: ... data:
      // 0x6080...") goes to rawError and lives in the collapsible
      // technical-details block, never in the visible copy.
      setRawError(err);
      setMessage(steps.error || friendlyErrorMessage(err, context).message);
      return { status: "error", error: err };
    } finally {
      active.current = false;
    }
  }, []);

  const reset = useCallback(() => {
    active.current = false;
    setStatus("idle");
    setMessage("");
    setResult(null);
    setRawError(null);
  }, []);

  return { status, message, result, rawError, run, reset };
}
