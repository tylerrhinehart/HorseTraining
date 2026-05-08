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
    <div className="view" style={{ maxWidth: 720 }}>
      <div className="eyebrow">Roster</div>
      <h1 className="h-display">Riders</h1>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <p className="muted" style={{ margin: 0, maxWidth: 520, fontSize: 14 }}>
          Trainers, assistants, and anyone else who rides a horse during a
          session. Picked when logging a session.
        </p>
        <button
          className="btn"
          onClick={() => setIncludeArchived((v) => !v)}
        >
          {includeArchived ? "Hide archived" : "Show archived"}
        </button>
      </div>

      <form
        onSubmit={submit}
        className="card"
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "1fr 1fr auto",
        }}
      >
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
        <button className="btn btn-leather" type="submit" disabled={busy}>
          {busy ? "Adding…" : "Add rider"}
        </button>
      </form>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {riders.loading && <div className="card muted">Loading…</div>}
        {!riders.loading && (riders.data ?? []).length === 0 && (
          <div className="card muted" style={{ textAlign: "center" }}>
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
    <div
      className="card"
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 10,
      }}
    >
      {editing ? (
        <>
          <input
            className="input"
            style={{ flex: "1 1 10rem" }}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <input
            className="input"
            style={{ flex: "1 1 10rem" }}
            value={role}
            onChange={(e) => setRole(e.target.value)}
          />
          <button className="btn btn-leather btn-sm" onClick={save}>
            Save
          </button>
          <button
            className="btn btn-ghost btn-sm"
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
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600 }}>
              {rider.name}
              {rider.archived_at && (
                <span className="pill pill-muted" style={{ marginLeft: 8 }}>
                  archived
                </span>
              )}
            </div>
            {rider.role && (
              <div className="muted mono" style={{ fontSize: 12 }}>
                {rider.role}
              </div>
            )}
          </div>
          <button className="btn btn-sm" onClick={() => setEditing(true)}>
            Edit
          </button>
          <button className="btn btn-ghost btn-sm" onClick={archive}>
            {rider.archived_at ? "Unarchive" : "Archive"}
          </button>
          <button className="btn btn-danger btn-sm" onClick={remove}>
            Delete
          </button>
        </>
      )}
    </div>
  );
}
