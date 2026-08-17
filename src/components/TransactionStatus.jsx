/**
 * src/components/TransactionStatus.jsx
 * ------------------------------------
 * Renders the current state of a blockchain transaction with a matching
 * color and icon, so the user always knows what is happening (spec section
 * 30: never make them wonder whether the tx is still running).
 *
 * States:
 *   idle       nothing (renders nothing unless children given)
 *   preparing  building the tx
 *   waiting    wallet confirmation pending
 *   pending    tx broadcast, waiting for a block
 *   confirming receipt found, finalizing
 *   success    confirmed on-chain
 *   error      failed (friendly message)
 *
 * Optionally shows the tx hash with an explorer link once it exists.
 */

/**
 * @param {object} props
 * @param {string} props.status   one of the states above
 * @param {string} props.message  friendly status text
 * @param {string} [props.txHash] tx hash to link in the explorer
 * @param {Function} [props.explorerUrl] (txHash) => url builder
 * @param {React.ReactNode} [props.children] extra content (e.g. retry button)
 */
export default function TransactionStatus({ status, message, txHash, explorerUrl, children }) {
  if (status === "idle" || !status) return null;

  const busy = ["preparing", "waiting", "pending", "confirming"].includes(status);

  return (
    <div className={`tx-status tx-status--${status}`} role="status">
      <div className="tx-status__icon" aria-hidden="true">
        {busy ? <span className="spinner spinner--light" /> : status === "success" ? "\u2713" : "\u26A0"}
      </div>
      <div className="tx-status__body">
        <p className="tx-status__message">{message}</p>
        {txHash && explorerUrl && (
          <a className="link-btn" href={explorerUrl(txHash)} target="_blank" rel="noreferrer">
            View Transaction
          </a>
        )}
        {children}
      </div>
    </div>
  );
}
