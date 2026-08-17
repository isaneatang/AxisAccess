/**
 * src/main.jsx
 * ------------
 * Entry point: wires the Reown AppKit + wagmi providers around the app and
 * mounts it.
 *
 * Provider order matters:
 *   1. WagmiProvider     (wagmiAdapter.wagmiConfig from config/reown.js)
 *   2. QueryClientProvider (wagmi v2 needs @tanstack/react-query)
 *   3. App               (BrowserRouter + WalletProvider inside)
 *
 * The AppKit modal itself is created once in config/reown.js at module
 * scope, per the official Reown docs, so the providers here just consume
 * the already-built adapter.
 */

import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { wagmiAdapter } from "./config/reown";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
);
