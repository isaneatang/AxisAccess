/**
 * src/components/QRShare.jsx
 * --------------------------
 * Share modal for a collection: the public mint URL, a copy button, a QR
 * code of that URL and a download button for the QR image.
 *
 * The QR only encodes the PUBLIC mint URL (e.g.
 * https://axispass.vercel.app/mint?chain=968&contract=0x...). It never
 * contains private keys, passwords or secrets of any kind.
 */

import { useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import Modal from "./Modal";
import { copyToClipboard } from "../utils/formatting";

/**
 * @param {object} props
 * @param {boolean} props.open     show the modal?
 * @param {Function} props.onClose  dismiss callback
 * @param {string} props.url       the public mint URL to encode
 * @param {string} props.productName used for the download filename
 */
export default function QRShare({ open, onClose, url, productName }) {
  const [copied, setCopied] = useState(false);
  const qrRef = useRef(null);

  const handleCopy = async () => {
    const ok = await copyToClipboard(url);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `${(productName || "axispass").replace(/\s+/g, "-").toLowerCase()}-mint-qr.png`;
    a.click();
  };

  return (
    <Modal open={open} onClose={onClose} title="Share Mint Page" size="sm">
      <div className="qrshare">
        <div className="qrshare__qr" ref={qrRef}>
          <QRCodeCanvas value={url} size={200} level="M" marginSize={2} />
        </div>
        <p className="qrshare__hint">Scan with any wallet or phone camera.</p>
        <code className="qrshare__url">{url}</code>
        <div className="modal__actions">
          <button type="button" className="btn btn--primary btn--sm" onClick={handleCopy}>
            {copied ? "Copied!" : "Copy Link"}
          </button>
          <button type="button" className="btn btn--secondary btn--sm" onClick={handleDownload}>
            Download QR
          </button>
        </div>
      </div>
    </Modal>
  );
}
