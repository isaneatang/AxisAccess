/**
 * src/pages/Collections.jsx
 * -------------------------
 * "My Collections" page (spec section 20).
 *
 * Shows the collections stored in the local registry (a UI convenience,
 * NOT blockchain indexing). Each card can be managed if the connected
 * wallet is the contract owner, and shared via link/QR.
 *
 * Also supports Import Collection: paste a contract address, we read the
 * live contract (owner, product, tier, supply) and add it to the registry.
 * Management rights come from the contract owner(), never from localStorage.
 */

import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useWallet } from "../context/WalletContext";
import { getCollections, saveCollection, getCollection } from "../utils/storage";
import { readCollection } from "../blockchain/contract";
import { normalizeAddress } from "../utils/validation";
import { friendlyErrorMessage } from "../utils/errors";
import { formatBOT } from "../utils/formatting";
import { buildMintUrl } from "../config/constants";
import { ACTIVE_CHAIN } from "../config/chains";
import CollectionCard from "../components/CollectionCard";
import QRShare from "../components/QRShare";

export default function Collections() {
  const { address, isConnected, publicClient } = useWallet();
  const navigate = useNavigate();

  const [collections, setCollections] = useState([]);
  const [importAddress, setImportAddress] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [shareTarget, setShareTarget] = useState(null); // collection being shared
  const [refreshKey, setRefreshKey] = useState(0);

  // Load the local registry whenever the wallet changes (so owner badges
  // stay correct) or when refreshKey changes.
  useEffect(() => {
    setCollections(getCollections().filter((c) => c.chainId === ACTIVE_CHAIN.chainId));
  }, [address, isConnected, refreshKey]);

  /**
   * For each registry entry, read live on-chain stats so cards show real
   * minted/supply and correct ownership. Failed reads fall back to the
   * stored snapshot (e.g. the collection was deleted or RPC hiccuped).
   */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const registry = getCollections().filter((c) => c.chainId === ACTIVE_CHAIN.chainId);
      const live = await Promise.all(
        registry.map(async (c) => {
          try {
            const data = await readCollection(c.address);
            return {
              ...c,
              ...data,
              image: c.image || data.metadata?.image,
              priceLabel: formatBOT(data.mintPrice),
            };
          } catch {
            return { ...c, priceLabel: c.mintPriceBOT ? `${c.mintPriceBOT} BOT` : "?" };
          }
        })
      );
      if (!cancelled) setCollections(live);
    })();
    return () => {
      cancelled = true;
    };
  }, [address, isConnected, refreshKey, publicClient]);

  const canManage = useCallback(
    (collection) => {
      if (!isConnected || !address) return false;
      return collection.owner?.toLowerCase() === address.toLowerCase();
    },
    [isConnected, address]
  );

  /** Validate + read a pasted contract address, then add it to the registry. */
  const handleImport = async () => {
    setImportError("");
    const normalized = normalizeAddress(importAddress);
    if (!normalized) {
      setImportError("That is not a valid contract address.");
      return;
    }
    setImporting(true);
    try {
      const existing = getCollection(normalized, ACTIVE_CHAIN.chainId);
      if (existing) {
        setImportAddress("");
        setRefreshKey((k) => k + 1);
        return;
      }
      const data = await readCollection(normalized);
      saveCollection({
        address: normalized,
        chainId: ACTIVE_CHAIN.chainId,
        productName: data.productName,
        accessTier: data.accessTier,
        deploymentTx: "",
        createdAt: Date.now(),
        description: data.metadata?.description || "",
        image: data.metadata?.image || "",
      });
      setImportAddress("");
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setImportError(friendlyErrorMessage(err, "transaction").message);
    } finally {
      setImporting(false);
    }
  };

  const shareUrl = shareTarget ? buildMintUrl(shareTarget.address, ACTIVE_CHAIN.chainId) : "";

  return (
    <div className="page">
      <div className="page-header page-header--row">
        <div>
          <h1>My Collections</h1>
          <p>Collections you created or imported in this browser. Ownership is always verified on-chain.</p>
        </div>
        <Link to="/create" className="btn btn--primary">
          + Create Collection
        </Link>
      </div>

      {/* Import */}
      <div className="card import-card">
        <h3>Import Collection</h3>
        <p className="field-hint">Paste an AccessPass contract address to track it here.</p>
        <div className="import-card__row">
          <input
            className="form-input"
            type="text"
            placeholder="0x..."
            value={importAddress}
            onChange={(e) => {
              setImportAddress(e.target.value);
              setImportError("");
            }}
          />
          <button type="button" className="btn btn--secondary" onClick={handleImport} disabled={importing}>
            {importing ? "Importing..." : "Import"}
          </button>
        </div>
        {importError && <p className="field-error">{importError}</p>}
      </div>

      {/* Grid */}
      {collections.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state__icon" aria-hidden="true">
            &#128230;
          </span>
          <h2>No collections yet</h2>
          <p>Create your first access pass, or import an existing contract address above.</p>
          <Link to="/create" className="btn btn--primary">
            Create Access Pass
          </Link>
        </div>
      ) : (
        <div className="grid grid--cards">
          {collections.map((c) => (
            <CollectionCard
              key={c.address}
              collection={c}
              canManage={canManage(c)}
              onManage={() => navigate(`/collections/${c.address}`)}
              onShare={() => setShareTarget(c)}
            />
          ))}
        </div>
      )}

      <QRShare
        open={!!shareTarget}
        onClose={() => setShareTarget(null)}
        url={shareUrl}
        productName={shareTarget?.productName}
      />
    </div>
  );
}
