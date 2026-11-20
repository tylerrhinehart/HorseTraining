import { useEffect, useState } from "react";
import { updateHorse } from "../supabase/queries";
import type { Horse } from "../supabase/types";

export default function NextRideFocus({ horse, onDirty }: { horse: Horse; onDirty?: (dirty: boolean) => void }) {
  const saved = horse.program_meta?.next_ride_focus ?? "";
  const [draft, setDraft] = useState<string | null>(null);
  const [version, setVersion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => () => onDirty?.(false), [onDirty]);
  const end = () => { setDraft(null); onDirty?.(false); setError(""); };
  async function save() {
    if (draft === null) return;
    setBusy(true);
    try {
      await updateHorse(horse.id, {program_meta: {...horse.program_meta, next_ride_focus: draft.trim()}}, version);
      end();
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }
  if (!saved && (!onDirty || horse.status !== "in_training")) return null;
  return <section className="ride-focus" aria-label="Next ride focus">
    <div className="task-choice"><strong>Next ride focus</strong>
      {onDirty && horse.status === "in_training" && draft === null && <button className="workflow-link" type="button"
        onClick={() => { setVersion(horse.updated_at); setDraft(saved); }}>{saved ? "Edit focus" : "Add focus"}</button>}
    </div>
    {draft === null ? (saved && <p>{saved}</p>) : <>
      <textarea className="input" aria-label="Focus for next ride" value={draft} disabled={busy}
        onChange={e => { setDraft(e.target.value); onDirty?.(e.target.value !== saved); }} />
      <div className="workflow-actions">
        <button type="button" className="btn btn-leather btn-sm" disabled={busy} onClick={save}>Save focus</button>
        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={end}>Cancel</button>
      </div>
      {error && <p role="alert">{error}</p>}
    </>}
  </section>;
}
