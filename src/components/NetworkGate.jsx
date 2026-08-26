/**
 * src/components/NetworkGate.jsx
 * ------------------------------
 * The "BOT Chain Mainnet is required" banner.
 *
 * Shown on pages that need a transaction when the connected wallet is on
 * the wrong network. One button: "Switch to BOT Chain Mainnet", which asks
 * the wallet (with its own approval UI, never silently). If the wallet
 * cannot switch, the friendly error message explains how to add the chain
 * manually.
 */

import { useWallet } from "../context/WalletContext";
import { ACTIVE_CHAIN } from "../config/chains";

/**
 * @param {object} props
 * @param {string} [props.title] override the default title text
 */
export default function NetworkGate({ title }) {
  const { switchToActiveNetwork, error, clearError, switching } = useWallet();

  return (
    <div className="network-gate">
      <div className="network-gate__icon" aria-hidden="true">
        &#9889;
      </div>
      <div className="network-gate__body">
        <h3>{title || `${ACTIVE_CHAIN.name} is required.`}</h3>
        <p>Switch networks in your wallet to continue. You approve the change, we never do it silently.</p>
        {error && <p className="network-gate__error">{error}</p>}
        <button
          type="button"
          className="btn btn--primary btn--sm"
          onClick={() => {
            clearError();
            switchToActiveNetwork();
          }}
          disabled={switching}
        >
          {switching ? "Switching..." : `Switch to ${ACTIVE_CHAIN.name}`}
        </button>
        {error && (
          <p className="field-hint">
            Your wallet may not know chain {ACTIVE_CHAIN.chainId} yet. Add it manually in your wallet app
            (RPC: {ACTIVE_CHAIN.rpcUrl}), then come back.
          </p>
        )}
      </div>
    </div>
  );
}
