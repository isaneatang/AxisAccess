/**
 * src/components/NFTCard.jsx
 * --------------------------
 * A single owned access pass, shown on My Passes.
 *
 * Displays the NFT image (or a tasteful placeholder), product name, tier,
 * token id and the collection address. Actions are wired by the parent
 * page: View (explorer), Send, Burn.
 */

import { shortenAddress, tokenExplorerUrl } from "../utils/formatting";

/**
 * @param {object} props
 * @param {object} props.pass        { tokenId, owner, collection, metadata, ... }
 * @param {Function} props.onSend    (pass) => void
 * @param {Function} props.onBurn    (pass) => void
 */
export default function NFTCard({ pass, onSend, onBurn }) {
  const image = pass.metadata?.image;
  const name = pass.metadata?.name || `${pass.collection.productName} Pass`;
  const tokenUrl = tokenExplorerUrl(pass.collection.address, pass.tokenId);

  return (
    <div className="card nft-card">
      <div className="nft-card__media">
        {image ? (
          <img src={image} alt={name} loading="lazy" />
        ) : (
          <div className="nft-card__placeholder">
            <span aria-hidden="true">&#127915;</span>
          </div>
        )}
        <span className="badge badge--tier">{pass.collection.accessTier}</span>
      </div>

      <div className="nft-card__body">
        <h3 className="nft-card__title">{name}</h3>
        <p className="nft-card__meta">
          Token #{pass.tokenId.toString()} &middot; {shortenAddress(pass.collection.address)}
        </p>

        <div className="card__actions">
          <a className="btn btn--ghost btn--sm" href={tokenUrl} target="_blank" rel="noreferrer">
            View
          </a>
          <button type="button" className="btn btn--secondary btn--sm" onClick={() => onSend(pass)}>
            Send
          </button>
          <button type="button" className="btn btn--danger btn--sm" onClick={() => onBurn(pass)}>
            Burn
          </button>
        </div>
      </div>
    </div>
  );
}
