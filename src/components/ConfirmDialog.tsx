import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

interface Props {
  open: boolean;
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = "Cancel",
  danger,
  busy,
  onConfirm,
  onCancel,
}: Props) {
  const titleId = useId();
  const modalRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    // Remember focus so we can restore it on close.
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Focus the cancel button on open.
    cancelRef.current?.focus();

    // Lock body scroll.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (!busy) onCancel();
        return;
      }
      if (e.key === "Tab") {
        const modal = modalRef.current;
        if (!modal) return;
        const focusable = modal.querySelectorAll<HTMLElement>(
          "button, [href], input, select, textarea"
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;
        if (e.shiftKey) {
          if (active === first || !modal.contains(active)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (active === last || !modal.contains(active)) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open, busy, onCancel]);

  if (!open) return null;

  return createPortal(
    <div
      className="scrim"
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id={titleId}>{title}</h3>
        {body != null && (
          <p style={{ margin: "0 0 16px", color: "var(--ink-2)", fontSize: 14 }}>
            {body}
          </p>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onCancel}
            disabled={busy}
            ref={cancelRef}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn btn-sm ${danger ? "btn-danger" : "btn-leather"}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
