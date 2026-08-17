/**
 * src/pages/PublicMint.jsx
 * ------------------------
 * The buyer-facing PUBLIC mint page (spec sections 23, 27-28).
 *
 * URL shape (deterministic, no backend):
 *   /mint?chain=968&contract=0x...
 *
 * Anyone can VIEW the collection without a wallet. To mint, the buyer:
 *   1. connects their wallet (Reown picker: extension or mobile QR)
 *   2. gets switched to BOT Chain Testnet (wallet approval required)
 *   3. we check balanceOf(buyer) for the one-pass-per-wallet rule
 *   4. they pay mintPrice and the NFT lands in their wallet (real tx)
 *
 * The page also registers the collection in the local registry so the
 * buyer's My Passes page knows about it later.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useWallet } from "../context/WalletContext";
import { readCollection, readBalanceOf, readBalance, mintPass, confirmTransaction, extractMintedTokenId } from "../blockchain/contract";
import { saveCollection } from "../utils/storage";
import { isValidAddress } from "../utils/validation";
import { friendlyErrorMessage } from "../utils/errors";
import { useTxFlow } from "../utils/tx";
import { formatBOT, shortenAddress, txExplorerUrl, addressExplorerUrl } from "../utils/formatting";
import { buildMintUrl, FAUCET_URL } from "../config/constants";
import { ACTIVE_CHAIN } from "../config/chains";
import TransactionStatus from "../components/TransactionStatus";
import NetworkGate from "../components/NetworkGate";
import WalletModal from "../components/WalletModal";

export default function PublicMint() {
  const [searchParams] = useSearchParams();
  const chainParam = searchParams.get("chain");
  const contractParam = searchParams.get("contract");
  const { address, isConnected, isOnActiveNetwork, walletClient } = useWallet();

  const [collection, setCollection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [buyerOwns, setBuyerOwns] = useState(false);
  const [buyerBalance, setBuyerBalance] = useState(null); // bigint
  const [showWalletModal, setShowWalletModal] = useState(false);
  const { status, message, result, rawError, run, reset } = useTxFlow();

  const validContract = isValidAddress(contractParam);
  const wrongNetwork = chainParam && Number(chainParam) !== ACTIVE_CHAIN.chainId;

  /* -------- load collection (viewable without a wallet) -------- */
  const load = useCallback(async () => {
    if (!validContract) {
      setLoadError("Missing or invalid contract address.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError("");
    try {
      const live = await readCollection(contractParam);
      setCollection(live);

      // Register in the local registry so My Passes can find it later.
      saveCollection({
        address: live.address,
        chainId: ACTIVE_CHAIN.chainId,
        productName: live.productName,
        accessTier: live.accessTier,
        deploymentTx: "",
        createdAt: Date.now(),
        description: live.metadata?.description || "",
        image: live.metadata?.image || "",
      });

      if (isConnected) {
        const owns = await readBalanceOf(live.address, address);
        setBuyerOwns(owns > 0n);
        setBuyerBalance(await readBalance(address));
      }
    } catch (err) {
      setLoadError(friendlyErrorMessage(err, "transaction").message);
    } finally {
      setLoading(false);
    }
  }, [contractParam, validContract, isConnected, address]);

  useEffect(() => {
    load();
  }, [load]);

  // Re-check ownership when the wallet connects or changes.
  useEffect(() => {
    if (collection && isConnected) {
      readBalanceOf(collection.address, address)
        .then((owns) => setBuyerOwns(owns > 0n))
        .catch(() => {});
      readBalance(address)
        .then(setBuyerBalance)
        .catch(() => {});
    } else {
      setBuyerOwns(false);
      setBuyerBalance(null);
    }
  }, [isConnected, address, collection]);

  const soldOut = collection ? collection.remaining <= 0n : false;
  const needsFaucet = buyerBalance !== null && buyerBalance < (collection?.mintPrice ?? 0n);
  const mintUrl = useMemo(
    () => buildMintUrl(contractParam, ACTIVE_CHAIN.chainId),
    [contractParam]
  );

  /* -------- buyer mint flow -------- */
  const handleMint = async () => {
    if (status === "success" || ["preparing", "waiting", "pending", "confirming"].includes(status)) return;
    if (!collection) return;

    if (!isConnected) {
      // Open the Reown wallet picker; the mint button reappears after connect.
      setShowWalletModal(true);
      return;
    }

    const { status: flowStatus, error } = await run(
      () => mintPass(collection.address, address, formatBOT(collection.mintPrice), walletClient),
      confirmTransaction,
      {
        preparing: "Preparing your mint...",
        waiting: "Waiting for your wallet to confirm...",
        pending: "Mint submitted, waiting for confirmation...",
        confirming: "Mint confirmed!",
        success: "Access Pass minted!",
      }
    );

    if (flowStatus === "success") {
      await load(); // refresh minted/remaining/ownership
    } else if (error) {
      const friendly = friendlyErrorMessage(error, "transaction");
      setLoadError(friendly.message);
    }
  };

  /* -------- loading / error -------- */
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

  if (wrongNetwork) {
    return (
      <div className="page page--narrow">
        <div className="empty-state">
          <span className="empty-state__icon" aria-hidden="true">
            &#127760;
          </span>
          <h2>This pass lives on another network</h2>
          <p>
            This link points at chain {chainParam}, but this app is running on {ACTIVE_CHAIN.name} (chain{" "}
            {ACTIVE_CHAIN.chainId}). Open the link on the correct network or check the address.
          </p>
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
          </div>
        </div>
      </div>
    );
  }

  const image = collection.metadata?.image;
  const displayName = collection.metadata?.name || `${collection.productName} Pass`;
  const remaining = collection.remaining;
  const pct =
    collection.maxSupply > 0n ? Number((collection.totalMinted * 100n) / collection.maxSupply) : 0;

  /* -------- success screen -------- */
  if (status === "success" && result?.receipt) {
    const tokenId = extractMintedTokenId(result.receipt);
    return (
      <div className="page page--narrow">
        <div className="success-screen">
          <div className="success-screen__icon" aria-hidden="true">
            &#127881;
          </div>
          <h1 className="success-screen__title">Access Pass Minted</h1>
          {tokenId !== null && tokenId !== undefined ? (
            <p className="success-screen__token">Token #{tokenId.toString()}</p>
          ) : (
            <p className="success-screen__token">Token minted</p>
          )}
          <dl className="result-list result-list--center">
            <div>
              <dt>Owner</dt>
              <dd className="result-list__mono">{shortenAddress(address)}</dd>
            </div>
            <div>
              <dt>Transaction</dt>
              <dd className="result-list__mono">
                {shortenAddress(result.txHash)}
                <a className="link-btn" href={txExplorerUrl(result.txHash)} target="_blank" rel="noreferrer">
                  View Transaction
                </a>
              </dd>
            </div>
          </dl>
          <div className="success-screen__actions">
            <Link to="/passes" className="btn btn--primary">
              View My Passes
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* -------- collection display + mint CTA -------- */
  return (
    <div className="page page--narrow">
      <div className="mint-card">
        <div className="mint-card__media">
          {image ? (
            <img src={image} alt={displayName} />
          ) : (
            <div className="nft-card__placeholder">
              <span aria-hidden="true">&#127915;</span>
            </div>
          )}
        </div>

        <div className="mint-card__body">
          <span className="badge badge--tier">{collection.accessTier}</span>
          <h1 className="mint-card__title">{displayName}</h1>
          {collection.metadata?.description && (
            <p className="mint-card__desc">{collection.metadata.description}</p>
          )}

          <div className="mint-card__stats">
            <div className="stat">
              <span className="stat__label">Price</span>
              <span className="stat__value">{formatBOT(collection.mintPrice)} BOT</span>
            </div>
            <div className="stat">
              <span className="stat__label">Minted</span>
              <span className="stat__value">
                {collection.totalMinted.toString()} / {collection.maxSupply.toString()}
              </span>
            </div>
            <div className="stat">
              <span className="stat__label">Remaining</span>
              <span className="stat__value">{remaining.toString()}</span>
            </div>
          </div>

          <div className="progress" aria-label={`${pct}% minted`}>
            <div className="progress__bar" style={{ width: `${Math.min(100, pct)}%` }} />
          </div>

          <p className="mint-card__contract">
            Contract:{" "}
            <a href={addressExplorerUrl(collection.address)} target="_blank" rel="noreferrer" title={collection.address}>
              {shortenAddress(collection.address)}
            </a>
          </p>

          <TransactionStatus status={status} message={message} txHash={result?.txHash} explorerUrl={txExplorerUrl} rawError={rawError}>
            {status === "error" && (
              <button type="button" className="btn btn--secondary btn--sm" onClick={reset}>
                Try Again
              </button>
            )}
          </TransactionStatus>

          {isConnected && !isOnActiveNetwork && <NetworkGate />}

          {/* CTA area: the state machine of buyer life */}
          {soldOut ? (
            <div className="tx-status tx-status--error">
              <div className="tx-status__body">
                <strong>Sold out, no passes remaining.</strong>
              </div>
            </div>
          ) : buyerOwns ? (
            <div className="tx-status tx-status--success">
              <div className="tx-status__body">
                <strong>You already own a pass from this collection.</strong>
              </div>
            </div>
          ) : !isConnected ? (
            <button type="button" className="btn btn--primary btn--lg btn--block" onClick={handleMint}>
              Connect Wallet
            </button>
          ) : needsFaucet ? (
            <div className="tx-status tx-status--error">
              <div className="tx-status__body">
                <strong>Not enough BOT testnet funds (need {formatBOT(collection.mintPrice)} BOT).</strong>
                <p className="field-hint">Grab free testnet BOT from the official faucet, then come back.</p>
                <a className="btn btn--secondary btn--sm" href={FAUCET_URL} target="_blank" rel="noreferrer">
                  Open faucet
                </a>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn--primary btn--lg btn--block"
              onClick={handleMint}
              disabled={["preparing", "waiting", "pending", "confirming"].includes(status)}
            >
              {["preparing", "waiting", "pending", "confirming"].includes(status) ? "Minting..." : "Mint Access Pass"}
            </button>
          )}

          <p className="field-hint field-hint--center">One pass per wallet. Share: {mintUrl}</p>
        </div>
      </div>

      <WalletModal open={showWalletModal} onClose={() => setShowWalletModal(false)} />
    </div>
  );
}
