/**
 * src/context/WalletContext.jsx
 * -----------------------------
 * React glue around Reown AppKit + wagmi. Any component can grab the wallet
 * state with useWallet() instead of poking window.ethereum directly.
 *
 * THIS IS THE ONLY place wallet state lives. Pages never touch providers,
 * never wire their own session events, never import wagmi/AppKit hooks
 * directly. They consume this context, which prevents stale state, divided
 * connection logic and pages behaving differently (spec sections 8-9).
 *
 * Reown AppKit owns the connection/session layer: wallet picker modal, QR
 * pairing, mobile deep links, session restore, account/chain change events
 * and session expiry all flow through it. viem owns the blockchain layer.
 *
 * Exposed state:
 *   address, isConnected, connectionStatus, chainId, isOnActiveNetwork
 *   walletClient (viem, over the Reown EIP-1193 provider)
 *   publicClient (viem, over the BOT Chain RPC)
 *   walletProviderType (e.g. "injected", "walletConnect")
 *
 * Exposed actions:
 *   connect()                opens the Reown wallet picker
 *   disconnect()             ends the session
 *   switchToActiveNetwork()  requests a network switch (user approves)
 *   clearError()
 */

import { createContext, useContext, useMemo, useCallback, useState } from "react";
import { useAppKit, useAppKitAccount, useAppKitNetwork, useAppKitProvider } from "@reown/appkit/react";
import { useDisconnect } from "wagmi";
import { ACTIVE_CHAIN } from "../config/chains";
import { createWalletClient, getPublicClient } from "../blockchain/clients";
import { friendlyErrorMessage } from "../utils/errors";

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  // --- AppKit hooks (the official Reown React API) -------------------------
  const { open } = useAppKit();
  const { address, isConnected, status } = useAppKitAccount();
  const { chainId, switchNetwork } = useAppKitNetwork();
  const { walletProvider, walletProviderType } = useAppKitProvider("eip155");
  const { disconnect: appKitDisconnect } = useDisconnect();

  // Local UI error state (friendly messages only, see utils/errors.js).
  const [error, setError] = useState(null);
  const [switching, setSwitching] = useState(false);

  /** Is the wallet on the chain the app actually uses? */
  const isOnActiveNetwork = isConnected && chainId === ACTIVE_CHAIN.chainId;

  /**
   * The viem wallet client, rebuilt whenever the Reown provider or account
   * changes. It is the ONLY writer in the app; every transaction goes
   * through this client and gets signed by the user's wallet.
   */
  const walletClient = useMemo(() => {
    if (!walletProvider || !address) return null;
    return createWalletClient(walletProvider, address);
  }, [walletProvider, address]);

  /**
   * The shared public client for reads. Always talks to the BOT Chain RPC,
   * regardless of which network the wallet is on.
   */
  const publicClient = useMemo(() => getPublicClient(), []);

  /**
   * Open the official Reown wallet picker (browser wallets, WalletConnect
   * QR, mobile deep links). This is the single connect() entry point.
   */
  const connect = useCallback(() => {
    setError(null);
    open();
  }, [open]);

  /** End the session. AppKit clears all local state for us. */
  const disconnect = useCallback(async () => {
    setError(null);
    try {
      await appKitDisconnect();
    } catch (err) {
      // Disconnect rarely fails, but never leave the UI stuck.
      setError(friendlyErrorMessage(err, "connect").message);
    }
  }, [appKitDisconnect]);

  /**
   * Ask the wallet to switch to BOT Chain Testnet. Never silent: the wallet
   * shows its own approval UI. On failure we surface a friendly message and
   * the manual add-chain hint.
   *
   * Most mobile wallets do not know chain 968 ("No network" / "Can't
   * connect" come from exactly this), so when the switch fails because the
   * chain is NOT CONFIGURED (EIP-1193 code 4902), we first try to ADD it
   * via wallet_addEthereumChain, then retry the switch once. If that also
   * fails, the caller shows the manual add-chain instructions.
   *
   * @returns {Promise<{ok: boolean, cancelled?: boolean}>}
   */
  const switchToActiveNetwork = useCallback(async () => {
    setError(null);
    setSwitching(true);
    try {
      await switchNetwork(ACTIVE_CHAIN.viemChain);
      return { ok: true };
    } catch (err) {
      const chainMissing =
        err?.code === 4902 || /chain.*not.*(added|configur)/i.test(err?.message || "");
      if (chainMissing && walletClient) {
        try {
          // wallet_addEthereumChain with the EIP-3085 params derived from
          // the viem chain object (chainId, name, BOT/18, rpc, explorer).
          await walletClient.addChain({ chain: ACTIVE_CHAIN.viemChain });
          await switchNetwork(ACTIVE_CHAIN.viemChain);
          return { ok: true };
        } catch (addErr) {
          const friendly = friendlyErrorMessage(addErr, "network");
          setError(friendly.message);
          return { ok: false, cancelled: addErr?.code === 4001 };
        }
      }
      const friendly = friendlyErrorMessage(err, "network");
      setError(friendly.message);
      return { ok: false, cancelled: err?.code === 4001 };
    } finally {
      setSwitching(false);
    }
  }, [switchNetwork, walletClient]);

  const clearError = useCallback(() => setError(null), []);

  const value = {
    address,
    isConnected,
    connectionStatus: status,
    chainId,
    isOnActiveNetwork,
    walletClient,
    publicClient,
    walletProviderType,
    switching,
    error,
    connect,
    disconnect,
    switchToActiveNetwork,
    clearError,
    activeChain: ACTIVE_CHAIN,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

/** Hook: grab the wallet context. Throws if used outside the provider. */
export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error("useWallet must be used inside <WalletProvider>.");
  }
  return ctx;
}
