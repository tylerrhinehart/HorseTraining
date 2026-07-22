import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { differenceInDays, parseISO } from "date-fns";
import { useForm } from "react-hook-form";
import {
  archiveHorse,
  deleteHorse,
  getHorse,
  listPhases,
  listRatingsForHorse,
  listSessionsForHorse,
  setHorseCurrentPhase,
  setHorseStatus,
  setHorseTrainingType,
  updateHorse,
} from "../supabase/queries";
import { qk } from "../supabase/keys";
import { PROGRAMS, programLabel } from "../content/programs";
import type { ProgramMeta, TrainingType } from "../supabase/types";
import { useQuery } from "../supabase/useQuery";
import { useActiveHorseId } from "../state/activeHorse";
import {
  computeRollingAverage,
  isAtOrAboveStandard,
  nextPhase,
} from "../utils/phaseProgression";
import { sessionAverages, formatAvg } from "../utils/stats";
import { formatHumanDate } from "../utils/dates";
import HorseAvatar, { hashTone } from "../components/HorseAvatar";
import Sparkline from "../components/Sparkline";
import { IconRibbon } from "../components/Icons";
import ConfirmDialog from "../components/ConfirmDialog";
import ErrorState from "../components/ErrorState";
import { SkeletonCard } from "../components/Skeleton";
import { useToast } from "../components/Toast";
import type { Phase } from "../supabase/types";

interface EditFormValues {
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
  const [, setActiveId] = useActiveHorseId();
  const [expandedPhaseId, setExpandedPhaseId] = useState<string | null>(null);
  const [advanceDialogOpen, setAdvanceDialogOpen] = useState(false);
  const [advancing, setAdvancing] = useState(false);
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
  const ratings = useQuery(id ? qk.ratings(id) : null, () =>
    listRatingsForHorse(id!),
  );

  useEffect(() => {
    if (id) setActiveId(id);
  }, [id, setActiveId]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { isSubmitting: isEditSubmitting },
  } = useForm<EditFormValues>();

  const editTrainingType = watch("training_type");

  // Sync edit form defaults when horse data loads
  useEffect(() => {
    if (horse.data) {
      reset({
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
  }, [horse.data, reset]);

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

  // Secondary queries stream in behind the header; show skeletons meanwhile.
  const detailsReady =
    phases.data !== undefined &&
    sessions.data !== undefined &&
    ratings.data !== undefined;

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
    .map((p) => p.combinedAverage)
    .filter((v): v is number => v !== null);
  const currentPhaseAvg =
    currentPhaseAvgs.length > 0
      ? currentPhaseAvgs.reduce((s, n) => s + n, 0) / currentPhaseAvgs.length
      : null;

  // Rolling 7-session average for advance gate
  const rolling7Average = computeRollingAverage(currentPhaseAvgs);

  const nextP = currentPhase ? nextPhase(currentPhase, allPhases) : null;
  // Advancing is a TQA-scale (Foundation) concept — gate it on the phase scale.
  const canAdvance = !!nextP && currentPhase?.scale === "tqa";

  // Last session date for current phase
  const sortedCurrentPhaseSessions = [...currentPhaseSessions].sort(
    (a, b) => b.occurred_at.localeCompare(a.occurred_at),
  );
  const lastSessionDate =
    sortedCurrentPhaseSessions.length > 0
      ? sortedCurrentPhaseSessions[0].occurred_at
      : null;

  // Scale-aware display: signed ±3 for Foundation, unsigned 1–5 otherwise.
  const scale = horse.data.training_type === "foundation" ? "tqa" : "five";

  // Day label — "Day X of 60"/"Day 60+" is a Foundation-only framing (Wade A1).
  let dayLabel: string | null = null;
  if (horse.data.arrival_date) {
    const today = new Date();
    const arrival = parseISO(horse.data.arrival_date);
    const dayNum = differenceInDays(today, arrival) + 1;
    if (horse.data.training_type === "foundation") {
      if (dayNum >= 1 && dayNum <= 60) {
        dayLabel = `Day ${dayNum} of 60`;
      } else if (dayNum > 60) {
        dayLabel = "Day 60+";
      }
    } else if (dayNum >= 1) {
      dayLabel = `Day ${dayNum}`;
    }
  }

  // Phase average from ratings for a given phase id
  const phaseAvgFromRatings = (phaseId: string): number | null => {
    const phaseRatings = (ratings.data ?? []).filter(
      (r) => r.phase_id === phaseId,
    );
    if (phaseRatings.length === 0) return null;
    return (
      phaseRatings.reduce((s, r) => s + r.score, 0) / phaseRatings.length
    );
  };

  const handleAdvance = () => {
    if (!currentPhase || !canAdvance) return;
    if (isAtOrAboveStandard(rolling7Average)) {
      // Recommended — advance immediately without confirm
      void performAdvance();
      return;
    }
    setAdvanceDialogOpen(true);
  };

  const performAdvance = async () => {
    if (!currentPhase || !nextP || currentPhase.scale !== "tqa") return;
    setAdvancing(true);
    try {
      await setHorseCurrentPhase(horse.data!.id, nextP.id);
      toast.success(`Advanced to ${nextP.name}`);
      setAdvanceDialogOpen(false);
    } catch (e) {
      toast.error((e as Error).message || "Couldn't advance the phase.");
    } finally {
      setAdvancing(false);
    }
  };

  const advanceDialogCopy =
    rolling7Average == null
      ? `No sessions logged in this phase yet. Advance to ${nextP?.name ?? "the next phase"} anyway?`
      : `This phase's average is ${formatAvg(rolling7Average, scale)}, below the +2.0 TQA industry standard. Some horses need more time — that's a recordable outcome. Continue to ${nextP?.name ?? "the next phase"}?`;

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
    const program_meta: ProgramMeta = {};
    if (values.training_type === "sale_horse") {
      if (values.target_market?.trim())
        program_meta.target_market = values.target_market.trim();
      if (values.price_low) program_meta.price_low = Number(values.price_low);
      if (values.price_high) program_meta.price_high = Number(values.price_high);
    }
    try {
      await updateHorse(id, {
        name: values.name,
        owner_name: values.owner_name || null,
        owner_contact: values.owner_contact || null,
        arrival_date: values.arrival_date || null,
        notes: values.notes || null,
        program_meta,
      });
      // Switching program resets the current phase to the new program's first.
      if (values.training_type !== horse.data!.training_type) {
        await setHorseTrainingType(id, values.training_type);
      }
      toast.success("Saved");
      setEditSavedAt(Date.now());
    } catch (e) {
      toast.error((e as Error).message || "Couldn't save changes.");
    }
  };

  const isFiveScale = horse.data.training_type !== "foundation";
  const avgColor = (avg: number | null): string => {
    if (avg === null) return "var(--muted)";
    if (isFiveScale) {
      // 1…5 performance scale: 4+ Good, below 3 Poor.
      if (avg >= 4) return "var(--ok)";
      if (avg < 3) return "var(--bad)";
      return "var(--ink-2)";
    }
    if (avg >= 2.0) return "var(--ok)";
    if (avg < 0) return "var(--bad)";
    return "var(--ink-2)";
  };

  return (
    <div className="view" style={{ maxWidth: 720 }}>
      {/* ── 1. Header ── */}
      <div className="eyebrow">Horse workspace</div>

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 16,
          marginBottom: 4,
        }}
      >
        <HorseAvatar
          name={horse.data.name}
          tone={hashTone(horse.data.name)}
          size={64}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1
            className="h-display"
            style={{
              margin: "0 0 4px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            {horse.data.name}
            {horse.data.status === "complete" && (
              <span className="pill">Complete</span>
            )}
            {horse.data.status === "archived" && (
              <span className="pill pill-muted">Archived</span>
            )}
          </h1>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            Owner: {horse.data.owner_name ?? "—"}
          </p>
          <span
            className="pill pill-leather"
            style={{ marginTop: 6, display: "inline-block" }}
          >
            {programLabel(horse.data.training_type)}
          </span>
        </div>
        {dayLabel && (
          <div
            style={{
              flexShrink: 0,
              textAlign: "right",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "1.2px",
              textTransform: "uppercase",
              color: "var(--muted)",
              paddingTop: 4,
            }}
          >
            {dayLabel}
          </div>
        )}
      </div>

      {!detailsReady ? (
        <>
          <div style={{ marginTop: 20 }}>
            <SkeletonCard lines={4} />
          </div>
          <div style={{ marginTop: "var(--gap)" }}>
            <SkeletonCard lines={3} />
          </div>
        </>
      ) : (
        <>
          {/* ── 2. Phase progression ribbon ── */}
          <div className="card" style={{ marginTop: 20 }}>
            <div className="card-head">
              <h2 className="card-title">Phase progression</h2>
              {currentPhase && (
                <span className="card-meta">
                  {allPhases.filter((p) => p.position < currentPhase.position).length}
                  /{allPhases.length} complete
                </span>
              )}
            </div>
            <div className="phase-ribbon">
              {allPhases.map((phase) => {
                const isCurrent =
                  currentPhase != null && phase.id === currentPhase.id;
                const isCompleted =
                  currentPhase != null && phase.position < currentPhase.position;
                const isSelected = expandedPhaseId === phase.id;
                return (
                  <button
                    key={phase.id}
                    type="button"
                    className={`phase-pip${isCompleted ? " is-done" : ""}${isCurrent ? " is-current" : ""}`}
                    aria-pressed={isSelected}
                    aria-label={`${phase.name} — ${
                      isCompleted ? "completed" : isCurrent ? "current" : "upcoming"
                    }`}
                    onClick={() =>
                      setExpandedPhaseId(isSelected ? null : phase.id)
                    }
                  >
                    <span className="phase-pip-n">
                      {isCompleted ? "✓" : (phase.name.match(/(\d+)\s*$/)?.[1] ?? phase.name.charAt(0).toUpperCase())}
                    </span>
                    <span className="phase-pip-l">{phase.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Tapped-phase detail panel */}
            {expandedPhaseId &&
              (() => {
                const phase = allPhases.find((p) => p.id === expandedPhaseId);
                if (!phase || !currentPhase) return null;
                const isCurrent = phase.id === currentPhase.id;
                const isUpcoming = phase.position > currentPhase.position;
                const phaseSessions = [...allSessions]
                  .filter((s) => s.phase_id === phase.id)
                  .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
                const phaseAvg = phaseAvgFromRatings(phase.id);
                const prevP =
                  allPhases[allPhases.findIndex((p) => p.id === phase.id) - 1] ??
                  null;
                return (
                  <div
                    style={{
                      marginTop: 12,
                      padding: "12px 14px",
                      background: "var(--paper)",
                      border: "1px solid var(--line)",
                      borderRadius: "var(--radius)",
                      animation: "rise-in var(--dur-2) var(--ease-out)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        gap: 10,
                        flexWrap: "wrap",
                      }}
                    >
                      <strong
                        style={{
                          fontFamily: "var(--font-display)",
                          fontSize: 15,
                        }}
                      >
                        {phase.name}
                      </strong>
                      <span className="mono muted" style={{ fontSize: 11 }}>
                        {phaseSessions.length} session
                        {phaseSessions.length !== 1 ? "s" : ""}
                        {phaseAvg !== null && (
                          <>
                            {" "}
                            · avg{" "}
                            <span style={{ color: avgColor(phaseAvg) }}>
                              {formatAvg(phaseAvg, scale)}
                            </span>
                          </>
                        )}
                      </span>
                    </div>
                    {isUpcoming ? (
                      <p
                        className="muted"
                        style={{ fontSize: 13, margin: "8px 0 0" }}
                      >
                        Not started yet — finish{" "}
                        {prevP ? prevP.name : "the previous phase"} and advance
                        to reach this one.
                      </p>
                    ) : isCurrent ? (
                      <p
                        className="muted"
                        style={{ fontSize: 13, margin: "8px 0 0" }}
                      >
                        The current phase — full detail below.
                      </p>
                    ) : phaseSessions.length === 0 ? (
                      <p
                        className="muted"
                        style={{ fontSize: 13, margin: "8px 0 0" }}
                      >
                        No sessions logged for this phase.
                      </p>
                    ) : (
                      <div style={{ marginTop: 4 }}>
                        {phaseSessions.map((s) => {
                          const pt = points.find((p) => p.sessionId === s.id);
                          return (
                            <Link
                              key={s.id}
                              to={`/sessions/${s.id}`}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                padding: "6px 0",
                                borderTop: "1px solid var(--line)",
                                textDecoration: "none",
                                color: "inherit",
                                fontSize: 13,
                              }}
                            >
                              <span>{formatHumanDate(s.occurred_at)}</span>
                              {pt?.combinedAverage !== undefined &&
                                pt.combinedAverage !== null && (
                                  <span
                                    className="mono"
                                    style={{
                                      color: avgColor(pt.combinedAverage),
                                      fontSize: 12,
                                    }}
                                  >
                                    {formatAvg(pt.combinedAverage, scale)}
                                  </span>
                                )}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}
          </div>

          {/* ── 3. Current phase card ── */}
          {currentPhase && (
            <div className="card" style={{ marginTop: "var(--gap)" }}>
              <div className="card-head">
                <h2 className="card-title">{currentPhase.name}</h2>
                <span className="card-meta">current phase</span>
              </div>

              {/* Phase running average + trend */}
              {currentPhaseSessions.length > 0 ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "space-between",
                    gap: 16,
                    flexWrap: "wrap",
                    marginBottom: 12,
                  }}
                >
                  <div>
                    <span
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: 32,
                        fontWeight: 600,
                        color: avgColor(currentPhaseAvg),
                        letterSpacing: "0.2px",
                      }}
                    >
                      {formatAvg(currentPhaseAvg, scale)}
                    </span>
                    <span
                      className="mono muted"
                      style={{ fontSize: 11, marginLeft: 8 }}
                    >
                      phase average
                    </span>
                  </div>
                  {currentPhaseAvgs.length >= 2 && (
                    <div style={{ flex: "1 1 160px", maxWidth: 260 }}>
                      <Sparkline values={currentPhaseAvgs} scale={scale} />
                      <div
                        className="mono muted"
                        style={{
                          fontSize: 9,
                          letterSpacing: 1.2,
                          textTransform: "uppercase",
                          marginTop: 2,
                          textAlign: "right",
                        }}
                      >
                        trend · {currentPhaseAvgs.length} sessions
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="muted" style={{ margin: "0 0 12px", fontSize: 14 }}>
                  No sessions yet
                </p>
              )}

              {/* Session count + last date as stat tiles */}
              <div className="horse-stats" style={{ margin: "0 0 16px" }}>
                <div className="stat">
                  <span className="k">Sessions</span>
                  <span className="v">{currentPhaseSessions.length}</span>
                </div>
                <div className="stat">
                  <span className="k">Last session</span>
                  <span className="v">
                    {lastSessionDate ? formatHumanDate(lastSessionDate) : "—"}
                  </span>
                </div>
              </div>

              {/* Primary CTA */}
              <Link
                to={`/horses/${id}/sessions/new`}
                className="btn btn-leather"
                style={{ marginBottom: 10, display: "inline-flex" }}
              >
                Log today's session
              </Link>

              {/* Secondary CTA: Advance (TQA/Foundation scale only) */}
              {canAdvance && nextP && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginTop: 8,
                  }}
                >
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={handleAdvance}
                  >
                    Advance to {nextP.name}
                  </button>
                  {isAtOrAboveStandard(rolling7Average) && (
                    <span className="pill" style={{ color: "var(--ok)", borderColor: "var(--ok)" }}>
                      Recommended
                    </span>
                  )}
                </div>
              )}

              {/* Sessions list for current phase */}
              {sortedCurrentPhaseSessions.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <div
                    className="mono muted"
                    style={{
                      fontSize: 10,
                      letterSpacing: "1.4px",
                      textTransform: "uppercase",
                      marginBottom: 6,
                    }}
                  >
                    Sessions this phase
                  </div>
                  {sortedCurrentPhaseSessions.map((s) => {
                    const pt = points.find((p) => p.sessionId === s.id);
                    return (
                      <Link
                        key={s.id}
                        to={`/sessions/${s.id}`}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "7px 0",
                          borderTop: "1px solid var(--line)",
                          textDecoration: "none",
                          color: "inherit",
                          fontSize: 14,
                        }}
                      >
                        <span>{formatHumanDate(s.occurred_at)}</span>
                        {pt?.combinedAverage !== undefined &&
                          pt.combinedAverage !== null && (
                            <span
                              className="mono"
                              style={{
                                color: avgColor(pt.combinedAverage),
                                fontSize: 13,
                              }}
                            >
                              {formatAvg(pt.combinedAverage, scale)}
                            </span>
                          )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── 4. Finish training button — a milestone, styled like one ── */}
      <div style={{ marginTop: "var(--gap)" }}>
        <Link
          to={`/horses/${id}/finish`}
          className="btn"
          style={{
            width: "100%",
            justifyContent: "center",
            borderColor: "var(--leather)",
            color: "var(--leather)",
            borderWidth: 1.5,
          }}
        >
          <IconRibbon size={16} />
          Finish training
        </Link>
      </div>

      {/* ── 5. Edit details (collapsible) ── */}
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
                    placeholder="Low"
                    {...register("price_low")}
                  />
                  <span className="muted">–</span>
                  <input
                    type="number"
                    className="input"
                    placeholder="High"
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
                {...register("name", { required: true })}
              />
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
          {horse.data.status === "complete" && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleReopen}
              disabled={reopening}
            >
              {reopening ? "Re-opening…" : "Re-open training"}
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

      {/* ── Advance confirmation dialog ── */}
      <ConfirmDialog
        open={advanceDialogOpen && !!nextP}
        title={`Advance to ${nextP?.name ?? "the next phase"}?`}
        body={advanceDialogCopy}
        confirmLabel={
          advancing ? "Advancing…" : `Advance to ${nextP?.name ?? "next phase"}`
        }
        busy={advancing}
        onConfirm={performAdvance}
        onCancel={() => setAdvanceDialogOpen(false)}
      />

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
