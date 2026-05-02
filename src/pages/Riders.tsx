import { useState } from "react";
import {
  archiveRider,
  createRider,
  deleteRider,
  listRiders,
  unarchiveRider,
  updateRider,
} from "../supabase/queries";
import { useQuery } from "../supabase/useQuery";
import type { Rider } from "../supabase/types";

export default function Riders() {
  const [includeArchived, setIncludeArchived] = useState(false);
  const riders = useQuery(() => listRiders(includeArchived), [includeArchived]);

  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await createRider({ name, role });
      setName("");
      setRole("");
      riders.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Riders</h1>
          <p className="text-slate-400 text-sm mt-1">
            Trainers, assistants, and anyone else who rides a horse during a
            session. Picked when logging a session.
          </p>
        </div>
        <button
          className={includeArchived ? "btn-secondary text-sm" : "btn-ghost text-sm"}
          onClick={() => setIncludeArchived((v) => !v)}
        >
          {includeArchived ? "Hide archived" : "Show archived"}
        </button>
      </div>

      <form onSubmit={submit} className="card grid gap-2 md:grid-cols-[1fr_1fr_auto]">
        <input
          className="input"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="input"
          placeholder="Role (e.g. head trainer)"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        />
        <button className="btn-primary" type="submit" disabled={busy}>
          {busy ? "Adding…" : "Add rider"}
        </button>
      </form>

      <div className="space-y-2">
        {riders.loading && <div className="card text-slate-400">Loading…</div>}
        {!riders.loading && (riders.data ?? []).length === 0 && (
          <div className="card text-center text-slate-400">
            No riders yet.
          </div>
        )}
        {(riders.data ?? []).map((r) => (
          <RiderRow key={r.id} rider={r} onChanged={riders.refresh} />
        ))}
      </div>
    </div>
  );
}

function RiderRow({ rider, onChanged }: { rider: Rider; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(rider.name);
  const [role, setRole] = useState(rider.role ?? "");

  const save = async () => {
    if (!name.trim()) return;
    await updateRider(rider.id, { name: name.trim(), role: role.trim() || null });
    setEditing(false);
    onChanged();
  };

  const archive = async () => {
    if (rider.archived_at) await unarchiveRider(rider.id);
    else await archiveRider(rider.id);
    onChanged();
  };

  const remove = async () => {
    if (!confirm(`Delete "${rider.name}"?`)) return;
    await deleteRider(rider.id);
    onChanged();
  };

  return (
    <div className="card flex flex-wrap items-center gap-3">
      {editing ? (
        <>
          <input
            className="input flex-1 min-w-[10rem]"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <input
            className="input flex-1 min-w-[10rem]"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          />
          <button className="btn-primary text-xs" onClick={save}>
            Save
          </button>
          <button
            className="btn-ghost text-xs"
            onClick={() => {
              setEditing(false);
              setName(rider.name);
              setRole(rider.role ?? "");
            }}
          >
            Cancel
          </button>
        </>
      ) : (
        <>
          <div className="flex-1">
            <div className="font-medium">
              {rider.name}
              {rider.archived_at && (
                <span className="ml-2 pill bg-slate-700 text-slate-300">
                  archived
                </span>
              )}
            </div>
            {rider.role && (
              <div className="text-xs text-slate-400">{rider.role}</div>
            )}
          </div>
          <button
            className="btn-secondary text-xs"
            onClick={() => setEditing(true)}
          >
            Edit
          </button>
          <button className="btn-ghost text-xs" onClick={archive}>
            {rider.archived_at ? "Unarchive" : "Archive"}
          </button>
          <button className="btn-danger text-xs" onClick={remove}>
            Delete
          </button>
        </>
      )}
    </div>
  );
}
