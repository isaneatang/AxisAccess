/**
 * src/components/WalletButton.jsx
 * -------------------------------
 * The navbar wallet control.
 *
 * Disconnected: a "Connect Wallet" button that opens the Reown wallet
 * picker (browser wallets, WalletConnect QR, mobile deep links).
 * Connected: a chip showing the shortened address with a disconnect option
 * and a subtle "wrong network" warning when the wallet is on another chain.
 *
 * It never pokes window.ethereum; everything flows through Reown AppKit via
 * the WalletContext.
 */

import { useState } from "react";
import { useWallet } from "../context/WalletContext";
import { shortenAddress, addressExplorerUrl } from "../utils/formatting";
import { ACTIVE_CHAIN } from "../config/chains";

export default function WalletButton() {
  const { address, isConnected, isOnActiveNetwork, connect, disconnect, walletProviderType } = useWallet();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!isConnected) {
    return (
      <button type="button" className="btn btn--primary" onClick={connect}>
        Connect Wallet
      </button>
    );
  }

  const transportLabel = walletProviderType === "walletConnect" ? "WC" : "Injected";

  return (
    <div className="wallet-chip-wrap">
      <button
        type="button"
        className={`wallet-chip ${isOnActiveNetwork ? "" : "wallet-chip--warn"}`}
        onClick={() => setMenuOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
      >
        <span className="wallet-chip__dot" aria-hidden="true" />
        <span>{shortenAddress(address)}</span>
        <span className="wallet-chip__tag">{transportLabel}</span>
      </button>

      {menuOpen && (
        <div className="wallet-menu" role="menu">
          {!isOnActiveNetwork && (
            <div className="wallet-menu__hint">
              Wrong network. Switch to {ACTIVE_CHAIN.name} in your wallet.
            </div>
          )}
          <a
            className="wallet-menu__item"
            href={addressExplorerUrl(address)}
            target="_blank"
            rel="noreferrer"
            role="menuitem"
          >
            View on Explorer
          </a>
          <button
            type="button"
            className="wallet-menu__item wallet-menu__item--danger"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              disconnect();
            }}
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
