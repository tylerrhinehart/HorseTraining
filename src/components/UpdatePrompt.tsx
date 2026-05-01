import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (registration) {
        // Periodic update check (hourly).
        setInterval(() => registration.update(), 60 * 60 * 1000);
      }
    },
  });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (needRefresh) setDismissed(false);
  }, [needRefresh]);

  if (!needRefresh || dismissed) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl border border-brand-600/40 bg-slate-900 p-4 shadow-lg">
      <p className="text-sm text-slate-200">
        A new version of Horse Training Tracker is ready.
      </p>
      <div className="mt-3 flex gap-2 justify-end">
        <button
          className="btn-ghost text-sm"
          onClick={() => {
            setDismissed(true);
            setNeedRefresh(false);
          }}
        >
          Later
        </button>
        <button
          className="btn-primary text-sm"
          onClick={() => updateServiceWorker(true)}
        >
          Reload
        </button>
      </div>
    </div>
  );
}
