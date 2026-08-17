/**
 * src/pages/Home.jsx
 * ------------------
 * Landing page: hero, how it works, feature highlights and CTA.
 * Pure marketing; no wallet logic beyond a connect CTA.
 */

import { Link } from "react-router-dom";
import { useWallet } from "../context/WalletContext";
import { APP_NAME, TAGLINE } from "../config/constants";

const STEPS = [
  {
    icon: "\uD83D\uDEE0\uFE0F",
    title: "Create an access pass",
    text: "Fill in your product, tier, price and supply. We deploy a real ERC-721 collection from your wallet.",
  },
  {
    icon: "\uD83D\uDD17",
    title: "Share the mint link",
    text: "Every collection gets a public mint page and a QR code. Buyers mint straight from their wallet.",
  },
  {
    icon: "\uD83D\uDD11",
    title: "NFTs prove access",
    text: "The NFT is the entitlement. Users hold it, send it, burn it. You manage it on-chain.",
  },
];

const FEATURES = [
  {
    title: "Real blockchain, real transactions",
    text: "No mock contracts, no fake addresses. Every mint, gift, burn and transfer is a real BOT Chain transaction.",
  },
  {
    title: "Mobile-first wallet support",
    text: "Built on Reown AppKit. Scan a QR with OKX, Bitget, Trust or MetaMask mobile and you are in, no extension needed.",
  },
  {
    title: "One pass per wallet",
    text: "Enforced in the smart contract. Burn your pass and the seat frees up for a future mint.",
  },
  {
    title: "On-chain metadata",
    text: "Metadata travels with the NFT as a data URI. Images are compressed in your browser before deployment.",
  },
  {
    title: "Creator control panel",
    text: "Gift passes, withdraw proceeds, update metadata and monitor supply, all from the manage page.",
  },
  {
    title: "Ready for the SDK era",
    text: "The contract exposes balanceOf and ownerOf, so a future verification SDK can check entitlement.",
  },
];

export default function Home() {
  const { isConnected, connect } = useWallet();

  return (
    <div className="page">
      {/* Hero */}
      <section className="hero">
        <span className="hero__badge">{TAGLINE}</span>
        <h1 className="hero__title">
          Create an NFT access pass
          <br />
          in minutes.
        </h1>
        <p className="hero__subtitle">
          {APP_NAME} turns any product, service, API, course or community into an NFT access collection on
          BOT Chain. The NFT is the proof of access.
        </p>
        <div className="hero__actions">
          <Link to="/create" className="btn btn--primary btn--lg">
            Create Access Pass
          </Link>
          {!isConnected && (
            <button type="button" className="btn btn--secondary btn--lg" onClick={connect}>
              Connect Wallet
            </button>
          )}
        </div>
      </section>

      {/* How it works */}
      <section className="section">
        <h2 className="section__title">How it works</h2>
        <div className="grid grid--3">
          {STEPS.map((s, i) => (
            <div className="card step-card" key={s.title}>
              <span className="step-card__num" aria-hidden="true">
                {i + 1}
              </span>
              <span className="step-card__icon" aria-hidden="true">
                {s.icon}
              </span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="section">
        <h2 className="section__title">Built for real access infrastructure</h2>
        <div className="grid grid--3">
          {FEATURES.map((f) => (
            <div className="card feature-card" key={f.title}>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="cta">
        <h2>Ready to gate your product?</h2>
        <p>Deploy your first collection on BOT Chain Testnet today. Free testnet BOT available from the faucet.</p>
        <Link to="/create" className="btn btn--primary btn--lg">
          Get Started
        </Link>
      </section>
    </div>
  );
}
