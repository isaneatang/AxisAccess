/**
 * src/components/Modal.jsx
 * ------------------------
 * Minimal accessible modal shell shared by every dialog in the app
 * (wallet picker, gift, send, burn, share, QR).
 *
 * Why one component? Consistency of styling and behavior (backdrop click
 * to close, Escape to close, scroll lock) without repeating the same 40
 * lines of JSX in five places.
 */

import { useEffect } from "react";

/**
 * @param {object} props
 * @param {boolean} props.open    whether the modal is visible
 * @param {Function} props.onClose called when the user dismisses it
 * @param {string} [props.title]   optional header title
 * @param {React.ReactNode} props.children body content
 * @param {string} [props.size]    "sm" | "md" (default) | "lg"
 */
export default function Modal({ open, onClose, title, children, size = "md" }) {
  // Close on Escape and lock body scroll while open.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className={`modal modal--${size}`}
        role="dialog"
        aria-modal="true"
        aria-label={title || "Dialog"}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="modal__header">
            <h3 className="modal__title">{title}</h3>
            <button type="button" className="modal__close" onClick={onClose} aria-label="Close">
              &times;
            </button>
          </div>
        )}
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}
