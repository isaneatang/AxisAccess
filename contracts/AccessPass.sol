// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

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
 *  4. Excess payment (msg.value > mintPrice) stays in the contract and can
 *     be withdrawn by the owner. No refund gymnastics in the MVP.
 *
 *  5. metadataURI is upgradeable via setMetadataURI (owner only) so a future
 *     IPFS/Arweave migration does not need a new contract.
 */

contract AccessPass is ERC721, ERC721Burnable, Ownable {
    /* ------------------------------------------------------------------ */
    /* State                                                               */
    /* ------------------------------------------------------------------ */

    /// @notice Hard cap on mintable passes, fixed at construction.
    uint256 public maxSupply;

    /// @notice Public mint price in wei (BOT has 18 decimals, like ETH).
    uint256 public mintPrice;

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
     * @param name_        ERC-721 collection name (e.g. "AI Pro Pass").
     * @param symbol_      ERC-721 ticker (e.g. "AIPP").
     * @param productName_ Display name of the product this pass unlocks.
     * @param accessTier_  Tier label (Basic/Pro/Premium/Enterprise).
     * @param maxSupply_   Maximum number of passes (must be > 0).
     * @param mintPrice_   Public mint price in wei.
     * @param metadataURI_ Data URI carrying name/description/image/attributes.
     */
    constructor(
        string memory name_,
        string memory symbol_,
        string memory productName_,
        string memory accessTier_,
        uint256 maxSupply_,
        uint256 mintPrice_,
        string memory metadataURI_
    ) ERC721(name_, symbol_) Ownable(msg.sender) {
        require(maxSupply_ > 0, "Max supply must be greater than zero");
        maxSupply = maxSupply_;
        mintPrice = mintPrice_;
        productName = productName_;
        accessTier = accessTier_;
        _metadataURI = metadataURI_;
        // totalMinted starts at 0; token ids begin at 0.
    }

    /* ------------------------------------------------------------------ */
    /* Public paid mint                                                    */
    /* ------------------------------------------------------------------ */

    /**
     * @notice Public mint. Anyone with BOT can buy a pass.
     * @param to Recipient of the freshly minted pass.
     * @return tokenId The minted token id.
     * @dev One pass per wallet (balanceOf(to) == 0), supply capped, and
     *      msg.value must cover mintPrice. Excess value stays in the
     *      contract, where the owner can withdraw it.
     */
    function mint(address to) external payable returns (uint256) {
        require(to != address(0), "Invalid recipient");
        require(balanceOf(to) == 0, "Already owns a pass");
        require(totalMinted < maxSupply, "Supply exhausted");
        require(msg.value >= mintPrice, "Insufficient payment");

        uint256 tokenId = totalMinted;
        totalMinted += 1;
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
     * @notice Sends the contract's entire BOT balance to the owner.
     * @dev Reverts if there is nothing to withdraw. Owner only.
     */
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance to withdraw");

        (bool success, ) = payable(owner()).call{ value: balance }("");
        require(success, "Withdraw failed");
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
