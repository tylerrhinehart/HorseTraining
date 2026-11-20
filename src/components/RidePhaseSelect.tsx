import { useState } from "react";
import type { Phase } from "../supabase/types";
import ConfirmDialog from "./ConfirmDialog";

interface Props {
  phases: Phase[];
  phaseId: string;
  needsConfirmation: boolean;
  hasEntries: boolean;
  disabled: boolean;
  onChoose: (id: string) => void;
}

export default function RidePhaseSelect({ phases, phaseId, needsConfirmation, hasEntries, disabled, onChoose }: Props) {
  const [pending, setPending] = useState("");
  return <div className="field">
    <label className="label" htmlFor="ride-phase">Phase worked on this ride</label>
    <select id="ride-phase" className="input" disabled={disabled} value={needsConfirmation ? "" : phaseId}
      onChange={e => {
        const next = e.target.value;
        if (next !== phaseId && hasEntries) setPending(next);
        else onChoose(next);
      }}>
      <option value="" disabled>Choose the phase worked</option>
      {phases.filter(p => p.program === "foundation").map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
    {needsConfirmation && <small>Confirm the phase worked on the selected date.</small>}
    <ConfirmDialog open={!!pending} title="Change the ride’s score sheet?"
      body="Scores and observations already entered on this sheet will move to Ride notes with their question names. The new phase starts with a blank score sheet."
      confirmLabel="Change ride phase" cancelLabel="Keep this sheet"
      onCancel={() => setPending("")} onConfirm={() => { onChoose(pending); setPending(""); }} />
  </div>;
}
