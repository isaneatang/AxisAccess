// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title AccessPass
 * @notice One ERC-721 collection equals one access-pass product.
 *
 * @dev
 * A product owner deploys this contract to say "owning one of these NFTs
 * proves entitlement to my product". Each minted token is an access pass:
 *
 *   Token #0 -> Alice
 *   Token #1 -> Bob
 *   Token #2 -> Creator
 *
 * Design decisions (read before you judge):
 *
 *  1. Metadata is a single on-chain `data:` URI shared by the whole
 *     collection. It must NEVER contain secrets (passwords, API keys,
 *     access codes). The NFT only proves entitlement; real service
 *     verification is a future Verification SDK, not this contract's job.
 *
 *  2. tokenURI(tokenId) is overridden so the collection shares one metadata
 *     blob. _requireOwned keeps the ERC-721 guarantee that a nonexistent or
 *     burned token reverts.
 *
 *  3. One pass per wallet is enforced with balanceOf(to) == 0. After a burn,
 *     the wallet is free to mint again, which is intended: burning removes
 *     the entitlement, so the seat is freed.
 *
 *  4. Payment is pulled in USDT (an ERC-20), not native BOT: the mint price
 *     is stable against the dollar even though BOT gas fluctuates. The
 *     buyer approves the collection once, then mint() transfers the exact
 *     price via safeTransferFrom (SafeERC20 handles non-standard tokens).
 *
 *  5. metadataURI is upgradeable via setMetadataURI (owner only) so a future
 *     IPFS/Arweave migration does not need a new contract.
 */

contract AccessPass is ERC721, ERC721Burnable, Ownable {
    using SafeERC20 for IERC20;

    /* ------------------------------------------------------------------ */
    /* State                                                               */
    /* ------------------------------------------------------------------ */

    /// @notice Hard cap on mintable passes, fixed at construction.
    uint256 public maxSupply;

    /// @notice Public mint price denominated in paymentToken units
    ///         (USDT has 6 decimals, so "5 USDT" is 5000000).
    uint256 public mintPrice;

    /// @notice ERC-20 used to pay for mints. Bridged USDT on BOT Chain,
    ///         fixed at construction and immutable afterwards.
    IERC20 public immutable paymentToken;

    /// @notice Passes minted so far. Doubles as the next token id.
    uint256 public totalMinted;

    /// @notice Human-readable product name, e.g. "AI Pro".
    string public productName;

    /// @notice Access tier this collection grants: Basic | Pro | Premium | Enterprise.
    string public accessTier;

    /// @notice Collection-level metadata as a `data:` URI. Private storage
    ///         exposed through a getter plus an owner-only setter.
    string private _metadataURI;

    /* ------------------------------------------------------------------ */
    /* Constructor                                                         */
    /* ------------------------------------------------------------------ */

    /**
     * @param name_          ERC-721 collection name (e.g. "AI Pro Pass").
     * @param symbol_        ERC-721 ticker (e.g. "AIPP").
     * @param productName_   Display name of the product this pass unlocks.
     * @param accessTier_    Tier label (Basic/Pro/Premium/Enterprise).
     * @param maxSupply_     Maximum number of passes (must be > 0).
     * @param mintPrice_     Public mint price in paymentToken units.
     * @param paymentToken_  ERC-20 accepted as payment (bridged USDT).
     * @param metadataURI_   Data URI carrying name/description/image/attributes.
     */
    constructor(
        string memory name_,
        string memory symbol_,
        string memory productName_,
        string memory accessTier_,
        uint256 maxSupply_,
        uint256 mintPrice_,
        address paymentToken_,
        string memory metadataURI_
    ) ERC721(name_, symbol_) Ownable(msg.sender) {
        require(maxSupply_ > 0, "Max supply must be greater than zero");
        require(paymentToken_ != address(0), "Payment token required");
        maxSupply = maxSupply_;
        mintPrice = mintPrice_;
        paymentToken = IERC20(paymentToken_);
        productName = productName_;
        accessTier = accessTier_;
        _metadataURI = metadataURI_;
        // totalMinted starts at 0; token ids begin at 0.
    }

    /* ------------------------------------------------------------------ */
    /* Public paid mint                                                    */
    /* ------------------------------------------------------------------ */

    /**
     * @notice Public mint. Anyone with the payment token (USDT) can buy a pass.
     * @param to Recipient of the freshly minted pass.
     * @return tokenId The minted token id.
     * @dev One pass per wallet (balanceOf(to) == 0), supply capped. The
     *      caller must have approved this contract to spend at least
     *      mintPrice of paymentToken; the exact price is pulled from the
     *      caller. Gas is still paid in native BOT.
     */
    function mint(address to) external returns (uint256) {
        require(to != address(0), "Invalid recipient");
        require(balanceOf(to) == 0, "Already owns a pass");
        require(totalMinted < maxSupply, "Supply exhausted");

        // Pull the exact price before minting. SafeERC20 tolerates tokens
        // that return no bool (USDT-style). State changes first, then the
        // external _safeMint callback.
        uint256 tokenId = totalMinted;
        totalMinted += 1;
        paymentToken.safeTransferFrom(msg.sender, address(this), mintPrice);
        _safeMint(to, tokenId);
        return tokenId;
    }

    /* ------------------------------------------------------------------ */
    /* Creator gift mint                                                   */
    /* ------------------------------------------------------------------ */

    /**
     * @notice Owner-only free mint for partners, testers, influencers, team.
     * @param to Recipient of the gifted pass.
     * @return tokenId The minted token id.
     * @dev The creator pays only gas. Same one-per-wallet and supply rules
     *      as the public mint, so the owner cannot print infinite passes.
     */
    function giftMint(address to) external onlyOwner returns (uint256) {
        require(to != address(0), "Invalid recipient");
        require(balanceOf(to) == 0, "Already owns a pass");
        require(totalMinted < maxSupply, "Supply exhausted");

        uint256 tokenId = totalMinted;
        totalMinted += 1;
        _safeMint(to, tokenId);
        return tokenId;
    }

    /* ------------------------------------------------------------------ */
    /* Withdraw                                                            */
    /* ------------------------------------------------------------------ */

    /**
     * @notice Sends the contract's entire paymentToken (USDT) balance to
     *         the owner. Native BOT sent here by mistake is NOT withdrawable.
     * @dev Reverts if there is nothing to withdraw. Owner only.
     */
    function withdraw() external onlyOwner {
        uint256 balance = IERC20(paymentToken).balanceOf(address(this));
        require(balance > 0, "No balance to withdraw");

        SafeERC20.safeTransfer(IERC20(paymentToken), owner(), balance);
    }

    /* ------------------------------------------------------------------ */
    /* Metadata                                                            */
    /* ------------------------------------------------------------------ */

    /**
     * @notice ERC-721 metadata override, returns the shared collection URI.
     * @dev _requireOwned makes this revert for nonexistent or burned tokens,
     *      keeping the ERC-721 spec honest (no fake metadata for ghost NFTs).
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return _metadataURI;
    }

    /// @notice Getter for the raw metadata URI (collection level).
    /// @dev Needed because tokenURI refuses to answer before token #0 exists,
    ///      and the public mint page must show product details beforehand.
    function metadataURI() external view returns (string memory) {
        return _metadataURI;
    }

    /**
     * @notice Owner-only metadata swap. Lets the creator migrate to
     *         IPFS/Arweave or fix a typo without redeploying the collection.
     * @param newURI The new metadata URI.
     */
    function setMetadataURI(string calldata newURI) external onlyOwner {
        _metadataURI = newURI;
    }
}
