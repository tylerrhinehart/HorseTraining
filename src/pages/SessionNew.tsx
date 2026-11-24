import useUnsavedChanges from "../hooks/useUnsavedChanges";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams, Link } from "react-router-dom";
import {
  createSession,
  getHorse,
  listPhases,
  listQuestionsForPhase,
  listSessionsForHorse,
  type SessionInput,
} from "../supabase/queries";
import { useQuery } from "../supabase/useQuery";
import { invalidate } from "../supabase/cache";
import { qk } from "../supabase/keys";
import PhaseScoreSheet, { type DraftRating } from "../components/PhaseScoreSheet";
import RidePhaseSelect from "../components/RidePhaseSelect";
import { hasEntries, prepareRideEntries } from "../utils/rideEntries";
import NextRideFocus from "../components/NextRideFocus";
import TaskCompletionPicker from "../components/TaskCompletionPicker";
import ConfirmDialog from "../components/ConfirmDialog";
import ErrorState from "../components/ErrorState";
import { Skeleton, SkeletonCard } from "../components/Skeleton";
import { useToast } from "../components/Toast";
import { lastWorkedByDiscipline } from "../utils/disciplineHistory";
import { bitOptions, programLabel } from "../content/programs";
import { localDateTimeInput } from "../utils/dates";
import { useAuth } from "../auth/AuthProvider";
import { useFacility } from "../auth/FacilityProvider";
import RideAlongPanel from "../features/ride-along/RideAlongPanel";
import { useVoiceCall } from "../features/ride-along/useVoiceCall";
import { closeDraft, confirmGuidedScore, getDraft, openDraft, saveDraft, type RideDraft } from "../features/ride-along/draftClient";
import { isRideAlongPhase, type VoiceScore } from "../features/ride-along/voiceCommand";
import type { TaskCompletion } from "../supabase/types";

/** Two-column ghost of the score sheet (8 Foundation + 6 Temperament rows). */
function ScoreSheetSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {[8, 6].map((rows, col) => (
          <div key={col} className="space-y-2">
            <Skeleton h={11} w="55%" style={{ marginBottom: 8 }} />
            {Array.from({ length: rows }).map((_, i) => (
              <div key={i} className="card">
                <Skeleton h={14} w="90%" style={{ marginBottom: 10 }} />
                <Skeleton h={36} w="100%" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SessionNew() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const wantsVoice = searchParams.get("mode") === "voice";
  const toast = useToast();
  const { facility } = useFacility();
  const { user } = useAuth();

  const horse = useQuery(id ? qk.horse(id) : null, () => getHorse(id!));
  const phases = useQuery(qk.phases(), () => listPhases());
  const voicePhase = phases.data?.find(isRideAlongPhase);
  const isPerformance = !!horse.data && horse.data.training_type !== "foundation";
  const sessions = useQuery(id && isPerformance ? qk.sessions(id) : null, () => listSessionsForHorse(id!));
  const history = useMemo(() => sessions.data && lastWorkedByDiscipline(sessions.data), [sessions.data]);

  const [phaseId, setPhaseId] = useState<string>("");
  const [confirmedDate, setConfirmedDate] = useState("");
  const [initialOccurredAt, setInitialOccurredAt] = useState(localDateTimeInput);
  const [occurredAt, setOccurredAt] = useState(initialOccurredAt);
  const [drafts, setDrafts] = useState<Record<string, DraftRating>>({});
  const [notes, setNotes] = useState("");
  const [rider, setRider] = useState("");
  const [bit, setBit] = useState("");
  const [tasks, setTasks] = useState<TaskCompletion[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voiceStartError, setVoiceStartError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [voiceDraft, setVoiceDraft] = useState<RideDraft>();
  const [chatOpen, setChatOpen] = useState(false);
  const microphone = useVoiceCall();
  useEffect(() => () => microphone.stop(), [id, facility?.id, user?.id, microphone.stop]);
  useEffect(() => {
    if (facility?.voice_enabled !== true || (horse.data && horse.data.status !== "in_training")) microphone.stop();
  }, [facility?.voice_enabled, horse.data?.status, microphone.stop]);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [voicePanelRevision, setVoicePanelRevision] = useState(0);
  const [draftOperation, setDraftOperation] = useState(false);
  const actionLock = useRef(false);
  const pending = useRef<{ key: string; request: string; input?: SessionInput }>();
  const scope = JSON.stringify([user?.id, facility?.id, id, phaseId]);
  const recoveryKey = `tqa:voice-terminal:${scope}`;
  const currentScope = useRef(scope);
  currentScope.current = scope;
  useEffect(() => {
    currentScope.current = scope;
    return () => { currentScope.current = ""; };
  }, [scope]);


  // React Router reuses this page when switching horses. Never carry a draft
  // (or the previous horse's phase) into another horse's ride.
  useEffect(() => {
    setPhaseId("");
    setVoiceDraft(undefined);
    setChatOpen(false);
    pending.current = undefined;
    setConfirmedDate("");
    setDrafts({});
    setNotes("");
    setRider("");
    setBit("");
    setTasks([]);
    const initialDate = localDateTimeInput();
    setInitialOccurredAt(initialDate);
    setOccurredAt(initialDate);
    setError(null);
    setVoiceStartError(null);
  }, [id]);

  // Default to the current program sheet when a horse is opened.
  useEffect(() => {
    if (phaseId) return;
    if (horse.loading || !phases.data) return;
    if (!horse.data) return;
    const programPhases = phases.data.filter((phase) => phase.program === horse.data!.training_type).sort((a, b) => a.position - b.position);
    if (wantsVoice && facility?.voice_enabled && horse.data.training_type === "foundation" && voicePhase) {
      setPhaseId(voicePhase.id);
      return;
    }
    const current = programPhases.find((phase) => phase.id === horse.data!.current_phase_id);
    setPhaseId(current?.id ?? programPhases[0]?.id ?? "");
  }, [horse.data, horse.loading, phases.data, phaseId, wantsVoice, facility?.voice_enabled, voicePhase]);

  const questions = useQuery(
    phaseId ? qk.questions(phaseId) : null,
    () => listQuestionsForPhase(phaseId),
  );

  // Opening a saved voice draft restores its fields. A phase choice alone is safe.
  const hasManualEdits =
    Object.values(drafts).some(
      (d) => typeof d.score === "number" || !!d.comment,
    ) ||
    notes.trim() !== "" ||
    rider.trim() !== "" ||
    bit !== "" ||
    tasks.length > 0 || occurredAt !== initialOccurredAt;
  const dirty = hasManualEdits || (!!confirmedDate && phaseId !== horse.data?.current_phase_id);

  const voiceChanged = voiceDraft && (
    notes !== (voiceDraft.notes ?? "") || rider !== (voiceDraft.rider ?? "") ||
    JSON.stringify(drafts) !== JSON.stringify(Object.fromEntries(
      voiceDraft.ratings.map(r => [r.question_id, { score: r.score, comment: r.comment ?? undefined }]),
    ))
  );
  const { dialog: unsavedDialog, allowLeave, navigationBlocked } = useUnsavedChanges((voiceDraft ? !!voiceChanged : dirty) && !saving);

  if (!id) return null;

  if (horse.error && horse.data === undefined) {
    return (
      <div className="view">
        <ErrorState error={horse.error} onRetry={horse.refresh} />
      </div>
    );
  }
  if (phases.error && phases.data === undefined) {
    return (
      <div className="view">
        <ErrorState error={phases.error} onRetry={phases.refresh} />
      </div>
    );
  }

  if (horse.data === undefined || phases.data === undefined) {
    return (
      <div className="view">
        {unsavedDialog}
      <div className="eyebrow">New ride</div>
        <h1 className="h-display">Log a ride</h1>
        <SkeletonCard lines={2} />
        <div style={{ height: 12 }} />
        <ScoreSheetSkeleton />
      </div>
    );
  }

  if (!horse.data) {
    return (
      <div className="view">
        <div className="card">Horse not found.</div>
      </div>
    );
  }

  if (horse.data.status !== "in_training") {
    return <div className="view">{unsavedDialog}<h1 className="h-display">{horse.data.name}</h1>
      <p>Resume training on the horse’s workspace to start a ride.</p><Link className="btn btn-ghost" to={`/horses/${id}`}>Back to horse</Link></div>;
  }

  const currentPhase = phases.data.find((p) => p.id === phaseId) ?? null;
  const foundationPhase = phases.data.find(p => p.id === horse.data?.current_phase_id) ?? phases.data.find(p => p.program === "foundation");
  const rideDay = occurredAt.slice(0, 10);
  const confirmPhase = !isPerformance && rideDay !== localDateTimeInput().slice(0, 10) && confirmedDate !== rideDay;
  function choosePhase(next: string) {
    if (voiceDraft || actionLock.current) return;
    if (next !== phaseId) {
      try {
        const kept = prepareRideEntries(questions.data ?? [], drafts, notes, currentPhase?.name);
        setNotes(kept.notes);
        setDrafts({});
      } catch (err) { setError((err as Error).message); return; }
    }
    setPhaseId(next);
    setConfirmedDate(rideDay);
    setError(null);
    setVoiceStartError(null);
  }
  const scale = currentPhase?.scale ?? "tqa";

  const total = questions.data?.length ?? 0;
  const scored = Object.values(drafts).filter(draft => typeof draft.score === "number").length;

  const setScore = (qid: string, score: number) =>
    setDrafts((d) => ({ ...d, [qid]: { ...d[qid], score } }));
  const setComment = (qid: string, comment: string) =>
    setDrafts((d) => ({ ...d, [qid]: { ...d[qid], comment } }));

  const voiceEnabled = facility?.voice_enabled === true;
  const voiceEligible = voiceEnabled && !isPerformance && phaseId === voicePhase?.id && !confirmPhase;
  useEffect(() => {
    if (!voiceEligible) microphone.stop();
  }, [voiceEligible, microphone.stop]);
  const hasVoiceQuestions = questions.data?.some(question => question.phase_id === phaseId && question.axis === "foundation") === true;
  const voiceStartBlocked = hasManualEdits || saving || draftOperation;

  function payload(nextDrafts = drafts): SessionInput {
    if (!occurredAt || Number.isNaN(new Date(occurredAt).getTime())) throw new Error("Enter a valid ride date and time.");
    if (!phaseId) throw new Error("Pick a phase first.");
    const entries = prepareRideEntries(questions.data ?? [], nextDrafts, notes);
    return {
      horse_id: id!, phase_id: phaseId, occurred_at: voiceDraft?.occurred_at ?? new Date(occurredAt).toISOString(),
      notes: entries.notes || null, rider: rider || null, bit: isPerformance ? bit || null : null,
      task_completions: isPerformance ? tasks : [], ratings: entries.ratings,
    };
  }

  async function draftAction<T>(operation: () => Promise<T>) {
    if (actionLock.current) throw new Error("Another ride operation is in progress.");
    actionLock.current = true;
    setDraftOperation(true);
    try {
      const result = await operation();
      if (currentScope.current !== scope) throw new Error("The active ride changed.");
      return result;
    } finally {
      actionLock.current = false;
      if (currentScope.current === scope) setDraftOperation(false);
    }
  }

  function restore(d: RideDraft) {
    if (d.horse_id !== id || d.facility_id !== facility?.id || d.phase_id !== phaseId || d.status !== "draft") {
      throw new Error("This ride draft is no longer available here.");
    }
    setVoiceDraft(d);
    setDrafts(Object.fromEntries(d.ratings.map(r => [r.question_id, { score: r.score, comment: r.comment ?? undefined }])));
    setNotes(d.notes ?? "");
    setRider(d.rider ?? "");
    const when = localDateTimeInput(new Date(d.occurred_at));
    setOccurredAt(when);
    setConfirmedDate(when.slice(0, 10));
  }

  function rememberTerminal(draftId?: string) {
    // Retain only an opaque draft pointer, not any audio, transcript or notes.
    try {
      if (draftId) window.sessionStorage.setItem(recoveryKey, draftId);
      else window.sessionStorage.removeItem(recoveryKey);
    } catch { /* Same-page retries remain available if storage is restricted. */ }
  }
  function terminalToCheck() {
    try { return window.sessionStorage.getItem(recoveryKey); } catch { return null; }
  }

  async function beginVoice() {
    if (actionLock.current || !voiceEligible || !facility || voiceStartBlocked || !hasVoiceQuestions || questions.error) return;
    setVoiceStartError(null);
    const connection = microphone.start();
    let opened = false;
    try {
      const interrupted = terminalToCheck();
      if (interrupted) {
        const recovered = await draftAction(() => getDraft(interrupted));
        if (recovered.horse_id !== id || recovered.facility_id !== facility.id || recovered.phase_id !== phaseId)
          throw new Error("The saved draft no longer matches this ride.");
        if (recovered.status === "completed") {
          rememberTerminal();
          refreshSavedRide();
          allowLeave();
          toast.success("Ride already saved");
          navigate(`/horses/${id}`);
          return;
        }
        rememberTerminal();
        if (recovered.status === "draft") {
          restore(recovered);
          setChatOpen(true);
          opened = true;
          return;
        }
      }
      const key = "open:" + scope;
      const request = pending.current?.key === key ? pending.current.request : crypto.randomUUID();
      pending.current = { key, request };
      const d = await draftAction(() => openDraft(facility.id, id!, phaseId, request));
      restore(d);
      setChatOpen(true);
      opened = true;
      pending.current = undefined;
    } catch (err) {
      if (currentScope.current === scope) setVoiceStartError((err as Error).message);
    } finally {
      if (!opened && connection) microphone.stop(connection);
    }
  }

  async function persist(d: RideDraft, key: string, input: SessionInput, request: string = crypto.randomUUID()) {
    const operation = pending.current?.key === key ? pending.current : { key, request, input };
    if (pending.current && pending.current.key !== key) {
      throw new Error("A save is unresolved. Retry the same action or reload the saved draft.");
    }
    pending.current = operation;
    const next = await saveDraft(d, operation.request, operation.input!);
    if (currentScope.current !== scope) throw new Error("The active ride changed.");
    setVoiceDraft(next);
    pending.current = undefined;
    return next;
  }

  async function recordVoiceScore(proposal: VoiceScore, request: string) {
    const question = questions.data?.find(q => q.id === proposal.questionId && q.phase_id === phaseId && q.axis === "foundation");
    if (!voiceDraft || !voiceEligible || !question || !Number.isInteger(proposal.score) || Math.abs(proposal.score) > 3)
      throw new Error("This score no longer matches the ride sheet.");
    const next = { ...drafts, [question.id]: { ...drafts[question.id], score: proposal.score } };
    const key = "voice:" + request;
    if (proposal.binding.draft_id !== voiceDraft.id || proposal.binding.question_id !== question.id || proposal.binding.version !== voiceDraft.version)
      throw new Error("The active question changed. Reload the saved draft.");
    const operation = pending.current?.key === key ? pending.current : { key, request, input: payload(next) };
    if (pending.current && pending.current.key !== key) throw new Error("Resolve the pending save first.");
    pending.current = operation;
    const saved = await draftAction(() => confirmGuidedScore(voiceDraft, proposal, operation.input!));
    pending.current = undefined;
    restore(saved);
  }

  async function reloadVoice() {
    if (!voiceDraft) return;
    setError(null);
    try {
      const d = await draftAction(() => getDraft(voiceDraft.id));
      if (d.status !== "draft") {
        rememberTerminal();
        if (d.status === "completed") refreshSavedRide();
        allowLeave();
        navigate(`/horses/${id}`);
        return;
      }
      restore(d);
      pending.current = undefined;
      rememberTerminal();
      setVoicePanelRevision(n => n + 1);
    } catch (err) { if (currentScope.current === scope) setError((err as Error).message); }
  }

  function refreshSavedRide() {
    invalidate(["sessions", id]);
    invalidate(["sessions", "dates"]);
    invalidate(["ratings", id]);
  }

  async function discardVoice() {
    if (!voiceDraft) return;
    setError(null);
    try {
      await draftAction(async () => {
        const request = pending.current?.key === "discard" ? pending.current.request : crypto.randomUUID();
        pending.current = { key: "discard", request };
        rememberTerminal(voiceDraft.id);
        const discarded = await closeDraft(voiceDraft, request, "discard");
        if (discarded.status !== "discarded") throw new Error("Could not verify that the draft was discarded.");
      });
      pending.current = undefined;
      rememberTerminal();
      allowLeave();
      navigate(`/horses/${id}`);
    } catch (err) { if (currentScope.current === scope) setError((err as Error).message); }
  }

  const manualLocked = saving || draftOperation || !!(voiceDraft && pending.current);
  const cancel = () => {
    if (voiceDraft) {
      navigate(`/horses/${id}`);
    } else if (dirty) setConfirmDiscard(true);
    else navigate(`/horses/${id}`);
  };

  const submit = async () => {
    if (voiceBusy || actionLock.current) return;
    setError(null);
    if (scored > 0 && (questions.error || !questions.data?.length)) { setError("The score sheet is unavailable. Retry before saving; your entries are still here."); return; }
    if (!occurredAt || Number.isNaN(new Date(occurredAt).getTime())) { setError("Enter a valid ride date and time."); return; }
    if (!phaseId) {
      setError("Pick a phase first.");
      return;
    }
    if (confirmPhase) { setError("Choose the phase worked on the selected date."); return; }
    setSaving(true);
    try {
      if (voiceDraft) {
        await draftAction(async () => {
          let d = voiceDraft;
          if (pending.current?.key !== "finalize") d = await persist(d, "save-for-finalize", payload());
          if (currentScope.current !== scope) throw new Error("The active ride changed.");
          const request = pending.current?.key === "finalize" ? pending.current.request : crypto.randomUUID();
          pending.current = { key: "finalize", request };
          rememberTerminal(d.id);
          const completed = await closeDraft(d, request, "finalize");
          if (completed.status !== "completed" || !completed.session_id) throw new Error("Could not verify that this ride was saved.");
          pending.current = undefined;
          rememberTerminal();
        });
      } else await createSession(payload());
      if (currentScope.current !== scope) return;
      if (voiceDraft) refreshSavedRide();
      toast.success("Ride saved");
      allowLeave();
      navigate(`/horses/${id}`);
    } catch (err) {
      if (currentScope.current !== scope) return;
      const message = (err as Error).message;
      setError(message);
      toast.error(message);
    } finally {
      if (currentScope.current === scope) setSaving(false);
    }
  };

  return (
    <div className="view">
      {unsavedDialog}
      <Link className="workflow-link" to={`/horses/${id}`}>← {horse.data.name}</Link>
      <div className="eyebrow">{programLabel(horse.data.training_type)}</div>
      <h1 className="h-display" ref={reviewHeading} tabIndex={-1}>{voiceDraft ? "Review ride" : "Log a ride"}</h1>
      {(voiceEnabled || wantsVoice) && !voiceDraft && (
        <section className="card space-y-2" aria-labelledby="ride-along-title">
          <h2 id="ride-along-title" className="card-title">Ride-along scorer</h2>
          {!voiceEnabled ? <p>Ask your platform administrator to enable voice for this facility.</p>
            : isPerformance ? <p>Voice scoring is available for Foundation Phase 1 rides. Use the manual score sheet for this horse’s program.</p>
            : !voicePhase ? <p>The Foundation Phase 1 score sheet is missing from this facility.</p>
            : <>
              <p>Work through the Foundation Phase 1 questions one at a time. The mic opens with the conversation. You can also type a score.</p>
              {voiceEligible ? (
                <button type="button" className="btn btn-primary"
                  disabled={voiceStartBlocked || !hasVoiceQuestions || !!questions.error}
                  onClick={() => void beginVoice()}>
                  {draftOperation ? "Opening scorer…" : "Start or resume voice scoring"}
                </button>
              ) : (
                <>
                  <p className="muted">Setting up voice scoring selects Phase 1 for this ride only.</p>
                  <button type="button" className="btn btn-primary" disabled={voiceStartBlocked}
                    onClick={() => choosePhase(voicePhase.id)}>Set up Phase 1 voice scoring</button>
                </>
              )}
              {hasManualEdits && <p className="muted">Start the scorer from a new ride before changing the date or entering scores or notes. Finish this ride manually to keep your edits.</p>}
              {voiceEligible && !hasVoiceQuestions && !questions.error &&
                <p role="status">{questions.loading ? "Loading Phase 1 questions…" : "This score sheet has no Foundation questions."}</p>}
              {voiceEligible && questions.error && <ErrorState error={questions.error} onRetry={questions.refresh} />}
              {voiceStartError && <p className="alert-error" role="alert">{voiceStartError}</p>}
            </>}
        </section>
      )}
      {voiceDraft && <section className="space-y-2">
        {voiceEligible && <>
          <button type="button" className="btn btn-primary" disabled={draftOperation || saving}
            onClick={() => { microphone.start(); setChatOpen(true); }}>Back to conversation</button>
          <RideAlongPanel key={`${voiceDraft.id}:${voicePanelRevision}`} draft={voiceDraft} horseName={horse.data.name}
            questions={questions.data ?? []} open={chatOpen && !navigationBlocked} microphone={microphone}
            disabled={draftOperation || saving || !hasVoiceQuestions || !!questions.error}
            returnFocus={reviewHeading} onReview={() => setChatOpen(false)} onBusy={setVoiceBusy} onRecord={recordVoiceScore} />
        </>}
        {!voiceEnabled && <p role="status">Voice was disabled for this facility. You can still review and save your draft manually.</p>}
        <button type="button" className="btn btn-ghost" disabled={voiceBusy || draftOperation || saving}
          onClick={() => { if (window.confirm("Reload the saved draft and replace unsaved edits on this screen?")) void reloadVoice(); }}>
          Reload saved draft
        </button>
        <button type="button" className="btn btn-ghost" disabled={voiceBusy || draftOperation || saving || !!(pending.current && pending.current.key !== "discard")}
          onClick={() => { if (window.confirm("Discard this saved draft and its scores?")) void discardVoice(); }}>
          Discard saved draft
        </button>
      </section>}
      <div
        className="card"
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        }}
      >
        {!isPerformance && <div className="field"><span className="label">Current foundation phase</span>
          <strong>{foundationPhase?.name ?? "—"}</strong></div>}
        {!isPerformance && <RidePhaseSelect phases={phases.data} phaseId={phaseId} needsConfirmation={confirmPhase}
          hasEntries={hasEntries(drafts)} disabled={saving || draftOperation || Boolean(voiceDraft) || (hasEntries(drafts) && !questions.data)} onChoose={choosePhase} />}
        <div className="field">
          <label className="label" htmlFor="session-when">
            When
          </label>
          <input
            id="session-when"
            type="datetime-local"
            className="input"
            disabled={!!voiceDraft || draftOperation}
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
          />
        </div>

      </div>

      <NextRideFocus horse={horse.data} />
      {isPerformance && <>
        {sessions.error && <ErrorState error={sessions.error} onRetry={sessions.refresh} />}
        {sessions.loading && <p role="status">Loading discipline history…</p>}
        <TaskCompletionPicker goals={horse.data.program_meta?.training_goals} value={tasks} onChange={setTasks} history={history} />
      </>}

      <div className="card">
        <label className="label" htmlFor="session-notes">
          Ride notes
        </label>
        <textarea
          id="session-notes"
          rows={3}
          className="input"
          disabled={manualLocked}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <details className="card"><summary>{isPerformance ? "Rider and bit" : "Rider"}</summary>
        <div className="field-row">
            <div className="field">
              <label className="label" htmlFor="session-rider">
                Rider
              </label>
              <input
                id="session-rider"
                className="input"
                placeholder="Who rode today"
                disabled={manualLocked}
              value={rider}
                onChange={(e) => setRider(e.target.value)}
              />
            </div>
            {isPerformance && <div className="field">
              <label className="label" htmlFor="session-bit">
                Bit (this week)
              </label>
              <select
                id="session-bit"
                className="input"
                value={bit}
                onChange={(e) => setBit(e.target.value)}
              >
                <option value="">—</option>
                {bitOptions(horse.data.training_type).map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>}
        </div>
      </details>
      <details className="card" open={voiceDraft ? true : undefined}>
        <summary>{voiceDraft ? "Score sheet" : "Optional score sheet"} · {scored} of {total} scored</summary>
      {questions.error ? <ErrorState error={questions.error} onRetry={questions.refresh} /> : questions.loading || !phaseId ? (
        <ScoreSheetSkeleton />
      ) : (
        <PhaseScoreSheet
          phaseCode={currentPhase?.code}
          questions={questions.data ?? []}
          drafts={drafts}
          onScore={setScore}
          onComment={setComment}
          scale={scale}
          readOnly={manualLocked}
        />
      )}

      </details>
      {error && (
        <div role="alert" className="alert-error" style={{ marginTop: 10 }}>
          <span className="alert-error-icon" aria-hidden>
            ⚠
          </span>
          <span className="alert-error-body">{error}</span>
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 8,
          marginTop: 12,
        }}
      >
        {(scored === 0 || scored < total) && (
          <span
            className="muted"
            style={{ fontSize: 13, marginRight: "auto" }}
          >
            {scored === 0 ? "Saves as unscored · add scores later" : `${total - scored} items unscored`}
          </span>
        )}
        <button type="button" className="btn btn-ghost" disabled={saving || voiceBusy || draftOperation} onClick={cancel}>
          {voiceDraft ? "Leave draft" : "Cancel"}
        </button>
        <button
          className="btn btn-leather"
          disabled={saving || voiceBusy || draftOperation || !phaseId || confirmPhase || pending.current?.key === "discard"}
          onClick={submit}
        >
          {saving ? "Saving…" : "Save ride"}
        </button>
      </div>

      <ConfirmDialog
        open={confirmDiscard}
        title="Discard this session?"
        body="Your scores and notes won't be saved."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        danger
        onConfirm={() => { allowLeave(); navigate(`/horses/${id}`); }}
        onCancel={() => setConfirmDiscard(false)}
      />
    </div>
  );
}
