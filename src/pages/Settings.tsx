import { useEffect, useRef, useState } from "react";
import { db, SCHEMA_VERSION, APP_STATE_ID } from "../db/schema";
import { backupSchema, type Backup } from "../schemas/backup";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function Settings() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [status, setStatus] = useState<{
    kind: "idle" | "ok" | "err";
    msg?: string;
  }>({ kind: "idle" });

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setInstalled(true));
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    if (
      typeof navigator !== "undefined" &&
      navigator.storage &&
      "persisted" in navigator.storage
    ) {
      navigator.storage.persisted().then(setPersisted);
    }
  }, []);

  const exportBackup = async () => {
    const [horses, questions, evaluations] = await Promise.all([
      db.horses.toArray(),
      db.questions.toArray(),
      db.evaluations.toArray(),
    ]);
    const backup: Backup = {
      app: "horse-training-tracker",
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      horses,
      questions,
      evaluations,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `horse-training-backup-${todayStamp()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    await db.appState.update(APP_STATE_ID, {
      lastBackupAt: new Date().toISOString(),
    });
    setStatus({ kind: "ok", msg: "Backup downloaded." });
  };

  const importBackup = async (file: File, mode: "replace" | "merge") => {
    setStatus({ kind: "idle" });
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch (err) {
      setStatus({ kind: "err", msg: `Could not parse JSON: ${(err as Error).message}` });
      return;
    }
    const result = backupSchema.safeParse(parsed);
    if (!result.success) {
      setStatus({
        kind: "err",
        msg: `Invalid backup: ${result.error.issues[0]?.message ?? "bad shape"}`,
      });
      return;
    }
    const backup = result.data;

    // Auto-download a pre-import safety backup.
    await exportBackup();

    await db.transaction(
      "rw",
      db.horses,
      db.questions,
      db.evaluations,
      async () => {
        if (mode === "replace") {
          await db.horses.clear();
          await db.questions.clear();
          await db.evaluations.clear();
        }
        await db.horses.bulkPut(backup.horses);
        await db.questions.bulkPut(backup.questions);
        await db.evaluations.bulkPut(backup.evaluations);
      },
    );
    setStatus({
      kind: "ok",
      msg: `Imported ${backup.horses.length} horses, ${backup.questions.length} questions, ${backup.evaluations.length} evaluations.`,
    });
  };

  const triggerImport = (mode: "replace" | "merge") => {
    const input = fileInputRef.current;
    if (!input) return;
    input.dataset.mode = mode;
    input.click();
  };

  const requestPersistence = async () => {
    if (navigator.storage?.persist) {
      const ok = await navigator.storage.persist();
      setPersisted(ok);
    }
  };

  const wipeAll = async () => {
    if (
      !confirm(
        "Delete all horses, questions, and evaluations? This cannot be undone. Consider exporting a backup first.",
      )
    ) {
      return;
    }
    await db.transaction(
      "rw",
      db.horses,
      db.questions,
      db.evaluations,
      db.appState,
      async () => {
        await db.horses.clear();
        await db.questions.clear();
        await db.evaluations.clear();
        const state = await db.appState.get(APP_STATE_ID);
        await db.appState.put({
          id: APP_STATE_ID,
          schemaVersion: state?.schemaVersion ?? SCHEMA_VERSION,
          seeded: false,
        });
      },
    );
    setStatus({ kind: "ok", msg: "Database cleared. Reload to re-seed defaults." });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <section className="card space-y-3">
        <h2 className="font-semibold">Backup &amp; restore</h2>
        <p className="text-sm text-slate-400">
          Your data lives in this browser only. Export regularly and store the
          file somewhere safe.
        </p>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" onClick={exportBackup}>
            Export JSON backup
          </button>
          <button
            className="btn-secondary"
            onClick={() => triggerImport("merge")}
          >
            Import (merge)
          </button>
          <button
            className="btn-secondary"
            onClick={() => triggerImport("replace")}
          >
            Import (replace all)
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            const mode = (e.target.dataset.mode as
              | "replace"
              | "merge"
              | undefined) ?? "merge";
            if (file) importBackup(file, mode);
            e.target.value = "";
          }}
        />
        {status.kind !== "idle" && (
          <p
            className={
              status.kind === "ok"
                ? "text-sm text-emerald-400"
                : "text-sm text-red-400"
            }
          >
            {status.msg}
          </p>
        )}
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">Install as app</h2>
        <p className="text-sm text-slate-400">
          Install Horse Training Tracker to your device for offline use and a
          dedicated app icon.
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

      <section className="card space-y-3">
        <h2 className="font-semibold">Storage</h2>
        <p className="text-sm text-slate-400">
          Persistent storage status:{" "}
          <span className="text-slate-200 font-medium">
            {persisted === null ? "Unknown" : persisted ? "Enabled" : "Disabled"}
          </span>
        </p>
        {persisted === false && (
          <button className="btn-secondary" onClick={requestPersistence}>
            Request persistent storage
          </button>
        )}
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold text-red-400">Danger zone</h2>
        <button className="btn-danger" onClick={wipeAll}>
          Delete all data
        </button>
      </section>
    </div>
  );
}

function todayStamp(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
