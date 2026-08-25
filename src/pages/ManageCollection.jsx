/**
 * src/pages/ManageCollection.jsx
 * ------------------------------
 * The creator control panel for a single collection (spec section 21).
 *
 * Route: /collections/:address
 *
 * Shows live on-chain stats (product, tier, price, supply, minted,
 * remaining, contract address, creator) and, when the connected wallet is
 * the contract owner, the admin actions:
 *
 *   - Mint to Myself    (pays the normal mint price)
 *   - Gift a Pass       (owner-only free mint to a recipient)
 *   - Withdraw          (pull mint proceeds to the owner)
 *   - Update Metadata   (owner-only metadata URI swap)
 *   - View Explorer / Share (mint link + QR)
 *
 * Ownership is read from the contract owner() at load time and whenever the
 * wallet changes. Non-owners see stats only, no controls.
 */

import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useWallet } from "../context/WalletContext";
import {
  readCollection,
  readCollectionOwner,
  readUsdtBalance,
  mintPass,
  giftMintPass,
  withdrawFunds,
  updateMetadataUri,
  confirmTransaction,
} from "../blockchain/contract";
import { saveCollection } from "../utils/storage";
import { friendlyErrorMessage } from "../utils/errors";
import { useTxFlow } from "../utils/tx";
import { validateRecipient, isValidAddress } from "../utils/validation";
import { formatUSDT, txExplorerUrl, addressExplorerUrl, shortenAddress } from "../utils/formatting";
import { buildMintUrl } from "../config/constants";
import { ACTIVE_CHAIN } from "../config/chains";
import TransactionStatus from "../components/TransactionStatus";
import NetworkGate from "../components/NetworkGate";
import QRShare from "../components/QRShare";
import Modal from "../components/Modal";

export default function ManageCollection() {
  const { address: addressParam } = useParams();
  const { address, isConnected, isOnActiveNetwork, walletClient, error: walletError, clearError } = useWallet();

  const [collection, setCollection] = useState(null);
  const [owner, setOwner] = useState(null);
  const [balance, setBalance] = useState(null); // bigint wei, contract balance
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  // Gift modal state
  const [giftOpen, setGiftOpen] = useState(false);
  const [giftTo, setGiftTo] = useState("");
  const [giftError, setGiftError] = useState("");

  // Metadata modal state
  const [metaOpen, setMetaOpen] = useState(false);
  const [metaUri, setMetaUri] = useState("");
  const [metaError, setMetaError] = useState("");

  const [shareOpen, setShareOpen] = useState(false);

  const mintFlow = useTxFlow();
  const giftFlow = useTxFlow();
  const withdrawFlow = useTxFlow();
  const metaFlow = useTxFlow();

  const isOwner = isConnected && owner?.toLowerCase() === address?.toLowerCase();
  const remaining = collection ? collection.remaining : null;
  const soldOut = collection ? remaining <= 0n : false;

  const txBusy = (flow) => ["preparing", "waiting", "pending", "confirming"].includes(flow.status);

  const load = useCallback(async () => {
    if (!isValidAddress(addressParam)) {
      setLoadError("That is not a valid contract address.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError("");
    try {
      const data = await readCollection(addressParam);
      setCollection(data);
      setOwner(data.owner);
      // Proceeds are held in USDT, so show the token balance, not native.
      setBalance(await readUsdtBalance(addressParam));
      // Keep the local registry fresh so My Passes/Collections find it.
      saveCollection({
        address: data.address,
        chainId: ACTIVE_CHAIN.chainId,
        productName: data.productName,
        accessTier: data.accessTier,
        deploymentTx: "",
        createdAt: Date.now(),
        description: data.metadata?.description || "",
        image: data.metadata?.image || "",
      });
    } catch (err) {
      setLoadError(friendlyErrorMessage(err, "transaction").message);
    } finally {
      setLoading(false);
    }
  }, [addressParam]);

  useEffect(() => {
    load();
  }, [load]);

  // Re-check ownership + balance when the wallet changes.
  useEffect(() => {
    if (isValidAddress(addressParam) && isConnected) {
      readCollectionOwner(addressParam)
        .then(setOwner)
        .catch(() => {});
      readUsdtBalance(addressParam)
        .then(setBalance)
        .catch(() => {});
    }
  }, [addressParam, isConnected]);

  /* ------------------------- Actions ------------------------- */

  const handleMintToSelf = async () => {
    if (!collection || !walletClient || !address) return;
    const { status, error } = await mintFlow.run(
      () => mintPass(collection.address, address, collection.mintPrice, walletClient),
      confirmTransaction,
      {
        preparing: "Preparing mint...",
        waiting: "Waiting for your wallet to confirm...",
        pending: "Mint submitted, waiting for confirmation...",
        confirming: "Mint confirmed. Refreshing stats...",
        success: "Access Pass minted!",
      }
    );
    if (status === "success") load();
    else if (error) setLoadError(friendlyErrorMessage(error, "transaction").message);
  };

  const openGift = () => {
    setGiftTo("");
    setGiftError("");
    setGiftOpen(true);
  };

  const handleGift = async () => {
    const err = validateRecipient(giftTo);
    if (err) {
      setGiftError(err);
      return;
    }
    if (!collection || !walletClient) return;
    const { status, error, result } = await giftFlow.run(
      () => giftMintPass(collection.address, giftTo.trim(), walletClient),
      confirmTransaction,
      {
        preparing: "Preparing gift mint...",
        waiting: "Waiting for your wallet to confirm...",
        pending: "Gift mint submitted...",
        confirming: "Gift mint confirmed. Refreshing stats...",
        success: "Pass gifted!",
      }
    );
    if (status === "success") {
      setGiftOpen(false);
      setGiftError("");
      load();
    } else if (error) {
      setGiftError(friendlyErrorMessage(error, "transaction").message);
    }
  };

  const handleWithdraw = async () => {
    if (!collection || !walletClient) return;
    const { status, error } = await withdrawFlow.run(
      () => withdrawFunds(collection.address, walletClient),
      confirmTransaction,
      {
        preparing: "Preparing withdrawal...",
        waiting: "Waiting for your wallet to confirm...",
        pending: "Withdrawal submitted...",
        confirming: "Withdrawal confirmed. Refreshing balance...",
        success: "Balance withdrawn!",
      }
    );
    if (status === "success") load();
    else if (error) setLoadError(friendlyErrorMessage(error, "transaction").message);
  };

  const handleMetaUpdate = async () => {
    const uri = metaUri.trim();
    if (!uri.startsWith("data:") && !uri.startsWith("ipfs://") && !uri.startsWith("https://")) {
      setMetaError("Metadata URI must start with data:, ipfs:// or https://");
      return;
    }
    if (!collection || !walletClient) return;
    const { status, error } = await metaFlow.run(
      () => updateMetadataUri(collection.address, uri, walletClient),
      confirmTransaction,
      {
        preparing: "Preparing metadata update...",
        waiting: "Waiting for your wallet to confirm...",
        pending: "Update submitted...",
        confirming: "Update confirmed. Refreshing...",
        success: "Metadata updated!",
      }
    );
    if (status === "success") {
      setMetaOpen(false);
      load();
    } else if (error) {
      setMetaError(friendlyErrorMessage(error, "transaction").message);
    }
  };

  /* ------------------------- Loading / error ------------------------- */

  if (loading) {
    return (
      <div className="page">
        <div className="empty-state">
          <span className="spinner" aria-hidden="true" />
          <p>Loading collection from the chain...</p>
        </div>
      </div>
    );
  }

  if (loadError || !collection) {
    return (
      <div className="page page--narrow">
        <div className="empty-state">
          <span className="empty-state__icon" aria-hidden="true">
            &#9888;&#65039;
          </span>
          <h2>Couldn't load this collection</h2>
          <p>{loadError || "Unknown error."}</p>
          <div className="empty-state__actions">
            <button type="button" className="btn btn--secondary" onClick={load}>
              Try again
            </button>
            <Link to="/collections" className="btn btn--ghost">
              Back to Collections
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ------------------------- Render ------------------------- */

  const image = collection.metadata?.image;
  const displayName = collection.metadata?.name || `${collection.productName} Pass`;
  const mintUrl = buildMintUrl(collection.address, ACTIVE_CHAIN.chainId);

  return (
    <div className="page">
      <div className="page-header page-header--row">
        <div>
          <h1>{displayName}</h1>
          <p className="page-header__sub">
            <span className="badge badge--tier">{collection.accessTier}</span>
            <code className="mono-inline" title={collection.address}>
              {shortenAddress(collection.address)}
            </code>
          </p>
        </div>
        <div className="page-header__actions">
          <button type="button" className="btn btn--secondary" onClick={() => setShareOpen(true)}>
            Share Mint Page
          </button>
          <a className="btn btn--ghost" href={addressExplorerUrl(collection.address)} target="_blank" rel="noreferrer">
            View Explorer
          </a>
        </div>
      </div>

      {isConnected && !isOnActiveNetwork && (
        <div className="manage-warning">
          <NetworkGate />
          {walletError && <p className="field-error">{walletError}</p>}
          <button type="button" className="btn btn--ghost btn--sm" onClick={clearError}>
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid--2">
        {/* Stats card */}
        <div className="card stats-card">
          <h3>Collection Stats</h3>
          {image && <img className="stats-card__img" src={image} alt={collection.productName} />}
          <dl className="stat-list">
            <div>
              <dt>Product</dt>
              <dd>{collection.productName}</dd>
            </div>
            <div>
              <dt>Tier</dt>
              <dd>{collection.accessTier}</dd>
            </div>
            <div>
              <dt>Price</dt>
              <dd>{formatUSDT(collection.mintPrice)} USDT</dd>
            </div>
            <div>
              <dt>Max Supply</dt>
              <dd>{collection.maxSupply.toString()}</dd>
            </div>
            <div>
              <dt>Minted</dt>
              <dd>{collection.totalMinted.toString()}</dd>
            </div>
            <div>
              <dt>Remaining</dt>
              <dd>{remaining.toString()}</dd>
            </div>
            <div>
              <dt>Contract</dt>
              <dd className="mono-inline">{shortenAddress(collection.address)}</dd>
            </div>
            <div>
              <dt>Creator</dt>
              <dd className="mono-inline">{shortenAddress(collection.owner)}</dd>
            </div>
            <div>
              <dt>Balance</dt>
              <dd>{balance !== null ? `${formatUSDT(balance)} USDT` : "..."}</dd>
            </div>
          </dl>
        </div>

        {/* Owner panel */}
        <div className="card owner-card">
          {isOwner ? (
            <>
              <h3>Creator Controls</h3>
              <div className="owner-card__actions">
                <button
                  type="button"
                  className="btn btn--primary btn--block"
                  onClick={handleMintToSelf}
                  disabled={soldOut || txBusy(mintFlow)}
                >
                  {soldOut ? "Sold Out" : "Mint to Myself"}
                </button>
                <button type="button" className="btn btn--secondary btn--block" onClick={openGift} disabled={soldOut || txBusy(giftFlow)}>
                  Gift a Pass
                </button>
                <button
                  type="button"
                  className="btn btn--secondary btn--block"
                  onClick={() => {
                    setMetaUri(collection.metadataUri || "");
                    setMetaError("");
                    setMetaOpen(true);
                  }}
                >
                  Update Metadata URI
                </button>
                <button
                  type="button"
                  className="btn btn--secondary btn--block"
                  onClick={handleWithdraw}
                  disabled={!balance || balance <= 0n || txBusy(withdrawFlow)}
                >
                  Withdraw ({balance !== null ? `${formatUSDT(balance)} USDT` : "..."})
                </button>
              </div>
              {!isOnActiveNetwork && (
                <p className="field-hint">Connect on BOT Chain Testnet to use creator controls.</p>
              )}
            </>
          ) : (
            <div className="owner-card__locked">
              <span className="owner-card__lock-icon" aria-hidden="true">
                &#128274;
              </span>
              <h3>Creator Controls Locked</h3>
              <p>
                {isConnected
                  ? "Your wallet is not the owner of this collection. Management actions are available to the contract owner only."
                  : "Connect the owner wallet to manage this collection."}
              </p>
            </div>
          )}
        </div>
      </div>

      <TransactionStatus
        status={mintFlow.status}
        message={mintFlow.message}
        txHash={mintFlow.result?.txHash}
        explorerUrl={txExplorerUrl}
        rawError={mintFlow.rawError}
      >
        {mintFlow.status === "error" && (
          <button type="button" className="btn btn--secondary btn--sm" onClick={mintFlow.reset}>
            Try Again
          </button>
        )}
      </TransactionStatus>
      <TransactionStatus status={withdrawFlow.status} message={withdrawFlow.message} txHash={withdrawFlow.result?.txHash} explorerUrl={txExplorerUrl} rawError={withdrawFlow.rawError} />
      <TransactionStatus status={metaFlow.status} message={metaFlow.message} txHash={metaFlow.result?.txHash} explorerUrl={txExplorerUrl} rawError={metaFlow.rawError} />

      {/* Gift modal */}
      <Modal open={giftOpen} onClose={() => setGiftOpen(false)} title="Gift a Pass">
        <p className="field-hint">The recipient pays nothing; you pay only gas. One pass per wallet applies.</p>
        <div className="form-group">
          <label className="form-label" htmlFor="giftTo">
            Recipient Wallet
          </label>
          <input
            id="giftTo"
            className="form-input"
            type="text"
            placeholder="0x..."
            value={giftTo}
            onChange={(e) => {
              setGiftTo(e.target.value);
              setGiftError("");
            }}
          />
          {giftError && <p className="field-error">{giftError}</p>}
        </div>
        <TransactionStatus status={giftFlow.status} message={giftFlow.message} txHash={giftFlow.result?.txHash} explorerUrl={txExplorerUrl} rawError={giftFlow.rawError} />
        <div className="modal__actions">
          <button type="button" className="btn btn--secondary" onClick={() => setGiftOpen(false)}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={handleGift} disabled={txBusy(giftFlow)}>
            Gift Pass
          </button>
        </div>
      </Modal>

      {/* Metadata modal */}
      <Modal open={metaOpen} onClose={() => setMetaOpen(false)} title="Update Metadata URI">
        <p className="field-hint">Swap the collection metadata. Use a data:, ipfs:// or https:// URI.</p>
        <div className="form-group">
          <label className="form-label" htmlFor="metaUri">
            Metadata URI
          </label>
          <input
            id="metaUri"
            className="form-input"
            type="text"
            value={metaUri}
            onChange={(e) => {
              setMetaUri(e.target.value);
              setMetaError("");
            }}
          />
          {metaError && <p className="field-error">{metaError}</p>}
        </div>
        <TransactionStatus status={metaFlow.status} message={metaFlow.message} txHash={metaFlow.result?.txHash} explorerUrl={txExplorerUrl} />
        <div className="modal__actions">
          <button type="button" className="btn btn--secondary" onClick={() => setMetaOpen(false)}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={handleMetaUpdate} disabled={txBusy(metaFlow)}>
            Save Metadata
          </button>
        </div>
      </Modal>

      <QRShare open={shareOpen} onClose={() => setShareOpen(false)} url={mintUrl} productName={collection.productName} />
    </div>
  );
}
