/**
 * src/App.jsx
 * -----------
 * App shell: router + wallet provider + navbar + routes + footer.
 *
 * Deliberately thin: pages own their logic, the wallet context owns wallet
 * state, and this file just wires them together.
 *
 * Routes:
 *   /                         -> Home (landing)
 *   /create                   -> Create Access Pass
 *   /collections              -> My Collections
 *   /collections/:address     -> Manage Collection
 *   /passes                   -> My Passes
 *   /mint?chain=968&contract=... -> Public Mint Page (buyer-facing)
 */

import { BrowserRouter, Routes, Route } from "react-router-dom";
import { WalletProvider } from "./context/WalletContext";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import CreatePass from "./pages/CreatePass";
import Collections from "./pages/Collections";
import ManageCollection from "./pages/ManageCollection";
import MyPasses from "./pages/MyPasses";
import PublicMint from "./pages/PublicMint";

export default function App() {
  return (
    <BrowserRouter>
      <WalletProvider>
        <div className="app">
          <Navbar />
          <main className="app__main">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/create" element={<CreatePass />} />
              <Route path="/collections" element={<Collections />} />
              <Route path="/collections/:address" element={<ManageCollection />} />
              <Route path="/passes" element={<MyPasses />} />
              <Route path="/mint" element={<PublicMint />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
          <footer className="app__footer">Axis by Equixote Isane</footer>
        </div>
      </WalletProvider>
    </BrowserRouter>
  );
}

/** Simple 404, better than a blank page. */
function NotFound() {
  return (
    <div className="page">
      <div className="empty-state">
        <span className="empty-state__icon" aria-hidden="true">
          &#129518;
        </span>
        <h2>Page not found</h2>
        <p>That page does not exist (or wandered off-chain).</p>
      </div>
    </div>
  );
}
