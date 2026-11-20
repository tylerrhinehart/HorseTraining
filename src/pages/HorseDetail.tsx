import useUnsavedChanges from "../hooks/useUnsavedChanges";
import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { differenceInDays, parseISO } from "date-fns";
import { useForm } from "react-hook-form";
import {
  archiveHorse,
  deleteHorse,
  getHorse,
  listPhases,
  listSessionsForHorse,
  setHorseStatus,
  updateHorse,
} from "../supabase/queries";
import { qk } from "../supabase/keys";
import { PROGRAMS, programLabel, taskJobName } from "../content/programs";
import HorseProgramFields, { programFormDefaults, programMetaFromForm, type HorseProgramForm } from "../components/HorseProgramFields";
import DisciplineHistoryCard from "../components/DisciplineHistory";
import { lastWorkedByDiscipline } from "../utils/disciplineHistory";
import WeeklyComments from "../components/WeeklyComments";
import type { TrainingType } from "../supabase/types";
import { useQuery } from "../supabase/useQuery";
import FoundationWorkflow from "../components/FoundationWorkflow";
import NextRideFocus from "../components/NextRideFocus";
import { rideWork } from "../utils/rideWork";
import { sessionAverages, formatAvg } from "../utils/stats";
import { formatHumanDate } from "../utils/dates";
import Sparkline from "../components/Sparkline";
import ConfirmDialog from "../components/ConfirmDialog";
import ErrorState from "../components/ErrorState";
import { SkeletonCard } from "../components/Skeleton";
import { useToast } from "../components/Toast";
import type { Phase } from "../supabase/types";

interface EditFormValues extends HorseProgramForm {
  name: string;
  owner_name: string;
  owner_contact: string;
  arrival_date: string;
  notes: string;
  training_type: TrainingType;
  target_market: string;
  price_low: string;
  price_high: string;
}

export default function HorseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [editSavedAt, setEditSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (editSavedAt === null) return;
    const t = setTimeout(() => setEditSavedAt(null), 3000);
    return () => clearTimeout(t);
  }, [editSavedAt]);

  const horse = useQuery(id ? qk.horse(id) : null, () => getHorse(id!));
  const sessions = useQuery(id ? qk.sessions(id) : null, () =>
    listSessionsForHorse(id!),
  );
  const phases = useQuery(qk.phases(), () => listPhases());

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { isSubmitting: isEditSubmitting, isDirty: isEditDirty, errors: editErrors },
  } = useForm<EditFormValues>();

  const [focusDirty, setFocusDirty] = useState(false);
  const [weeklyDirty, setWeeklyDirty] = useState(false);
  const { dialog: unsavedDialog } = useUnsavedChanges((isEditDirty || weeklyDirty || focusDirty) && !isEditSubmitting);
  const editTrainingType = watch("training_type");

  const formHorseId = useRef<string>();
  // Sync edit form defaults when horse data loads
  useEffect(() => {
    if (horse.data && (!isEditDirty || formHorseId.current !== horse.data.id)) {
      formHorseId.current = horse.data.id;
      reset({
        ...programFormDefaults(horse.data.program_meta),
        name: horse.data.name,
        owner_name: horse.data.owner_name ?? "",
        owner_contact: horse.data.owner_contact ?? "",
        arrival_date: horse.data.arrival_date ?? "",
        notes: horse.data.notes ?? "",
        training_type: horse.data.training_type,
        target_market: horse.data.program_meta?.target_market ?? "",
        price_low: horse.data.program_meta?.price_low?.toString() ?? "",
        price_high: horse.data.program_meta?.price_high?.toString() ?? "",
      });
    }
  }, [horse.data, reset, isEditDirty]);

  if (!id) return null;

  // Full-page skeleton only on the horse's true first load (nothing cached yet).
  if (horse.data === undefined && horse.loading) {
    return (
      <div className="view" style={{ maxWidth: 720 }}>
        <SkeletonCard lines={2} />
        <div style={{ marginTop: 20 }}>
          <SkeletonCard lines={4} />
        </div>
      </div>
    );
  }

  // Fetch failure is distinct from "not found": surface a retry UI.
  if (horse.error && horse.data === undefined) {
    return (
      <div className="view" style={{ maxWidth: 720 }}>
        <ErrorState error={horse.error} onRetry={horse.refresh} />
      </div>
    );
  }

  // Genuine "not found" only once the query resolved to null (no error, loaded).
  if (!horse.data) {
    return (
      <div className="view">
        <div className="card">
          Horse not found.{" "}
          <Link to="/horses" style={{ color: "var(--leather)" }}>
            Back
          </Link>
        </div>
      </div>
    );
  }

  // Only this horse's program has its score sheets; filter the global phase list.
  const allPhases: Phase[] = (phases.data ?? [])
    .filter((p) => p.program === horse.data!.training_type)
    .sort((a, b) => a.position - b.position);

  // Determine current phase (defensive: fall back to first)
  const currentPhase =
    allPhases.find((p) => p.id === horse.data!.current_phase_id) ??
    allPhases[0] ??
    null;

  const allSessions = sessions.data ?? [];
  const points = sessionAverages(allSessions);

  // Per-session combined averages for the current phase only
  const currentPhaseSessions = allSessions.filter(
    (s) => currentPhase && s.phase_id === currentPhase.id,
  );
  const currentPhasePoints = points.filter(
    (p) => currentPhase && p.phaseId === currentPhase.id,
  );
  const currentPhaseAvgs = currentPhasePoints
    .map((p) => p.foundationAverage)
    .filter((v): v is number => v !== null);
  const currentPhaseAvg =
    currentPhaseAvgs.length > 0
      ? currentPhaseAvgs.reduce((s, n) => s + n, 0) / currentPhaseAvgs.length
      : null;

  const scoredRides = points.filter(point => point.count > 0).length;
  const scoredInProgram = points.filter(point =>
    point.combinedAverage !== null && allPhases.some(phase => phase.id === point.phaseId));
  const programAverage = scoredInProgram.length
    ? scoredInProgram.reduce((sum, point) => sum + point.combinedAverage!, 0) / scoredInProgram.length
    : null;

  // Scale-aware display: signed ±3 for Foundation, unsigned 1–5 otherwise.
  const scale = horse.data.training_type === "foundation" ? "tqa" : "five";

  const dayLabel = horse.data.arrival_date ? `Day ${Math.max(1, differenceInDays(new Date(), parseISO(horse.data.arrival_date)) + 1)}` : null;

  const handleArchive = async () => {
    setArchiving(true);
    try {
      await archiveHorse(id);
      navigate("/horses");
    } catch (e) {
      // Stay on the page so the action can be retried.
      toast.error((e as Error).message || "Couldn't archive the horse.");
    } finally {
      setArchiving(false);
    }
  };

  const handleReopen = async () => {
    setReopening(true);
    try {
      await setHorseStatus(id, "in_training");
      toast.success("Training re-opened");
    } catch (e) {
      toast.error((e as Error).message || "Couldn't re-open training.");
    } finally {
      setReopening(false);
    }
  };

  const performDelete = async () => {
    setDeleting(true);
    try {
      await deleteHorse(id);
      toast.success("Horse deleted");
      navigate("/horses");
    } catch (e) {
      // Stay on the page so the action can be retried.
      toast.error((e as Error).message || "Couldn't delete the horse.");
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const onEditSubmit = async (values: EditFormValues) => {
    try {
      const program_meta = programMetaFromForm(values, horse.data!.program_meta);
      const changingProgram = values.training_type !== horse.data!.training_type;
      const firstPhase = phases.data?.filter((p) => p.program === values.training_type).sort((a, b) => a.position - b.position)[0];
      if (changingProgram && !firstPhase) throw new Error("The new program’s score sheets are unavailable. Retry after phases load.");
      await updateHorse(id, {
        name: values.name.trim(),
        owner_name: values.owner_name || null,
        owner_contact: values.owner_contact || null,
        arrival_date: values.arrival_date || null,
        notes: values.notes || null,
        program_meta,
        ...(changingProgram ? { training_type: values.training_type, current_phase_id: firstPhase!.id } : {}),
      }, horse.data!.updated_at);
      reset(values);
      toast.success("Saved");
      setEditSavedAt(Date.now());
    } catch (e) {
      toast.error((e as Error).message || "Couldn't save changes.");
    }
  };

  const isFiveScale = horse.data.training_type !== "foundation";
  const recent = [...allSessions].reverse().slice(0, 3);
  return (
    <div className="view" style={{ maxWidth: 720 }}>
      {/* ── 1. Header ── */}
      {unsavedDialog}
      <header className="task-choice workspace-heading">
        <div><div className="eyebrow">{programLabel(horse.data.training_type)}</div>
          <h1 className="h-display">{horse.data.name}</h1>
          <p className="muted">Owner: {horse.data.owner_name ?? "—"}{dayLabel && ` · ${dayLabel}`}</p>
          {horse.data.status !== "in_training" && <span className="pill">{horse.data.status === "complete" ? "Complete" : "Archived"}</span>}
        </div>
        {horse.data.status === "in_training" && <Link className="btn btn-leather" to={`/horses/${id}/sessions/new`}>Start Ride</Link>}
      </header>
      {[phases,sessions].filter(query=>query.error).map((query,index)=><ErrorState key={index} error={query.error!} onRetry={query.refresh} />)}
      <section className="card workflow-panel">
        {isFiveScale
          ? sessions.data ? <DisciplineHistoryCard history={lastWorkedByDiscipline(sessions.data)} goals={horse.data.program_meta?.training_goals ?? []} /> : <p>{sessions.error ? "Discipline history unavailable." : "Loading discipline history…"}</p>
          : currentPhase ? <FoundationWorkflow key={horse.data.id} horse={horse.data} current={currentPhase} phases={allPhases} /> : <p>{phases.error ? "Phase unavailable." : "Loading phase…"}</p>}
        {!isFiveScale && !!horse.data.program_meta?.training_goals?.length && <p>Goals: {horse.data.program_meta.training_goals.map(taskJobName).join(", ")}</p>}
        <NextRideFocus key={horse.data.id} horse={horse.data} onDirty={setFocusDirty} />
      </section>
      <section className="card workflow-panel"><h2 className="card-title">Recent rides</h2>
        {recent.length ? recent.map(ride => <div key={ride.id} className="recent-ride">
          <span className="muted">{formatHumanDate(ride.occurred_at)}</span>
          <div><Link to={`/sessions/${ride.id}`}>{rideWork(phases.data?.find(p => p.id === ride.phase_id),ride.task_completions)}</Link>
          {ride.notes && <p>{ride.notes}</p>}</div>
        </div>) : <p className="muted">{sessions.loading ? "Loading rides…" : sessions.error ? "Ride history unavailable." : "No rides logged yet."}</p>}
      </section>
      <details className="card" style={{marginTop:12}}><summary>All ride history ({allSessions.length})</summary>
        <dl className="ride-stats">
          <div><dt>Rides</dt><dd>{allSessions.length}</dd></div>
          <div><dt>Scored rides</dt><dd>{scoredRides}</dd></div>
          <div><dt>Current program average</dt><dd>{formatAvg(programAverage, scale)}</dd></div>
        </dl>
        {currentPhase && currentPhaseSessions.length > 0 && <div>
          <p>{isFiveScale ? "Current program" : currentPhase.name} · {currentPhaseSessions.length} rides · Foundation average {formatAvg(currentPhaseAvg, scale)}</p>
          {currentPhaseAvgs.length > 1 && <Sparkline values={currentPhaseAvgs} scale={scale} />}
        </div>}
        {allSessions.length ? [...allSessions].reverse().map(session => {
          const unscored = session.ratings.length === 0;
          const work = rideWork(phases.data?.find(p => p.id === session.phase_id), session.task_completions);
          return (
            <article key={session.id} className="task-row">
              <div className="task-choice">
                <strong>{formatHumanDate(session.occurred_at)} · {unscored ? "Unscored" : "Scored"}</strong>
                <Link className="btn btn-ghost btn-sm" to={`/sessions/${session.id}${unscored ? "?edit=scores" : ""}`}>
                  {unscored ? "Add scores" : "Review ride"}
                </Link>
              </div>
              <p className="muted">{work}</p>
              {session.notes && <p>{session.notes}</p>}
            </article>
          );
        }) : <p className="muted">Saved rides will appear here.</p>}
      </details>
      <Link className="workflow-link" to={`/horses/${id}/report`}>View / download report</Link>
      <details className="card" style={{marginTop:12}}><summary>Finish or review training</summary>
        <p className="muted">Review the final evaluation when you are ready to finish this horse’s training. Your ride history remains available.</p>
        <Link to={`/horses/${id}/finish`} className="btn">{horse.data.status === "in_training" ? "Finish training" : "Review final evaluation"}</Link>
      </details>

      {/* ── 5. Edit details (collapsible) ── */}
      <WeeklyComments horse={horse.data} onDirtyChange={setWeeklyDirty} />
      <details className="card" style={{ marginTop: "var(--gap)" }}>
        <summary
          style={{
            cursor: "pointer",
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: 16,
            listStyle: "none",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          Edit details
        </summary>
        <form
          onSubmit={handleSubmit(onEditSubmit)}
          style={{ marginTop: 16 }}
        >
          <div className="field" style={{ marginBottom: 12 }}>
            <label className="label" htmlFor="edit-training-type">
              Type of training
            </label>
            <select
              id="edit-training-type"
              className="input"
              {...register("training_type")}
            >
              {PROGRAMS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} — {p.tagline}
                </option>
              ))}
            </select>
            {editTrainingType !== horse.data.training_type && (
              <p style={{ color: "var(--bad)", fontSize: 12, margin: "4px 0 0" }}>
                Changing the program resets this horse to the new program's first
                phase.
              </p>
            )}
          </div>
          <HorseProgramFields register={register as unknown as import("react-hook-form").UseFormRegister<HorseProgramForm>} trainingType={editTrainingType} prefix="edit" />
          {editTrainingType === "sale_horse" && (
            <div className="field-row">
              <div className="field">
                <label className="label" htmlFor="edit-target-market">
                  Target market
                </label>
                <input
                  id="edit-target-market"
                  className="input"
                  {...register("target_market")}
                />
              </div>
              <div className="field">
                <label className="label">Target sale price</label>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input
                    type="number"
                    className="input"
                    aria-label="Low target sale price" min="0" step="0.01" placeholder="Low"
                    {...register("price_low")}
                  />
                  <span className="muted">–</span>
                  <input
                    type="number"
                    className="input"
                    aria-label="High target sale price" min="0" step="0.01" placeholder="High"
                    {...register("price_high")}
                  />
                </div>
              </div>
            </div>
          )}
          <div className="field-row">
            <div className="field">
              <label className="label" htmlFor="edit-name">
                Horse name
              </label>
              <input
                id="edit-name"
                className="input"
                {...register("name", { required: "Horse name is required", validate: value => !!value.trim() || "Horse name is required" })}
              />
              {editErrors.name && <p role="alert">{editErrors.name.message}</p>}
            </div>
            <div className="field">
              <label className="label" htmlFor="edit-owner-name">
                Owner name
              </label>
              <input
                id="edit-owner-name"
                className="input"
                {...register("owner_name")}
              />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label className="label" htmlFor="edit-owner-contact">
                Owner contact
              </label>
              <input
                id="edit-owner-contact"
                className="input"
                placeholder="Phone, email, or address"
                {...register("owner_contact")}
              />
            </div>
            <div className="field">
              <label className="label" htmlFor="edit-arrival-date">
                Arrival date
              </label>
              <input
                id="edit-arrival-date"
                type="date"
                className="input"
                {...register("arrival_date")}
              />
            </div>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label className="label" htmlFor="edit-notes">
              Notes
            </label>
            <textarea
              id="edit-notes"
              rows={3}
              className="input"
              {...register("notes")}
            />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: 12,
            }}
          >
            {editSavedAt && (
              <span
                role="status"
                aria-live="polite"
                style={{ color: "var(--ok)", fontSize: 13 }}
              >
                Saved ✓
              </span>
            )}
            <button
              type="submit"
              className="btn btn-leather btn-sm"
              disabled={isEditSubmitting}
            >
              {isEditSubmitting ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </details>

      {/* ── 6. Danger actions (collapsible) ── */}
      <details className="card" style={{ marginTop: "var(--gap)" }}>
        <summary
          style={{
            cursor: "pointer",
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: 16,
            listStyle: "none",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          More actions
        </summary>
        <div
          style={{
            marginTop: 16,
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          {horse.data.status !== "archived" && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleArchive}
              disabled={archiving}
            >
              {archiving ? "Archiving…" : "Archive horse"}
            </button>
          )}
          {horse.data.status !== "in_training" && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleReopen}
              disabled={reopening}
            >
              {reopening ? "Re-opening…" : horse.data.status === "archived" ? "Resume training" : "Re-open training"}
            </button>
          )}
          <button
            className="btn btn-danger btn-sm"
            onClick={() => setDeleteDialogOpen(true)}
          >
            Delete permanently
          </button>
        </div>
      </details>

      {/* ── Delete confirmation dialog ── */}
      <ConfirmDialog
        open={deleteDialogOpen}
        danger
        title={`Delete ${horse.data.name}?`}
        body="This permanently removes this horse and all its sessions and ratings. This cannot be undone."
        confirmLabel={deleting ? "Deleting…" : "Delete permanently"}
        busy={deleting}
        onConfirm={performDelete}
        onCancel={() => setDeleteDialogOpen(false)}
      />
    </div>
  );
}
