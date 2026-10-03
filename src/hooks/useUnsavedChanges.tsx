import { useEffect, useRef } from 'react';
import { useBlocker } from 'react-router-dom';
import ConfirmDialog from '../components/ConfirmDialog';

/** Guard in-app links, browser Back/Forward and document reload consistently. */
export default function useUnsavedChanges(dirty: boolean) {
  const bypass = useRef(false);
  const blocker = useBlocker(() => dirty && !bypass.current);
  const allowLeave = () => { bypass.current = true; };
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const dialog = <ConfirmDialog open={blocker.state === 'blocked'} title="Leave without saving?"
    body="Your unsaved changes will be lost." confirmLabel="Leave without saving" cancelLabel="Keep editing" danger
    onConfirm={() => { if (blocker.state === 'blocked') blocker.proceed(); }}
    onCancel={() => { if (blocker.state === 'blocked') blocker.reset(); }} />;
  return { dialog, allowLeave };
}
