import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

type ToastKind = "success" | "error";

interface ToastItem {
  id: number;
  kind: ToastKind;
  msg: string;
}

interface ToastApi {
  success: (msg: string) => void;
  error: (msg: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const AUTO_DISMISS_MS = 3500;
const MAX_TOASTS = 3;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, msg: string) => {
      const id = ++idRef.current;
      setToasts((prev) => {
        const next = [...prev, { id, kind, msg }];
        // Cap at MAX_TOASTS, dropping the oldest.
        return next.slice(-MAX_TOASTS);
      });
      window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss]
  );

  // push is stable (useCallback + functional setState), so this object is safe to memoize once.
  const api = useRef<ToastApi>({
    success: (msg: string) => push("success", msg),
    error: (msg: string) => push("error", msg),
  }).current;

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div className="toast-stack" role="status" aria-live="polite">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`toast toast--${t.kind}`}
              onClick={() => dismiss(t.id)}
            >
              <span className="toast-glyph">
                {t.kind === "success" ? "✓" : "!"}
              </span>
              <span>{t.msg}</span>
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
