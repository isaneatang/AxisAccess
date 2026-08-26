/**
 * src/utils/errors.js
 * -------------------
 * Maps raw wallet/RPC exceptions into messages a human can actually read.
 *
 * Rule of the house: users NEVER see raw JavaScript errors. They see the
 * friendly message from here. Raw errors belong in the console, where the
 * developer can actually debug them.
 *
 * The error list mirrors spec section 29: user rejected, wrong network,
 * insufficient funds/gas, reverted, already owns pass, supply exhausted,
 * invalid recipient, wallet disconnected, session expired, timeout,
 * unsupported wallet, mobile connection failure, RPC failure, deployment
 * failure.
 */

const REJECTED_PATTERNS = [
  /user rejected/i,
  /user denied/i,
  /denied transaction/i,
  /request rejected/i,
  /rejected the request/i,
  /action rejected/i,
];

const CONNECTION_REJECTED_PATTERNS = [
  /connection request.*(reject|denied)/i,
  /user rejected the connection/i,
  /pairing.*reject/i,
];

const INSUFFICIENT_FUNDS_PATTERNS = [
  /insufficient funds/i,
  /insufficient balance/i,
  /exceeds.*balance/i,
  /not enough.*(bot|eth|funds|gas)/i,
  /insufficient.*gas/i,
  /out of gas/i,
  /intrinsic gas too low/i,
];

const ALREADY_OWNS_PATTERNS = [
  /already owns a pass/i,
  /already owns/i,
];

const SUPPLY_PATTERNS = [
  /supply exhausted/i,
  /no passes remaining/i,
  /max supply/i,
];

const INVALID_RECIPIENT_PATTERNS = [
  /invalid recipient/i,
  /invalid address/i,
  /recipient.*zero/i,
];

const NETWORK_PATTERNS = [
  /does not match the target chain/i,
  /unsupported chain/i,
  /wrong network/i,
  /chain.?id mismatch/i,
  /network mismatch/i,
  /user rejected.*chain/i,
  /chain.*not.*configur/i,
];

const SESSION_PATTERNS = [
  /session.*(expired|ended|closed|deleted)/i,
  /no matching key/i,
  /pairing.*(expired|timed? ?out|failed)/i,
  /connection.*(closed|lost|timeout|timed ?out)/i,
  /session.*not.*found/i,
];

const MOBILE_PATTERNS = [
  /mobile.*(fail|error|unsupported)/i,
  /deep.?link/i,
  /wallet.*(not.*found|unavailable|unsupported)/i,
  /no.*wallet/i,
];

const RPC_PATTERNS = [
  /rpc error/i,
  /fetch failed/i,
  /network error/i,
  /request failed/i,
  /timeout/i,
  /ecosystem/i,
  /invalid response/i,
  /json-rpc/i,
];

/**
 * Gas estimation failures. The wallet could not simulate the transaction
 * (chain not configured in the wallet, RPC too slow for a large deploy,
 * payload over the RPC's simulation limit). This is a connection/config
 * problem, not a contract bug - say so in plain words.
 */
const GAS_ESTIMATION_PATTERNS = [
  /unable to estimate/i,
  /estimate gas/i,
  /gas estimation/i,
  /gas required exceeds/i,
  /gas limit.*exceed/i,
];

/**
 * Turn any thrown thing into { message, faucet } for the UI.
 *
 * @param {unknown} err     The thrown error (viem/wagmi errors carry .code/.shortMessage).
 * @param {string}  context "deployment" | "transaction" | "connect" | "network" (tweaks the fallback wording).
 * @returns {{ message: string, faucet: boolean }}
 */
export function friendlyErrorMessage(err, context = "transaction") {
  const code = err?.code;
  const raw = err?.shortMessage || err?.message || String(err || "");
  const haystack = raw.toLowerCase();

  // 4001 = user clicked "reject" in the wallet. Not an error, a choice.
  if (code === 4001 || REJECTED_PATTERNS.some((re) => re.test(haystack))) {
    return { message: "Transaction rejected by user.", faucet: false };
  }

  // 5001 / connection rejections during wallet pairing.
  if (code === 5001 || CONNECTION_REJECTED_PATTERNS.some((re) => re.test(haystack))) {
    return { message: "Connection request rejected by the wallet.", faucet: false };
  }

  // 4902 = the chain is not configured in the wallet at all.
  if (code === 4902 || /chain.*not.*(added|configur)/i.test(haystack)) {
    return {
      message: "BOT Chain Mainnet is not configured in this wallet. Add it to continue.",
      faucet: false,
    };
  }

  // The wallet could not estimate gas for the transaction (typical on
  // mobile wallets for chain 677, especially large deploys).
  if (GAS_ESTIMATION_PATTERNS.some((re) => re.test(haystack))) {
    return {
      message:
        "Transaction failed. The wallet could not estimate the gas required for this transaction. " +
        "Please check that your wallet is connected to BOT Chain and try again.",
      faucet: false,
    };
  }

  if (INSUFFICIENT_FUNDS_PATTERNS.some((re) => re.test(haystack))) {
    return {
      message:
        "Insufficient funds for this transaction. Mints are paid in USDT and gas is paid in native BOT - check both balances.",
      faucet: true,
    };
  }

  if (ALREADY_OWNS_PATTERNS.some((re) => re.test(haystack))) {
    return {
      message: "This wallet already owns an access pass from this collection.",
      faucet: false,
    };
  }

  if (SUPPLY_PATTERNS.some((re) => re.test(haystack))) {
    return { message: "No passes remaining.", faucet: false };
  }

  if (INVALID_RECIPIENT_PATTERNS.some((re) => re.test(haystack))) {
    return { message: "That recipient address is not valid.", faucet: false };
  }

  if (NETWORK_PATTERNS.some((re) => re.test(haystack))) {
    return {
      message: "BOT Chain Mainnet is required. Please switch networks and try again.",
      faucet: false,
    };
  }

  if (SESSION_PATTERNS.some((re) => re.test(haystack))) {
    return {
      message: "The wallet session ended or timed out. Please reconnect and try again.",
      faucet: false,
    };
  }

  if (MOBILE_PATTERNS.some((re) => re.test(haystack))) {
    return {
      message:
        "Could not reach the mobile wallet. Make sure it is installed, unlocked, and try again.",
      faucet: false,
    };
  }

  if (RPC_PATTERNS.some((re) => re.test(haystack))) {
    return {
      message: "The network is having trouble right now. Please try again in a moment.",
      faucet: false,
    };
  }

  // Generic contract revert, we do not know why but we know it failed.
  if (/reverted|execution reverted|call revert/i.test(haystack)) {
    return {
      message: "Transaction failed. Check the requirements (supply, price, ownership) and try again.",
      faucet: false,
    };
  }

  // Context-aware fallbacks.
  if (context === "deployment") {
    return {
      message: "Deployment failed. Check your wallet/network connection and try again.",
      faucet: false,
    };
  }
  if (context === "connect") {
    return {
      message: "Could not connect to your wallet. Make sure it is unlocked and try again.",
      faucet: false,
    };
  }
  if (context === "network") {
    return {
      message: "Could not switch networks. Please switch to BOT Chain Mainnet in your wallet.",
      faucet: false,
    };
  }

  return {
    message: "Transaction failed. Please check your wallet and try again.",
    faucet: false,
  };
}
