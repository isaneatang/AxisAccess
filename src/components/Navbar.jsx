/**
 * src/components/Navbar.jsx
 * -------------------------
 * Top navigation: brand, links and the wallet button.
 *
 * Links: Home, Create, Collections, My Passes. On mobile the links collapse
 * behind a hamburger toggle so the navbar stays usable on small screens.
 *
 * Everything wallet-related is delegated to <WalletButton />, which reads
 * from the shared WalletContext. No wallet logic lives here.
 */

import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import WalletButton from "./WalletButton";
import { APP_NAME } from "../config/constants";

const LINKS = [
  { to: "/", label: "Home", end: true },
  { to: "/create", label: "Create" },
  { to: "/collections", label: "Collections" },
  { to: "/passes", label: "My Passes" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="navbar">
      <div className="navbar__inner">
        <Link to="/" className="navbar__brand" onClick={() => setOpen(false)}>
          <span className="navbar__logo" aria-hidden="true">
            A
          </span>
          <span className="navbar__name">{APP_NAME}</span>
        </Link>

        <button
          type="button"
          className={`navbar__burger ${open ? "navbar__burger--open" : ""}`}
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle navigation"
          aria-expanded={open}
        >
          <span />
          <span />
          <span />
        </button>

        <nav className={`navbar__links ${open ? "navbar__links--open" : ""}`}>
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) => `navbar__link ${isActive ? "navbar__link--active" : ""}`}
              onClick={() => setOpen(false)}
            >
              {l.label}
            </NavLink>
          ))}
          <div className="navbar__wallet">
            <WalletButton />
          </div>
        </nav>
      </div>
    </header>
  );
}
