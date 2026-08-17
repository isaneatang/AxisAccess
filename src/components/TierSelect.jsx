/**
 * src/components/TierSelect.jsx
 * ----------------------------
 * A custom dropdown for choosing an access tier.
 *
 * Replaces the native <select> because in-app wallet browsers (Bitget,
 * OKX, Zerion, ...) run the dApp in a custom WebView that often swallows
 * the native option picker — the dropdown never opens there. This builds
 * the list from plain DOM buttons, so it works in every browser and
 * WebView, and matches the .form-input look.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export default function TierSelect({ id, value, options, onChange, className = "" }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const close = useCallback(() => setOpen(false), []);

  // Close when tapping outside, pressing Escape, or the page scrolls.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) close();
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  return (
    <div ref={rootRef} className={`tier-select ${className}`.trim()}>
      <button
        id={id}
        type="button"
        className="tier-select__button form-input"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span>{value}</span>
        <span className={`tier-select__chevron${open ? " tier-select__chevron--open" : ""}`} aria-hidden="true" />
      </button>

      {open && (
        <ul className="tier-select__list" role="listbox" aria-label="Access Tier">
          {options.map((t) => (
            <li key={t} role="option" aria-selected={t === value}>
              <button
                type="button"
                className={`tier-select__option${t === value ? " tier-select__option--selected" : ""}`}
                onClick={() => {
                  onChange(t);
                  close();
                }}
              >
                <span>{t}</span>
                {t === value && (
                  <span className="tier-select__check" aria-hidden="true">
                    &#10003;
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
