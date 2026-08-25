/**
 * src/pages/CreatePass.jsx
 * ------------------------
 * The creator's "Create Access Pass" page (spec sections 18-19).
 *
 * Flow: fill the form -> live preview -> connect wallet -> deploy a real
 * AccessPass contract from the creator's wallet -> save to the local
 * registry -> success screen with contract address + tx hash + explorer
 * links.
 *
 * The image is compressed in the browser (max 512px, JPEG) before it goes
 * into the on-chain metadata, so the deploy transaction stays small.
 */

import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useWallet } from "../context/WalletContext";
import {
  deployCollection,
  confirmTransaction,
  contractAddressFromReceipt,
  buildMetadataURI,
} from "../blockchain/contract";
import { compressImage } from "../utils/image";
import { saveCollection } from "../utils/storage";
import { friendlyErrorMessage } from "../utils/errors";
import { useTxFlow } from "../utils/tx";
import { ACCESS_TIERS, MAX_IMAGE_DIMENSION, MAX_METADATA_URI_LENGTH } from "../config/constants";
import {
  validateProductName,
  validateDescription,
  validateAccessTier,
  validatePrice,
  validateSupply,
} from "../utils/validation";
import { txExplorerUrl, addressExplorerUrl, shortenAddress, copyToClipboard } from "../utils/formatting";
import TransactionStatus from "../components/TransactionStatus";
import NetworkGate from "../components/NetworkGate";
import WalletModal from "../components/WalletModal";
import TierSelect from "../components/TierSelect";

const EMPTY_FORM = {
  productName: "",
  description: "",
  accessTier: "Pro",
  price: "",
  supply: "",
  image: "",
};

export default function CreatePass() {
  const { isConnected, isOnActiveNetwork, walletClient, publicClient, switchToActiveNetwork } = useWallet();
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [copied, setCopied] = useState(null);
  const { status, message, result, rawError, run, reset } = useTxFlow();

  const symbol = useMemo(() => {
    const base = (form.productName || "PASS")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase()
      .slice(0, 4);
    return base || "PASS";
  }, [form.productName]);

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((prev) => ({ ...prev, [key]: null }));
  };

  /** Compress and store the chosen image as a data URL (or clear it). */
  const handleImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImage(file);
      setForm((f) => ({ ...f, image: dataUrl }));
    } catch (err) {
      setErrors((prev) => ({ ...prev, image: err.message }));
    }
  };

  const validate = () => {
    const next = {
      productName: validateProductName(form.productName),
      description: validateDescription(form.description),
      accessTier: validateAccessTier(form.accessTier, ACCESS_TIERS),
      price: validatePrice(form.price),
      supply: validateSupply(form.supply),
    };
    setErrors(next);
    return !Object.values(next).some(Boolean);
  };

  /**
   * Deploy the collection. Runs through useTxFlow so the user sees every
   * state and duplicate clicks are ignored.
   */
  const handleDeploy = async () => {
    if (!validate()) return;
    if (!isConnected) {
      setShowWalletModal(true);
      return;
    }
    if (!walletClient) {
      setErrors((prev) => ({ ...prev, form: "Wallet not ready. Reconnect and try again." }));
      return;
    }

    // Never fire a deployment from the wrong network. Ask the wallet to
    // switch to BOT Chain Testnet first (with its own approval UI); if it
    // cannot, stop here - the friendly error + manual add-chain hint are
    // shown by NetworkGate. Deploying anyway is how you get "No network" /
    // "Can't connect" from mobile wallets.
    if (!isOnActiveNetwork) {
      const switched = await switchToActiveNetwork();
      if (!switched?.ok) return;
    }

    const metadataURI = buildMetadataURI({
      name: `${form.productName} Pass`,
      description: form.description,
      image: form.image,
      accessTier: form.accessTier,
      maxSupply: form.supply,
      mintPriceUSDT: form.price,
    });

    // The metadata URI is a constructor argument: every kilobyte of it is
    // deployment gas. Over the cap and the deploy gets too expensive to
    // estimate reliably (this is a big part of the mobile-wallet deploy
    // failures). Reject early with a clear, actionable message.
    if (metadataURI.length > MAX_METADATA_URI_LENGTH) {
      setErrors((prev) => ({
        ...prev,
        image: `This image is too large to store on-chain. Use a smaller or simpler image (max ~${MAX_IMAGE_DIMENSION}px).`,
      }));
      return;
    }

    const { status: flowStatus, result: flowResult, error } = await run(
      () =>
        deployCollection(
          {
            name: `${form.productName} Pass`,
            symbol,
            productName: form.productName,
            accessTier: form.accessTier,
            maxSupply: form.supply,
            mintPriceUSDT: form.price,
            metadataURI,
          },
          walletClient
        ),
      confirmTransaction,
      {
        preparing: "Preparing deployment...",
        waiting: "Waiting for your wallet to confirm the deployment...",
        pending: "Deployment submitted. Waiting for confirmation...",
        confirming: "Deployment confirmed. Registering your collection...",
        success: "Collection deployed!",
      },
      "deployment" // error-mapping context: deployment-specific friendly fallback
    );

    if (flowStatus !== "success" || !flowResult?.receipt) {
      if (error) {
        const friendly = friendlyErrorMessage(error, "deployment");
        setErrors((prev) => ({ ...prev, form: friendly.message }));
      }
      return;
    }

    const contractAddress = contractAddressFromReceipt(flowResult.receipt);
    if (!contractAddress) {
      setErrors((prev) => ({ ...prev, form: "Deployment succeeded but no contract address was returned." }));
      return;
    }

    // Register in the local registry so Collections/My Passes can find it.
    saveCollection({
      address: contractAddress,
      chainId: publicClient.chain.id,
      productName: form.productName,
      accessTier: form.accessTier,
      deploymentTx: flowResult.txHash,
      createdAt: Date.now(),
      description: form.description,
      image: form.image,
      mintPriceUSDT: form.price,
      maxSupply: form.supply,
    });
  };

  /* ------------------------- Success screen ------------------------- */
  if (status === "success" && result?.receipt) {
    const contractAddress = contractAddressFromReceipt(result.receipt);
    return (
      <div className="page page--narrow">
        <div className="success-screen">
          <div className="success-screen__icon" aria-hidden="true">
            &#127881;
          </div>
          <h1 className="success-screen__title">Collection Deployed</h1>
          <p className="success-screen__subtitle">
            {form.productName} is live on BOT Chain Testnet. Share the mint link so buyers can start minting.
          </p>

          <dl className="result-list result-list--center">
            <div>
              <dt>Contract Address</dt>
              <dd className="result-list__mono">
                {shortenAddress(contractAddress)}
                <button
                  type="button"
                  className="link-btn"
                  onClick={async () => setCopied(await copyToClipboard(contractAddress) ? "address" : null)}
                >
                  {copied === "address" ? "Copied!" : "Copy"}
                </button>
                <a className="link-btn" href={addressExplorerUrl(contractAddress)} target="_blank" rel="noreferrer">
                  View Contract
                </a>
              </dd>
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
            <Link to={`/collections/${contractAddress}`} className="btn btn--primary">
              Manage Collection
            </Link>
            <Link to="/collections" className="btn btn--secondary">
              My Collections
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ------------------------- Main form ------------------------- */
  const previewImage = form.image;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Create Access Pass</h1>
        <p>Deploy a real NFT collection from your wallet. One pass per wallet, enforced on-chain.</p>
      </div>

      <div className="grid grid--2 create-grid">
        {/* Form column */}
        <div className="card form-card">
          <div className="form-group">
            <label className="form-label" htmlFor="productName">
              Product Name
            </label>
            <input
              id="productName"
              className="form-input"
              type="text"
              placeholder="e.g. Axis AI Pro"
              value={form.productName}
              onChange={set("productName")}
              maxLength={60}
            />
            {errors.productName && <p className="field-error">{errors.productName}</p>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="description">
              Description
            </label>
            <textarea
              id="description"
              className="form-input form-textarea"
              placeholder="What does this pass unlock?"
              value={form.description}
              onChange={set("description")}
              maxLength={500}
              rows={3}
            />
            {errors.description && <p className="field-error">{errors.description}</p>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="accessTier">
              Access Tier
            </label>
            {/* Custom dropdown, not a native <select>: in-app wallet browsers
                (Bitget, OKX, Zerion) swallow the native option picker, so the
                list is built from plain buttons that work in every WebView. */}
            <TierSelect
              id="accessTier"
              value={form.accessTier}
              options={ACCESS_TIERS}
              onChange={(value) => {
                setForm((f) => ({ ...f, accessTier: value }));
                setErrors((prev) => ({ ...prev, accessTier: null }));
              }}
            />
            {errors.accessTier && <p className="field-error">{errors.accessTier}</p>}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="price">
                Price (USDT)
              </label>
              <input
                id="price"
                className="form-input"
                type="text"
                inputMode="decimal"
                placeholder="0.5"
                value={form.price}
                onChange={set("price")}
              />
              {errors.price && <p className="field-error">{errors.price}</p>}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="supply">
                Maximum Supply
              </label>
              <input
                id="supply"
                className="form-input"
                type="text"
                inputMode="numeric"
                placeholder="100"
                value={form.supply}
                onChange={set("supply")}
              />
              {errors.supply && <p className="field-error">{errors.supply}</p>}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="image">
              Image (optional)
            </label>
            <input id="image" className="form-input" type="file" accept="image/*" onChange={handleImage} />
            <p className="field-hint">
              Compressed to max {MAX_IMAGE_DIMENSION}px in your browser before deployment. Smaller image = cheaper
              deploy (images are stored on-chain).
            </p>
            {errors.image && <p className="field-error">{errors.image}</p>}
          </div>

          {errors.form && (
            <div className="tx-status tx-status--error">
              <div className="tx-status__body">
                <p className="tx-status__message">{errors.form}</p>
              </div>
            </div>
          )}

          <TransactionStatus
            status={status}
            message={message}
            txHash={result?.txHash}
            explorerUrl={txExplorerUrl}
            rawError={rawError}
          >
            {status === "error" && (
              <button type="button" className="btn btn--secondary btn--sm" onClick={reset}>
                Try Again
              </button>
            )}
          </TransactionStatus>

          {isConnected && !isOnActiveNetwork && <NetworkGate />}

          <div className="form-actions">
            <button
              type="button"
              className="btn btn--primary btn--lg btn--block"
              onClick={handleDeploy}
              disabled={["preparing", "waiting", "pending", "confirming"].includes(status)}
            >
              {["preparing", "waiting", "pending", "confirming"].includes(status) ? "Deploying..." : "Create Access Pass"}
            </button>
          </div>
        </div>

        {/* Preview column */}
        <div className="card preview-card">
          <h3 className="preview-card__title">Live Preview</h3>
          <div className="preview-card__nft">
            <div className="nft-card__media preview-card__media">
              {previewImage ? (
                <img src={previewImage} alt="Preview" />
              ) : (
                <div className="nft-card__placeholder">
                  <span aria-hidden="true">&#127915;</span>
                </div>
              )}
              <span className="badge badge--tier">{form.accessTier}</span>
            </div>
            <div className="preview-card__body">
              <h4>{form.productName ? `${form.productName} Pass` : "Your Pass Name"}</h4>
              <p className="preview-card__desc">{form.description || "Your description will appear here."}</p>
              <div className="preview-card__stats">
                <span>Price: <strong>{form.price ? `${form.price} USDT` : "0 USDT"}</strong></span>
                <span>Supply: <strong>{form.supply || "0"}</strong></span>
                <span>Symbol: <strong>{symbol}</strong></span>
              </div>
            </div>
          </div>
          <p className="field-hint">
            Metadata is stored on-chain as a data URI. It contains only the name, description, image and
            attributes, never secrets.
          </p>
        </div>
      </div>

      <WalletModal open={showWalletModal} onClose={() => setShowWalletModal(false)} />
    </div>
  );
}
