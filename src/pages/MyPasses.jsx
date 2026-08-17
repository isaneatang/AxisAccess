/**
 * src/pages/MyPasses.jsx
 * ----------------------
 * "My Passes" page (spec section 25).
 *
 * Shows the NFTs the connected wallet currently owns, for every collection
 * in the local registry on the active chain.
 *
 * MVP approach, no indexer (spec section 23): for each known collection we
 * read totalMinted() and iterate token ids [0, totalMinted), calling
 * ownerOf() and comparing with the wallet. Burned or missing tokens revert
 * and are skipped gracefully. RPC errors per collection are tolerated.
 *
 * Honest note: this is O(totalMinted) RPC calls per collection, which is
 * fine on a testnet-scale demo. A real indexer replaces this at scale.
 *
 * Actions per pass: View (explorer), Send, Burn. Send uses
 * safeTransferFrom, Burn uses burn(), both real wallet-approved txs.
 */

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useWallet } from "../context/WalletContext";
import { getCollections } from "../utils/storage";
import {
  readCollection,
  readOwnedTokenIds,
  transferPass,
  burnPass,
  confirmTransaction,
} from "../blockchain/contract";
import { friendlyErrorMessage } from "../utils/errors";
import { useTxFlow } from "../utils/tx";
import { validateRecipient } from "../utils/validation";
import { txExplorerUrl } from "../utils/formatting";
import { ACTIVE_CHAIN } from "../config/chains";
import NFTCard from "../components/NFTCard";
import TransactionStatus from "../components/TransactionStatus";
import NetworkGate from "../components/NetworkGate";
import WalletModal from "../components/WalletModal";
import Modal from "../components/Modal";

export default function MyPasses() {
  const { address, isConnected, isOnActiveNetwork, walletClient } = useWallet();

  const [passes, setPasses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [showWalletModal, setShowWalletModal] = useState(false);

  // Send modal state
  const [sendTarget, setSendTarget] = useState(null); // the pass being sent
  const [sendTo, setSendTo] = useState("");
  const [sendError, setSendError] = useState("");

  // Burn modal state
  const [burnTarget, setBurnTarget] = useState(null);
  const [burnError, setBurnError] = useState("");

  const sendFlow = useTxFlow();
  const burnFlow = useTxFlow();

  const txBusy = (flow) => ["preparing", "waiting", "pending", "confirming"].includes(flow.status);

  /**
   * Scan every known collection for passes owned by the wallet.
   * Tolerates per-collection failures so one bad RPC does not blank the page.
   */
  const loadPasses = useCallback(async () => {
    if (!isConnected || !address) {
      setPasses([]);
      return;
    }
    setLoading(true);
    setLoadError("");
    try {
      const registry = getCollections().filter((c) => c.chainId === ACTIVE_CHAIN.chainId);
      const owned = [];

      for (const entry of registry) {
        try {
          const data = await readCollection(entry.address);
          const tokens = await readOwnedTokenIds(entry.address, address, data.totalMinted);
          for (const t of tokens) {
            owned.push({
              tokenId: t.tokenId,
              owner: t.owner,
              collection: {
                address: entry.address,
                productName: data.productName,
                accessTier: data.accessTier,
                name: data.name,
              },
              metadata: data.metadata,
            });
          }
        } catch {
          // Collection failed to load (deleted, RPC hiccup). Skip it.
        }
      }
      setPasses(owned);
    } catch (err) {
      setLoadError(friendlyErrorMessage(err, "transaction").message);
    } finally {
      setLoading(false);
    }
  }, [isConnected, address]);

  useEffect(() => {
    loadPasses();
  }, [loadPasses]);

  /* -------- send -------- */
  const openSend = (pass) => {
    setSendTarget(pass);
    setSendTo("");
    setSendError("");
  };

  const handleSend = async () => {
    const err = validateRecipient(sendTo);
    if (err) {
      setSendError(err);
      return;
    }
    if (!sendTarget || !walletClient) return;
    const { status, error } = await sendFlow.run(
      () => transferPass(sendTarget.collection.address, sendTo.trim(), sendTarget.tokenId, walletClient),
      confirmTransaction,
      {
        preparing: "Preparing transfer...",
        waiting: "Waiting for your wallet to confirm...",
        pending: "Transfer submitted...",
        confirming: "Transfer confirmed. Refreshing your passes...",
        success: "Pass sent!",
      }
    );
    if (status === "success") {
      setSendTarget(null);
      loadPasses();
    } else if (error) {
      setSendError(friendlyErrorMessage(error, "transaction").message);
    }
  };

  /* -------- burn -------- */
  const openBurn = (pass) => {
    setBurnTarget(pass);
    setBurnError("");
  };

  const handleBurn = async () => {
    if (!burnTarget || !walletClient) return;
    const { status, error } = await burnFlow.run(
      () => burnPass(burnTarget.collection.address, burnTarget.tokenId, walletClient),
      confirmTransaction,
      {
        preparing: "Preparing burn...",
        waiting: "Waiting for your wallet to confirm...",
        pending: "Burn submitted...",
        confirming: "Burn confirmed. Updating your passes...",
        success: "Pass burned permanently.",
      }
    );
    if (status === "success") {
      setBurnTarget(null);
      loadPasses();
    } else if (error) {
      setBurnError(friendlyErrorMessage(error, "transaction").message);
    }
  };

  /* -------- render -------- */

  if (!isConnected) {
    return (
      <div className="page">
        <div className="page-header">
          <h1>My Passes</h1>
          <p>Connect your wallet to see the access passes you own.</p>
        </div>
        <div className="empty-state">
          <span className="empty-state__icon" aria-hidden="true">
            &#127915;
          </span>
          <h2>No wallet connected</h2>
          <p>Connect to view, send and burn your passes.</p>
          <button type="button" className="btn btn--primary" onClick={() => setShowWalletModal(true)}>
            Connect Wallet
          </button>
        </div>
        <WalletModal open={showWalletModal} onClose={() => setShowWalletModal(false)} />
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>My Passes</h1>
        <p>Access passes owned by {address && `${address.slice(0, 6)}...${address.slice(-4)}`}.</p>
      </div>

      {isConnected && !isOnActiveNetwork && (
        <>
          <NetworkGate />
          {loadError && <p className="field-error">{loadError}</p>}
        </>
      )}

      {loading ? (
        <div className="empty-state">
          <span className="spinner" aria-hidden="true" />
          <p>Scanning your collections on BOT Chain...</p>
        </div>
      ) : passes.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state__icon" aria-hidden="true">
            &#128230;
          </span>
          <h2>No passes yet</h2>
          <p>
            Passes appear here once you mint one from a collection's public mint page.
            <br />
            Tip: visit a mint link and mint your first pass.
          </p>
          <Link to="/collections" className="btn btn--secondary">
            Browse My Collections
          </Link>
        </div>
      ) : (
        <div className="grid grid--cards">
          {passes.map((p) => (
            <NFTCard key={`${p.collection.address}-${p.tokenId.toString()}`} pass={p} onSend={openSend} onBurn={openBurn} />
          ))}
        </div>
      )}

      <TransactionStatus status={sendFlow.status} message={sendFlow.message} txHash={sendFlow.result?.txHash} explorerUrl={txExplorerUrl} rawError={sendFlow.rawError} />
      <TransactionStatus status={burnFlow.status} message={burnFlow.message} txHash={burnFlow.result?.txHash} explorerUrl={txExplorerUrl} rawError={burnFlow.rawError} />

      {/* Send modal */}
      <Modal open={!!sendTarget} onClose={() => setSendTarget(null)} title="Send Pass">
        {sendTarget && (
          <p className="field-hint">
            Sending token #{sendTarget.tokenId.toString()} from{" "}
            {sendTarget.collection.productName}. The recipient must have an EVM wallet.
          </p>
        )}
        <div className="form-group">
          <label className="form-label" htmlFor="sendTo">
            Recipient Wallet
          </label>
          <input
            id="sendTo"
            className="form-input"
            type="text"
            placeholder="0x..."
            value={sendTo}
            onChange={(e) => {
              setSendTo(e.target.value);
              setSendError("");
            }}
          />
          {sendError && <p className="field-error">{sendError}</p>}
        </div>
        <TransactionStatus status={sendFlow.status} message={sendFlow.message} txHash={sendFlow.result?.txHash} explorerUrl={txExplorerUrl} rawError={sendFlow.rawError} />
        <div className="modal__actions">
          <button type="button" className="btn btn--secondary" onClick={() => setSendTarget(null)}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={handleSend} disabled={txBusy(sendFlow)}>
            Send Pass
          </button>
        </div>
      </Modal>

      {/* Burn modal */}
      <Modal open={!!burnTarget} onClose={() => setBurnTarget(null)} title="Burn Pass">
        <div className="burn-warning">
          <span className="burn-warning__icon" aria-hidden="true">
            &#128680;
          </span>
          <p>
            This permanently destroys the NFT. The action cannot be undone, and the pass is gone from the
            blockchain forever.
          </p>
        </div>
        {burnError && <p className="field-error">{burnError}</p>}
        <TransactionStatus status={burnFlow.status} message={burnFlow.message} txHash={burnFlow.result?.txHash} explorerUrl={txExplorerUrl} rawError={burnFlow.rawError} />
        <div className="modal__actions">
          <button type="button" className="btn btn--secondary" onClick={() => setBurnTarget(null)}>
            Cancel
          </button>
          <button type="button" className="btn btn--danger" onClick={handleBurn} disabled={txBusy(burnFlow)}>
            Burn NFT
          </button>
        </div>
      </Modal>
    </div>
  );
}
