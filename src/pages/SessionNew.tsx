import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  createSession,
  getEngagement,
  getWeek,
  listPhases,
  listQuestionsForPhase,
  listRiders,
  listSessionsForWeek,
} from "../supabase/queries";
import { useQuery } from "../supabase/useQuery";
import PhaseScoreSheet, { type DraftRating } from "../components/PhaseScoreSheet";
import type { TqaScore } from "../supabase/types";

export default function SessionNew() {
  const { id: engagementId, weekId } = useParams();
  const navigate = useNavigate();

  const engagement = useQuery(
    () => (engagementId ? getEngagement(engagementId) : Promise.resolve(null)),
    [engagementId],
  );
  const week = useQuery(
    () => (weekId ? getWeek(weekId) : Promise.resolve(null)),
    [weekId],
  );
  const phases = useQuery(() => listPhases(), []);
  const riders = useQuery(() => listRiders(), []);
  const existingSessions = useQuery(
    () => (weekId ? listSessionsForWeek(weekId) : Promise.resolve([])),
    [weekId],
  );

  const [phaseId, setPhaseId] = useState<string>("");
  const [riderId, setRiderId] = useState<string>("");
  const [occurredAt, setOccurredAt] = useState<string>(
    new Date().toISOString().slice(0, 16),
  );
  const [drafts, setDrafts] = useState<Record<string, DraftRating>>({});
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!phaseId && phases.data && phases.data.length > 0) {
      setPhaseId(phases.data[0].id);
    }
  }, [phases.data, phaseId]);

  const questions = useQuery(
    () => (phaseId ? listQuestionsForPhase(phaseId) : Promise.resolve([])),
    [phaseId],
  );

  // Reset drafts when phase changes (different question set).
  useEffect(() => {
    setDrafts({});
  }, [phaseId]);

  const nextSessionNumber = useMemo(() => {
    const used = new Set(
      (existingSessions.data ?? [])
        .map((s) => s.session_number)
        .filter((n): n is number => typeof n === "number"),
    );
    for (let i = 1; i <= 5; i++) {
      if (!used.has(i)) return i;
    }
    return null;
  }, [existingSessions.data]);

  if (!engagementId || !weekId) return null;
  if (engagement.loading || week.loading || phases.loading) {
    return <div className="card">Loading…</div>;
  }
  if (!engagement.data || !week.data) {
    return <div className="card">Not found.</div>;
  }

  const setScore = (qid: string, score: TqaScore) =>
    setDrafts((d) => ({ ...d, [qid]: { ...d[qid], score } }));
  const setComment = (qid: string, comment: string) =>
    setDrafts((d) => ({ ...d, [qid]: { ...d[qid], comment } }));

  const submit = async () => {
    setError(null);
    if (!phaseId) {
      setError("Pick a phase first.");
      return;
    }
    const ratings = (questions.data ?? [])
      .filter((q) => typeof drafts[q.id]?.score === "number")
      .map((q) => ({
        questionId: q.id,
        axis: q.axis,
        questionTextSnapshot: q.text,
        score: drafts[q.id]!.score!,
        comment: drafts[q.id]?.comment,
      }));
    if (ratings.length === 0) {
      setError("Score at least one item.");
      return;
    }
    setSaving(true);
    try {
      const session = await createSession({
        engagementId,
        weekId,
        horseId: engagement.data!.horse_id,
        phaseId,
        riderId: riderId || null,
        occurredAt: new Date(occurredAt).toISOString(),
        sessionNumber: nextSessionNumber ?? undefined,
        notes,
        ratings,
      });
      navigate(`/sessions/${session.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            New session — Week {week.data.week_number}
            {nextSessionNumber ? ` · #${nextSessionNumber}` : ""}
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Engagement{" "}
            <Link
              to={`/engagements/${engagementId}`}
              className="text-brand-300 hover:underline"
            >
              {engagement.data.owner_name ?? "details"}
            </Link>
          </p>
        </div>
        <Link to={`/engagements/${engagementId}`} className="btn-ghost text-sm">
          Cancel
        </Link>
      </div>

      <div className="card grid gap-3 md:grid-cols-3">
        <div>
          <label className="label" htmlFor="session-phase">Phase</label>
          <select
            id="session-phase"
            className="input"
            value={phaseId}
            onChange={(e) => setPhaseId(e.target.value)}
          >
            {phases.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="session-rider">Rider</label>
          <select
            id="session-rider"
            className="input"
            value={riderId}
            onChange={(e) => setRiderId(e.target.value)}
          >
            <option value="">— none —</option>
            {riders.data?.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
                {r.role ? ` (${r.role})` : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="session-when">When</label>
          <input
            id="session-when"
            type="datetime-local"
            className="input"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
          />
        </div>
      </div>

      {questions.loading ? (
        <div className="card">Loading questions…</div>
      ) : (
        <PhaseScoreSheet
          questions={questions.data ?? []}
          drafts={drafts}
          onScore={setScore}
          onComment={setComment}
        />
      )}

      <div className="card space-y-2">
        <label className="label" htmlFor="session-notes">Session notes</label>
        <textarea
          id="session-notes"
          rows={3}
          className="input"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="flex justify-end gap-2">
        <Link to={`/engagements/${engagementId}`} className="btn-ghost">
          Cancel
        </Link>
        <button className="btn-primary" disabled={saving} onClick={submit}>
          {saving ? "Saving…" : "Save session"}
        </button>
      </div>
    </div>
  );
}
