import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { supabaseConfigured } from "../supabase/client";
import {
  listAllQuestions,
  listHorses,
  listPhases,
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
      const [horses, phases, questions] = await Promise.all([
        listHorses(true),
        listPhases(),
        listAllQuestions(true),
      ]);
      const blob = new Blob(
        [
          JSON.stringify(
            {
              app: "tqa-tracker",
              exportedAt: new Date().toISOString(),
              userId: user?.id,
              horses,
              phases,
              questions,
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
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <section className="card space-y-2">
        <h2 className="font-semibold">Account</h2>
        <p className="text-sm text-slate-300">
          Signed in as{" "}
          <span className="text-slate-100 font-medium">{user?.email}</span>
        </p>
        <p className="text-xs text-slate-500">
          Backend:{" "}
          {supabaseConfigured ? "Supabase (configured)" : "not configured"}
        </p>
        <div>
          <button className="btn-secondary text-sm" onClick={signOut}>
            Sign out
          </button>
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">Export your data</h2>
        <p className="text-sm text-slate-400">
          Download a JSON snapshot of your horses, phases, and questions
          (TQAs are linked from horses but exported separately on demand —
          this snapshot covers core records).
        </p>
        <div>
          <button className="btn-primary" onClick={exportData}>
            Export JSON
          </button>
        </div>
        {exportStatus && (
          <p className="text-sm text-emerald-400">{exportStatus}</p>
        )}
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">Install as app</h2>
        <p className="text-sm text-slate-400">
          Install for a dedicated icon and faster launch. Works offline for
          the app shell; data still requires a connection.
        </p>
        {installed ? (
          <p className="text-sm text-emerald-400">App installed.</p>
        ) : installEvent ? (
          <button
            className="btn-primary"
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
          <p className="text-sm text-slate-400">
            Install option will appear when supported by your browser. On iOS,
            use Share → Add to Home Screen.
          </p>
        )}
      </section>
    </div>
  );
}

function stamp(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
