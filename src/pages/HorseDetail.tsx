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
  updateHorse,
} from "../supabase/queries";
import { useQuery } from "../supabase/useQuery";
import { useActiveHorseId } from "../state/activeHorse";
import {
  computeRollingAverage,
  isAtOrAboveStandard,
  nextPhase,
} from "../utils/phaseProgression";
import { sessionAverages, round1 } from "../utils/stats";
import { formatHumanDate } from "../utils/dates";
import HorseAvatar, { hashTone } from "../components/HorseAvatar";
import type { Phase } from "../supabase/types";

interface EditFormValues {
  name: string;
  owner_name: string;
  owner_contact: string;
  arrival_date: string;
  notes: string;
}

export default function HorseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [, setActiveId] = useActiveHorseId();
  const [expandedPhaseId, setExpandedPhaseId] = useState<string | null>(null);

  const horse = useQuery(
    () => (id ? getHorse(id) : Promise.resolve(null)),
    [id],
  );
  const sessions = useQuery(
    () => (id ? listSessionsForHorse(id) : Promise.resolve([])),
    [id],
  );
  const phases = useQuery(() => listPhases(), []);
  const ratings = useQuery(
    () => (id ? listRatingsForHorse(id) : Promise.resolve([])),
    [id],
  );

  useEffect(() => {
    if (id && horse.data && horse.data.status !== "archived") setActiveId(id);
  }, [id, horse.data, setActiveId]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting: isEditSubmitting },
  } = useForm<EditFormValues>();

  // Sync edit form defaults when horse data loads
  useEffect(() => {
    if (horse.data) {
      reset({
        name: horse.data.name,
        owner_name: horse.data.owner_name ?? "",
        owner_contact: horse.data.owner_contact ?? "",
        arrival_date: horse.data.arrival_date ?? "",
        notes: horse.data.notes ?? "",
      });
    }
  }, [horse.data, reset]);

  if (!id) return null;

  if (
    horse.loading ||
    phases.loading ||
    sessions.loading ||
    ratings.loading
  ) {
    return (
      <div className="view">
        <div className="card">Loading…</div>
      </div>
    );
  }

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

  const allPhases: Phase[] = (phases.data ?? []).slice().sort(
    (a, b) => a.position - b.position,
  );

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

  // Last session date for current phase
  const sortedCurrentPhaseSessions = [...currentPhaseSessions].sort(
    (a, b) => b.occurred_at.localeCompare(a.occurred_at),
  );
  const lastSessionDate =
    sortedCurrentPhaseSessions.length > 0
      ? sortedCurrentPhaseSessions[0].occurred_at
      : null;

  // Day X of 60
  let dayLabel: string | null = null;
  if (horse.data.arrival_date) {
    const today = new Date();
    const arrival = parseISO(horse.data.arrival_date);
    const dayNum = differenceInDays(today, arrival) + 1;
    if (dayNum >= 1 && dayNum <= 60) {
      dayLabel = `Day ${dayNum} of 60`;
    } else if (dayNum > 60) {
      dayLabel = "Day 60+";
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

  const formatSignedAvg = (n: number | null): string => {
    if (n == null) return "—";
    const sign = n >= 0 ? "+" : "";
    return `${sign}${n.toFixed(1)}`;
  };

  const handleAdvance = async () => {
    if (!currentPhase || !nextP) return;
    if (!isAtOrAboveStandard(rolling7Average)) {
      const ok = window.confirm(
        `This phase's average is ${formatSignedAvg(rolling7Average)}, below the +2.0 TQA industry standard. Some horses need more time — that's a recordable outcome. Continue to ${nextP.name}?`,
      );
      if (!ok) return;
    }
    await setHorseCurrentPhase(horse.data!.id, nextP.id);
    horse.refresh();
  };

  const handleArchive = async () => {
    await archiveHorse(id);
    navigate("/horses");
  };

  const handleReopen = async () => {
    await setHorseStatus(id, "in_training");
    horse.refresh();
  };

  const handleDelete = async () => {
    if (
      !window.confirm(
        `Permanently delete "${horse.data!.name}" and all sessions? This cannot be undone.`,
      )
    )
      return;
    await deleteHorse(id);
    navigate("/horses");
  };

  const onEditSubmit = async (values: EditFormValues) => {
    await updateHorse(id, {
      name: values.name,
      owner_name: values.owner_name || null,
      owner_contact: values.owner_contact || null,
      arrival_date: values.arrival_date || null,
      notes: values.notes || null,
    });
    horse.refresh();
  };

  const avgColor = (avg: number | null): string => {
    if (avg === null) return "var(--muted)";
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

      {/* ── 2. Phase progression strip ── */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-head">
          <h2 className="card-title">Phase progression</h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {allPhases.map((phase, idx) => {
            const isCurrent =
              currentPhase != null && phase.id === currentPhase.id;
            const isCompleted =
              currentPhase != null && phase.position < currentPhase.position;
            const isUpcoming =
              currentPhase != null && phase.position > currentPhase.position;

            const phaseSessionCount = allSessions.filter(
              (s) => s.phase_id === phase.id,
            ).length;
            const phaseAvg = phaseAvgFromRatings(phase.id);

            const isExpanded =
              isCurrent || expandedPhaseId === phase.id;

            const stateIcon = isCompleted ? "✓" : isCurrent ? "●" : "·";

            const phaseSessions = [...allSessions]
              .filter((s) => s.phase_id === phase.id)
              .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));

            const prevP =
              idx > 0 ? allPhases[idx - 1] : null;

            return (
              <div
                key={phase.id}
                style={{
                  borderTop: idx === 0 ? "none" : "1px solid var(--line)",
                  paddingTop: idx === 0 ? 0 : 12,
                  paddingBottom: 12,
                }}
              >
                {/* Phase row header */}
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  aria-label={`${phase.name} — ${
                    isCompleted ? "completed" : isCurrent ? "current" : "upcoming"
                  }${
                    isCompleted || isUpcoming
                      ? isExpanded
                        ? ", expanded"
                        : ", collapsed"
                      : ""
                  }`}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    width: "100%",
                    textAlign: "left",
                    cursor: isCompleted || isUpcoming ? "pointer" : "default",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                  onClick={() => {
                    if (isCompleted || isUpcoming) {
                      setExpandedPhaseId(
                        expandedPhaseId === phase.id ? null : phase.id,
                      );
                    }
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 18,
                      fontWeight: 700,
                      width: 20,
                      color: isCompleted
                        ? "var(--ok)"
                        : isCurrent
                          ? "var(--leather)"
                          : "var(--muted)",
                      flexShrink: 0,
                    }}
                  >
                    {stateIcon}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 16,
                      fontWeight: isCurrent ? 700 : 400,
                      color: isUpcoming ? "var(--muted)" : "var(--ink)",
                    }}
                  >
                    {phase.name}
                  </span>
                  <span
                    className="mono muted"
                    style={{ fontSize: 11, marginLeft: "auto" }}
                  >
                    {phaseSessionCount} session{phaseSessionCount !== 1 ? "s" : ""}
                    {phaseAvg !== null && (
                      <> · avg{" "}
                        <span style={{ color: avgColor(phaseAvg) }}>
                          {round1(phaseAvg)}
                        </span>
                      </>
                    )}
                  </span>
                </button>

                {/* Expanded content */}
                {isExpanded && isUpcoming && (
                  <div
                    style={{
                      marginTop: 8,
                      marginLeft: 30,
                      padding: "10px 12px",
                      background: "var(--paper)",
                      border: "1px solid var(--line)",
                      borderRadius: "var(--radius)",
                      fontSize: 13,
                      color: "var(--muted)",
                    }}
                  >
                    Locked — finish{" "}
                    {prevP ? prevP.name : "the previous phase"} first.{" "}
                    <Link
                      to={`/horses/${id}/sessions/new`}
                      style={{ color: "var(--leather)" }}
                    >
                      Start this phase early
                    </Link>
                  </div>
                )}

                {isExpanded && isCompleted && phaseSessions.length > 0 && (
                  <div style={{ marginTop: 8, marginLeft: 30 }}>
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
                                {round1(pt.combinedAverage)}
                              </span>
                            )}
                        </Link>
                      );
                    })}
                    {phaseSessions.length === 0 && (
                      <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                        No sessions logged.
                      </p>
                    )}
                  </div>
                )}

                {isExpanded && isCompleted && phaseSessions.length === 0 && (
                  <p
                    className="muted"
                    style={{ fontSize: 13, margin: "8px 0 0 30px" }}
                  >
                    No sessions logged for this phase.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 3. Current phase card ── */}
      {currentPhase && (
        <div className="card" style={{ marginTop: "var(--gap)" }}>
          <div className="card-head">
            <h2 className="card-title">{currentPhase.name}</h2>
            <span className="card-meta">current phase</span>
          </div>

          {/* Phase running average */}
          <div style={{ marginBottom: 12 }}>
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 32,
                fontWeight: 600,
                color: avgColor(currentPhaseAvg),
                letterSpacing: "0.2px",
              }}
            >
              {round1(currentPhaseAvg)}
            </span>
            <span
              className="mono muted"
              style={{ fontSize: 11, marginLeft: 8 }}
            >
              phase average
            </span>
          </div>

          {/* Session count + last date */}
          <p className="muted" style={{ fontSize: 13, margin: "0 0 16px" }}>
            {currentPhaseSessions.length} session
            {currentPhaseSessions.length !== 1 ? "s" : ""} logged
            {lastSessionDate && (
              <> · last on {formatHumanDate(lastSessionDate)}</>
            )}
          </p>

          {/* Primary CTA */}
          <Link
            to={`/horses/${id}/sessions/new`}
            className="btn btn-leather"
            style={{ marginBottom: 10, display: "inline-flex" }}
          >
            Log today's session
          </Link>

          {/* Secondary CTA: Advance */}
          {nextP && (
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
                          {round1(pt.combinedAverage)}
                        </span>
                      )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 4. Finish training button ── */}
      <div style={{ marginTop: "var(--gap)" }}>
        <Link
          to={`/horses/${id}/finish`}
          className="btn btn-primary"
          style={{ width: "100%", justifyContent: "center" }}
        >
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
            style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}
          >
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
            >
              Archive horse
            </button>
          )}
          {horse.data.status === "complete" && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleReopen}
            >
              Re-open training
            </button>
          )}
          <button
            className="btn btn-danger btn-sm"
            onClick={handleDelete}
          >
            Delete permanently
          </button>
        </div>
      </details>
    </div>
  );
}
