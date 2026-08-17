/**
 * src/components/WalletModal.jsx
 * ------------------------------
 * The branded "Connect Wallet" dialog.
 *
 * This is NOT a second wallet system. It is a thin, on-brand wrapper around
 * the official Reown AppKit picker: the user clicks a button and Reown's
 * modal opens with browser wallets, WalletConnect QR and mobile deep links.
 *
 * Used by the Public Mint page and Home so a buyer in plain Chrome can
 * reach a mobile wallet without any browser extension.
 */

import Modal from "./Modal";
import { useWallet } from "../context/WalletContext";
import { ACTIVE_CHAIN } from "../config/chains";
import { isWalletInstalled } from "../blockchain/wallet";
import { shortenAddress, addressExplorerUrl } from "../utils/formatting";

/**
 * @param {object} props
 * @param {boolean} props.open      show the modal?
 * @param {Function} props.onClose   dismiss callback
 * @param {string} [props.title]     default "Connect Wallet"
 */
export default function WalletModal({ open, onClose, title = "Connect Wallet" }) {
  const { isConnected, address, isOnActiveNetwork, connect, disconnect, error } = useWallet();

  const installed = isWalletInstalled();

  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      {isConnected ? (
        <div className="wallet-modal">
          <p className="field-hint">Connected wallet</p>
          <code className="wallet-modal__address">{address}</code>
          <p className={`tx-status__text ${isOnActiveNetwork ? "tx-status__text--ok" : "tx-status__text--warn"}`}>
            {isOnActiveNetwork ? `On ${ACTIVE_CHAIN.name}` : `Wrong network, needs ${ACTIVE_CHAIN.name}`}
          </p>
          <a className="link-btn" href={addressExplorerUrl(address)} target="_blank" rel="noreferrer">
            View on Explorer
          </a>
          <div className="modal__actions">
            <button type="button" className="btn btn--secondary" onClick={disconnect}>
              Disconnect
            </button>
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      ) : (
        <div className="wallet-modal">
          <p className="wallet-modal__copy">
            {installed
              ? "Connect a browser wallet or a mobile wallet to continue."
              : "No browser wallet detected. Scan the QR with your mobile wallet instead."}
          </p>
          {error && <div className="tx-status tx-status--error">{error}</div>}
          <button type="button" className="btn btn--primary btn--block" onClick={connect}>
            Choose Wallet
          </button>
          <p className="field-hint field-hint--center">
            Works with MetaMask, OKX, Bitget, Trust, Coinbase Wallet and more.
          </p>
        </div>
      )}
    </Modal>
  );
}
