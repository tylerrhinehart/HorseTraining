import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

export default function GuideDialog({ title, children, actions, onClose, busy = false }: {
  title: string; children: ReactNode; actions?: ReactNode; onClose: () => void; busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return createPortal(<dialog ref={ref} className="workflow-dialog" aria-labelledby={titleId}
    onCancel={e => { e.preventDefault(); if (!busy) onClose(); }}>
    <h2 className="card-title" id={titleId}>{title}</h2>
    {children}
    <div className="workflow-actions">{actions}<button type="button" className="btn btn-ghost" disabled={busy} onClick={onClose}>Close</button></div>
  </dialog>, document.body);
}
