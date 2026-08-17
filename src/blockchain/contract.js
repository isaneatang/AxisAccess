/**
 * src/blockchain/contract.js
 * --------------------------
 * All AccessPass contract interaction: deployment, minting, gifting,
 * burning, transfers, withdrawal and every read the UI needs.
 *
 * The rule: UI components render, this module talks to the blockchain.
 * No readContract/writeContract calls scattered across components. If a page
 * needs data, it calls a function from here and gets back plain values.
 *
 * Everything that mutates state returns { txHash, receipt, ... } so the UI
 * can show REAL results (token ids parsed from the actual Transfer event,
 * never guessed).
 *
 * Write functions take a walletClient (built by WalletContext from the
 * Reown provider). Read functions use the shared public client from
 * clients.js, so they work before any wallet connects.
 */

import { parseEther, parseEventLogs, zeroAddress, encodeDeployData } from "viem";
import { accessPassAbi, accessPassBytecode } from "./artifact";
import { getPublicClient } from "./clients";
import { ACTIVE_CHAIN } from "../config/chains";

/* ------------------------------------------------------------------------ */
/* Deployment                                                               */
/* ------------------------------------------------------------------------ */

/**
 * Deploy a brand-new AccessPass collection through the creator's wallet.
 *
 * Gas strategy (this is the part that breaks on mobile wallets):
 *
 * By default viem asks the WALLET to estimate gas and fees
 * (eth_estimateGas / eth_maxPriorityFeePerGas over the Reown provider).
 * Mobile wallets frequently cannot do this for a large deploy on a custom
 * testnet chain: they do not have chain 968 configured, or their RPC for it
 * chokes on a big constructor payload ("Unable to estimate gas fee",
 * "No network", "Can't connect").
 *
 * So we build the full calldata here, estimate the gas limit against the
 * PUBLIC BOT Chain RPC (the one we know works), add 30% headroom, and hand
 * the wallet a fully-specified request: { from, data, gas, gasPrice }.
 * The wallet then only has to sign and relay it, not simulate it.
 *
 * @param {object} params
 * @param {string} params.name          ERC-721 name, e.g. "AI Pro Pass"
 * @param {string} params.symbol        ERC-721 symbol, e.g. "AIPP"
 * @param {string} params.productName   Product display name
 * @param {string} params.accessTier    Basic | Pro | Premium | Enterprise
 * @param {number|string} params.maxSupply
 * @param {string} params.mintPriceBOT  Price as a decimal string, e.g. "0.5"
 * @param {string} params.metadataURI   data: URI with the full metadata
 * @param {object} walletClient         viem wallet client (from context)
 * @returns {Promise<string>} txHash (use confirmTransaction to get the
 *          receipt + contract address)
 */
export async function deployCollection(params, walletClient) {
  const args = [
    params.name,
    params.symbol,
    params.productName,
    params.accessTier,
    BigInt(params.maxSupply),
    // parseEther, never Number(). Decimal precision is precious.
    parseEther(String(params.mintPriceBOT)),
    params.metadataURI,
  ];

  // The exact bytes that will go on-chain (bytecode + encoded constructor
  // args). We need them twice, so encode once.
  const calldata = encodeDeployData({
    abi: accessPassAbi,
    bytecode: accessPassBytecode,
    args,
  });

  // Estimate the gas limit against our own RPC, not the wallet's.
  let gas;
  try {
    const estimated = await getPublicClient().estimateGas({
      account: walletClient.account.address,
      data: calldata,
    });
    // +30% headroom: constructor execution and storage writes are the
    // variable part, and an out-of-gas deploy is worse than a generous cap.
    gas = (estimated * 130n) / 100n;
  } catch {
    // Estimation failed (transient RPC hiccup, or a payload at the edge of
    // what the RPC will simulate). Fall back to a size-derived cap: base
    // constructor cost + calldata cost. gasPrice is ~free on this testnet,
    // so an over-generous limit only costs a little balance, never a revert.
    gas = 3_000_000n + BigInt(calldata.length) * 400n;
  }

  // The wallet also cannot be trusted to pick fees for an unknown chain, so
  // fetch the current gas price from our own RPC and pass it explicitly.
  // This skips viem's wallet-side fee detection (getBlock + maxPriorityFee)
  // entirely, leaving the wallet with nothing to estimate.
  const gasPrice = await getPublicClient().getGasPrice();

  return walletClient.deployContract({
    abi: accessPassAbi,
    bytecode: accessPassBytecode,
    args,
    gas,
    gasPrice,
  });
}

/**
 * The contract address is only known after the deploy tx is mined.
 */
export function contractAddressFromReceipt(receipt) {
  return receipt.contractAddress || null;
}

/* ------------------------------------------------------------------------ */
/* Reads                                                                    */
/* ------------------------------------------------------------------------ */

/**
 * Read the full public state of a collection in ONE parallel batch.
 * Returns plain JS values (bigints for amounts, strings for the rest).
 *
 * @param {string} address contract address
 * @returns {Promise<object>} collection info (see shape below)
 */
export async function readCollection(address) {
  const publicClient = getPublicClient();
  const read = (functionName, args = []) =>
    publicClient.readContract({ address, abi: accessPassAbi, functionName, args });

  const [name, symbol, productName, accessTier, maxSupply, totalMinted, mintPrice, owner, metadataUri] =
    await Promise.all([
      read("name"),
      read("symbol"),
      read("productName"),
      read("accessTier"),
      read("maxSupply"),
      read("totalMinted"),
      read("mintPrice"),
      read("owner"),
      read("metadataURI"),
    ]);

  return {
    address,
    chainId: ACTIVE_CHAIN.chainId,
    name,
    symbol,
    productName,
    accessTier,
    maxSupply,
    totalMinted,
    mintPrice,
    owner,
    metadataUri,
    metadata: decodeMetadata(metadataUri),
    remaining: maxSupply - totalMinted,
  };
}

/**
 * Read just the owner of a collection (cheap, used for ownership checks).
 */
export async function readCollectionOwner(address) {
  return getPublicClient().readContract({
    address,
    abi: accessPassAbi,
    functionName: "owner",
  });
}

/**
 * Read the metadata URI from the chain and decode it into an object.
 * The URI is a data:application/json;base64,... blob.
 */
export async function readCollectionMetadata(address) {
  const uri = await getPublicClient().readContract({
    address,
    abi: accessPassAbi,
    functionName: "metadataURI",
  });
  return decodeMetadata(uri);
}

/** BOT balance of an account (bigint wei). */
export async function readBalance(address) {
  return getPublicClient().getBalance({ address });
}

/** Does `account` own any pass from this collection? (one-per-wallet rule) */
export async function readBalanceOf(collectionAddress, account) {
  return getPublicClient().readContract({
    address: collectionAddress,
    abi: accessPassAbi,
    functionName: "balanceOf",
    args: [account],
  });
}

/**
 * Figure out which tokens of a collection belong to `account`.
 *
 * MVP approach (no indexer, no backend, no ERC721Enumerable): iterate token
 * ids [0, totalMinted) and ask ownerOf(). Fine for testnet scale. Burned
 * tokens revert ownerOf, which we catch and skip. A future indexer replaces
 * this at scale (documented, honest).
 *
 * @returns {Promise<Array<{tokenId: bigint, owner: string}>>}
 */
export async function readOwnedTokenIds(collectionAddress, account, totalMinted) {
  const publicClient = getPublicClient();
  const owned = [];
  const count = Number(totalMinted); // safe: demo collections are small
  for (let tokenId = 0; tokenId < count; tokenId++) {
    try {
      const owner = await publicClient.readContract({
        address: collectionAddress,
        abi: accessPassAbi,
        functionName: "ownerOf",
        args: [BigInt(tokenId)],
      });
      if (owner.toLowerCase() === account.toLowerCase()) {
        owned.push({ tokenId: BigInt(tokenId), owner });
      }
    } catch {
      // Burned or nonexistent token, skip it. That is the graceful part.
    }
  }
  return owned;
}

/* ------------------------------------------------------------------------ */
/* Writes (broadcast step returns txHash; confirm step returns receipt)     */
/* ------------------------------------------------------------------------ */

/**
 * Shared helper: broadcast a writeContract tx. Returns ONLY the tx hash so
 * the UI can show distinct states (waiting for wallet vs pending vs
 * confirming). Use confirmTransaction() to wait for the receipt.
 */
async function broadcast({ address, functionName, args, value }, walletClient) {
  return walletClient.writeContract({
    address,
    abi: accessPassAbi,
    functionName,
    args,
    ...(value !== undefined ? { value } : {}),
  });
}

/**
 * Wait for a tx to be mined and return the receipt.
 */
export async function confirmTransaction(txHash) {
  return getPublicClient().waitForTransactionReceipt({ hash: txHash });
}

/**
 * Extract the minted token id from a receipt by scanning Transfer events
 * where from == address(0) (a mint, not a transfer). Real data, no guessing
 * "it is probably totalMinted".
 */
export function extractMintedTokenId(receipt) {
  try {
    const logs = parseEventLogs({
      abi: accessPassAbi,
      logs: receipt.logs,
      eventName: "Transfer",
    });
    const mintLog = logs.find((l) => l.args.from === zeroAddress);
    return mintLog ? mintLog.args.tokenId : null;
  } catch {
    return null;
  }
}

/**
 * Public paid mint. `to` pays mintPrice (sent as tx value).
 * @returns {Promise<string>} txHash
 */
export function mintPass(collectionAddress, to, mintPriceBOT, walletClient) {
  return broadcast(
    {
      address: collectionAddress,
      functionName: "mint",
      args: [to],
      value: parseEther(String(mintPriceBOT)),
    },
    walletClient
  );
}

/**
 * Creator gift mint (onlyOwner, free). `to` receives the pass.
 * @returns {Promise<string>} txHash
 */
export function giftMintPass(collectionAddress, to, walletClient) {
  return broadcast(
    { address: collectionAddress, functionName: "giftMint", args: [to] },
    walletClient
  );
}

/**
 * Burn a pass. Caller must own the token (or be approved). The burn is
 * permanent; ownerOf reverts afterwards.
 * @returns {Promise<string>} txHash
 */
export function burnPass(collectionAddress, tokenId, walletClient) {
  return broadcast(
    { address: collectionAddress, functionName: "burn", args: [BigInt(tokenId)] },
    walletClient
  );
}

/**
 * Send a pass to another wallet via safeTransferFrom (standard ERC-721).
 * The connected wallet must be the owner (or an approved operator).
 * @returns {Promise<string>} txHash
 */
export function transferPass(collectionAddress, to, tokenId, walletClient) {
  const from = walletClient.account.address;
  return broadcast(
    {
      address: collectionAddress,
      functionName: "safeTransferFrom",
      args: [from, to, BigInt(tokenId)],
    },
    walletClient
  );
}

/**
 * Withdraw the collection's BOT balance to the owner.
 * @returns {Promise<string>} txHash
 */
export function withdrawFunds(collectionAddress, walletClient) {
  return broadcast(
    { address: collectionAddress, functionName: "withdraw", args: [] },
    walletClient
  );
}

/**
 * Owner-only metadata update.
 * @returns {Promise<string>} txHash
 */
export function updateMetadataUri(collectionAddress, newUri, walletClient) {
  return broadcast(
    { address: collectionAddress, functionName: "setMetadataURI", args: [newUri] },
    walletClient
  );
}

/* ------------------------------------------------------------------------ */
/* Metadata                                                                 */
/* ------------------------------------------------------------------------ */

/**
 * Decode a data:application/json;base64,... URI into an object.
 * Handles unicode properly (atob alone mangles non-ASCII; the classic
 * "my emoji description turned into mojibake" bug).
 */
export function decodeMetadata(uri) {
  if (!uri || typeof uri !== "string") return null;
  if (!uri.startsWith("data:application/json")) return null;

  const comma = uri.indexOf(",");
  if (comma === -1) return null;
  const [meta, payload] = [uri.slice(0, comma), uri.slice(comma + 1)];

  try {
    if (meta.includes(";base64")) {
      const binary = atob(payload);
      const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
      return JSON.parse(new TextDecoder().decode(bytes));
    }
    // Plain (non-base64) data URI: decodeURIComponent handles escaping.
    return JSON.parse(decodeURIComponent(payload));
  } catch {
    return null; // unparseable metadata should not crash the page
  }
}

/**
 * Build the on-chain metadata data URI from parts. UTF-8 safe base64.
 * The NFT must NOT contain secrets; it only proves entitlement.
 */
export function buildMetadataURI({ name, description, image, accessTier, maxSupply, mintPriceBOT }) {
  const metadata = {
    name,
    description,
    image: image || "",
    attributes: [
      { trait_type: "Access Tier", value: accessTier },
      { trait_type: "Maximum Supply", value: String(maxSupply) },
      { trait_type: "Price", value: `${mintPriceBOT} BOT` },
    ],
  };
  const json = JSON.stringify(metadata);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return `data:application/json;base64,${btoa(binary)}`;
}
