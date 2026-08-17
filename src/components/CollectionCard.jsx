/**
 * src/components/CollectionCard.jsx
 * ---------------------------------
 * A collection card for the My Collections page.
 *
 * Shows the product image (or placeholder), name, tier, contract address,
 * minted/supply and price. Actions: Manage (owner only) and Share.
 *
 * The "canManage" flag comes from the parent page, which checks the live
 * contract owner() against the connected wallet. Never trust localStorage.
 */

import { shortenAddress, addressExplorerUrl } from "../utils/formatting";

/**
 * @param {object} props
 * @param {object} props.collection collection record (registry shape + live stats)
 * @param {boolean} props.canManage  is the connected wallet the contract owner?
 * @param {Function} props.onManage  () => void
 * @param {Function} props.onShare   () => void
 */
export default function CollectionCard({ collection, canManage, onManage, onShare }) {
  const image = collection.image || collection.metadata?.image;
  const name = collection.productName || collection.metadata?.name;
  const minted = collection.totalMinted !== undefined ? collection.totalMinted.toString() : "?";
  const supply = collection.maxSupply !== undefined ? collection.maxSupply.toString() : "?";

  return (
    <div className="card collection-card">
      <div className="collection-card__media">
        {image ? (
          <img src={image} alt={name} loading="lazy" />
        ) : (
          <div className="nft-card__placeholder">
            <span aria-hidden="true">&#127915;</span>
          </div>
        )}
        <span className="badge badge--tier">{collection.accessTier}</span>
      </div>

      <div className="collection-card__body">
        <h3 className="collection-card__title">{name}</h3>
        <a
          className="collection-card__address"
          href={addressExplorerUrl(collection.address)}
          target="_blank"
          rel="noreferrer"
          title={collection.address}
        >
          {shortenAddress(collection.address)}
        </a>

        <div className="collection-card__stats">
          <span>
            Minted: <strong>{minted} / {supply}</strong>
          </span>
          <span>
            Price: <strong>{collection.priceLabel || "?"}</strong>
          </span>
        </div>

        <div className="card__actions">
          {canManage ? (
            <button type="button" className="btn btn--primary btn--sm" onClick={onManage}>
              Manage
            </button>
          ) : (
            <span className="badge badge--muted">Not owner</span>
          )}
          <button type="button" className="btn btn--secondary btn--sm" onClick={onShare}>
            Share
          </button>
        </div>
      </div>
    </div>
  );
}
