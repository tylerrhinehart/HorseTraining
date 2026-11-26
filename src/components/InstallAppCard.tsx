import { promptPwaInstall, usePwaInstall } from "../state/pwaInstall";

export default function InstallAppCard({ hideWhenInstalled = false }: { hideWhenInstalled?: boolean }) {
  const install = usePwaInstall();
  if (install.kind === "installed" && hideWhenInstalled) return null;

  const appleMobile = /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  return (
    <section className="card" aria-label="Install TQA">
      <h2 className="card-title">Install TQA</h2>
      {install.kind === "installed" ? (
        <p className="mt-2" role="status">TQA is installed.</p>
      ) : install.kind === "available" ? (
        <button className="btn btn-leather mt-2" type="button" onClick={() => void promptPwaInstall()}>
          Install app
        </button>
      ) : appleMobile ? (
        <p className="mt-2">Open TQA in Safari. Tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.
          Turn on <strong>Open as Web App</strong> if shown, then tap <strong>Add</strong>.
          If the option is missing, look under <strong>Edit Actions</strong> in the Share menu.</p>
      ) : (
        <p className="mt-2">Open your browser menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong> if available.</p>
      )}
    </section>
  );
}
