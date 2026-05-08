import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { supabaseConfigured } from "../supabase/client";
import {
  listAllQuestions,
  listEngagements,
  listHorses,
  listPhases,
  listRiders,
} from "../supabase/queries";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function Settings() {
  const { user, signOut } = useAuth();
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setInstalled(true));
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const exportData = async () => {
    setExportStatus(null);
    try {
      const [horses, engagements, phases, questions, riders] = await Promise.all([
        listHorses(true),
        listEngagements(true),
        listPhases(),
        listAllQuestions(),
        listRiders(true),
      ]);
      const blob = new Blob(
        [
          JSON.stringify(
            {
              app: "tqa-tracker",
              exportedAt: new Date().toISOString(),
              userId: user?.id,
              horses,
              engagements,
              phases,
              questions,
              riders,
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tqa-export-${stamp()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setExportStatus("Export downloaded.");
    } catch (err) {
      setExportStatus(`Failed: ${(err as Error).message}`);
    }
  };

  return (
    <div className="view" style={{ maxWidth: 720 }}>
      <div className="eyebrow">Account</div>
      <h1 className="h-display">Settings</h1>

      <div className="card">
        <div className="card-head">
          <h2 className="card-title">Account</h2>
          <span className="card-meta">
            {supabaseConfigured ? "supabase ✓" : "not configured"}
          </span>
        </div>
        <p style={{ margin: 0 }}>
          Signed in as{" "}
          <strong style={{ fontFamily: "var(--font-display)" }}>
            {user?.email}
          </strong>
        </p>
        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" onClick={signOut}>
            Sign out
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2 className="card-title">Manage</h2>
          <span className="card-meta">curriculum &amp; people</span>
        </div>
        <p className="muted" style={{ margin: 0, marginBottom: 12 }}>
          Edit phases and questions, manage riders, attach resources, and
          review the Foundation doctrine.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <Link to="/horses" className="btn">Horses</Link>
          <Link to="/riders" className="btn">Riders</Link>
          <Link to="/phases" className="btn">Phases</Link>
          <Link to="/resources" className="btn">Resources</Link>
          <Link to="/foundation" className="btn">Foundation</Link>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2 className="card-title">Export your data</h2>
          <span className="card-meta">JSON snapshot</span>
        </div>
        <p className="muted" style={{ marginTop: 0 }}>
          Download a JSON snapshot of your horses, engagements, phases,
          questions, and riders. Sessions and ratings are linked from
          engagements but exported separately on demand.
        </p>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button className="btn btn-leather" onClick={exportData}>
            Export JSON
          </button>
          {exportStatus && (
            <span
              className="mono"
              style={{ fontSize: 12, color: "var(--ok)" }}
            >
              {exportStatus}
            </span>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2 className="card-title">Install as app</h2>
          <span className="card-meta">PWA</span>
        </div>
        <p className="muted" style={{ marginTop: 0 }}>
          Install for a dedicated icon and faster launch. Works offline for
          the app shell; data still requires a connection.
        </p>
        {installed ? (
          <p style={{ color: "var(--ok)", margin: 0 }}>App installed.</p>
        ) : installEvent ? (
          <button
            className="btn btn-leather"
            onClick={async () => {
              await installEvent.prompt();
              const choice = await installEvent.userChoice;
              if (choice.outcome === "accepted") setInstalled(true);
              setInstallEvent(null);
            }}
          >
            Install app
          </button>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            Install option will appear when supported by your browser. On iOS,
            use Share → Add to Home Screen.
          </p>
        )}
      </div>
    </div>
  );
}

function stamp(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
