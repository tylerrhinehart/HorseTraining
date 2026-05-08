import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (registration) {
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
    <div
      className="card"
      style={{
        position: "fixed",
        bottom: 84,
        right: 16,
        zIndex: 50,
        maxWidth: 360,
        boxShadow: "0 18px 40px rgba(40, 25, 10, 0.18)",
      }}
    >
      <p style={{ margin: 0, fontSize: 14 }}>
        A new version of TQA Horse Training Tracker is ready.
      </p>
      <div
        style={{
          display: "flex",
          gap: 8,
          justifyContent: "flex-end",
          marginTop: 12,
        }}
      >
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => {
            setDismissed(true);
            setNeedRefresh(false);
          }}
        >
          Later
        </button>
        <button
          className="btn btn-leather btn-sm"
          onClick={() => updateServiceWorker(true)}
        >
          Reload
        </button>
      </div>
    </div>
  );
}
