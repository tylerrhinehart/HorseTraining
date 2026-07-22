import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { differenceInCalendarDays, parseISO } from "date-fns";
import {
  getHorse,
  getTrifectaForHorse,
  listSessionsForHorse,
  setHorseStatus,
} from "../supabase/queries";
import { useQuery } from "../supabase/useQuery";
import { qk } from "../supabase/keys";
import TrifectaEvaluation from "../components/TrifectaEvaluation";
import { SkeletonCard } from "../components/Skeleton";
import ErrorState from "../components/ErrorState";
import { useToast } from "../components/Toast";
import { IconRibbon } from "../components/Icons";
import { sessionAverages, formatAvg } from "../utils/stats";

const STEP_LABELS = ["Evaluation", "Report", "Complete"] as const;

function Stepper({
  current,
  onStepClick,
}: {
  current: 1 | 2 | 3;
  onStepClick?: (n: 1 | 2) => void;
}) {
  return (
    <div className="stepper" aria-label={`Step ${current} of 3`}>
      {STEP_LABELS.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const done = n < current;
        const active = n === current;
        const clickable = done && n !== 3 && onStepClick;
        return (
          <button
            key={label}
            type="button"
            className={`stepper-step${done ? " is-done" : ""}${active ? " is-active" : ""}`}
            disabled={!clickable}
            onClick={() => clickable && onStepClick(n as 1 | 2)}
          >
            <span className="stepper-dot">{done ? "✓" : n}</span>
            <span className="stepper-label">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function HorseFinish() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const stepParam = Number(searchParams.get("step") || "1");
  const step: 1 | 2 | 3 = stepParam === 2 ? 2 : stepParam === 3 ? 3 : 1;
  const setStep = (n: 1 | 2 | 3) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("step", String(n));
        return next;
      },
      { replace: false },
    );
  };
  const [marking, setMarking] = useState(false);
  const toast = useToast();

  const horse = useQuery(id ? qk.horse(id) : null, () => getHorse(id!));

  const trifectaQ = useQuery(
    id ? qk.trifecta(id) : null,
    () => getTrifectaForHorse(id!),
  );

  const autoRedirectedRef = useRef(false);
  useEffect(() => {
    if (autoRedirectedRef.current) return;
    if (trifectaQ.loading) return;
    if (!trifectaQ.data) return;
    if (searchParams.get("step") !== null) return;
    autoRedirectedRef.current = true;
    setSearchParams({ step: "2" }, { replace: true });
  }, [trifectaQ.loading, trifectaQ.data, searchParams, setSearchParams]);

  if (!id) return null;

  if (horse.error && horse.data === undefined) {
    return (
      <div className="view">
        <ErrorState error={horse.error} onRetry={horse.refresh} />
      </div>
    );
  }
  if (horse.data === undefined && horse.loading) {
    return (
      <div className="view">
        <SkeletonCard lines={4} />
      </div>
    );
  }
  if (!horse.data) {
    return (
      <div className="view">
        <div className="card">
          Horse not found.{" "}
          <Link to="/" style={{ color: "var(--leather)" }}>
            Back
          </Link>
        </div>
      </div>
    );
  }

  // Guard: step 3 (the "Training complete" screen) is only valid once the
  // horse has actually been marked complete. Direct navigation otherwise
  // bounces back to step 2 so the trainer must explicitly mark complete.
  if (step === 3 && horse.data.status !== "complete") {
    return <Navigate replace to={`/horses/${id}/finish?step=2`} />;
  }

  if (step === 1) {
    return (
      <div className="view">
        <div className="eyebrow">Finish training</div>
        <Stepper current={1} />
        <h1 className="h-display">Final evaluation</h1>
        <p className="muted" style={{ margin: "4px 0 14px", fontSize: 14 }}>
          {horse.data.name} · review and score each item before sharing with
          the owner.
        </p>
        <TrifectaEvaluation horseId={id} onSaved={() => setStep(2)} />
        <div style={{ display: "flex", justifyContent: "flex-start", marginTop: 14 }}>
          <Link to={`/horses/${id}`} className="btn btn-ghost">
            ← Back to horse
          </Link>
        </div>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="view">
        <div className="eyebrow">Finish training</div>
        <Stepper current={2} onStepClick={(n) => setStep(n)} />
        <h1 className="h-display">Report and finalize</h1>
        <p className="muted" style={{ margin: "4px 0 14px", fontSize: 14 }}>
          Open the report in a new tab to review or share, then mark training
          complete when you're ready.
        </p>
        <div className="card" style={{ display: "grid", gap: 10 }}>
          <Link
            to={`/horses/${id}/report`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-leather"
          >
            Open report (PDF)
          </Link>
          <button
            type="button"
            className="btn"
            disabled={marking}
            onClick={async () => {
              setMarking(true);
              try {
                await setHorseStatus(id, "complete");
                toast.success("Training complete");
                setStep(3);
              } catch (e) {
                toast.error((e as Error).message);
              } finally {
                setMarking(false);
              }
            }}
          >
            {marking ? "Marking complete…" : "Mark training complete"}
          </button>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14 }}>
          <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>
            ← Back to evaluation
          </button>
          <Link to={`/horses/${id}`} className="btn btn-ghost">
            Cancel
          </Link>
        </div>
      </div>
    );
  }

  return (
    <CompleteStep
      id={id}
      name={horse.data.name}
      arrival={horse.data.arrival_date}
      scale={horse.data.training_type === "foundation" ? "tqa" : "five"}
      onDone={() => navigate("/")}
    />
  );
}

// The payoff moment — an animated seal plus the journey in numbers.
function CompleteStep({
  id,
  name,
  arrival,
  scale,
  onDone,
}: {
  id: string;
  name: string;
  arrival: string | null;
  scale: "tqa" | "five";
  onDone: () => void;
}) {
  const sessions = useQuery(qk.sessions(id), () => listSessionsForHorse(id));
  const points = sessionAverages(sessions.data ?? []);
  const avgs = points
    .map((p) => p.combinedAverage)
    .filter((v): v is number => v !== null);
  const overallAvg =
    avgs.length > 0 ? avgs.reduce((s, n) => s + n, 0) / avgs.length : null;
  const days = arrival
    ? differenceInCalendarDays(new Date(), parseISO(arrival)) + 1
    : null;

  return (
    <div className="view" style={{ textAlign: "center" }}>
      <div className="eyebrow">Finish training</div>
      <Stepper current={3} />

      <div className="celebrate">
        <span className="celebrate-ring" />
        <span className="celebrate-ring celebrate-ring-2" />
        <span className="celebrate-seal">
          <IconRibbon size={30} strokeWidth={1.6} />
        </span>
      </div>

      <h1 className="h-display" style={{ marginBottom: 6 }}>
        Training complete
      </h1>
      <p className="muted" style={{ margin: "0 0 18px", fontSize: 14 }}>
        {name}'s training is marked complete. You can re-open the evaluation or
        regenerate the report from the horse's page anytime.
      </p>

      <div
        className="today-summary"
        style={{ maxWidth: 560, margin: "0 auto 20px", textAlign: "left" }}
      >
        <div className="summary-tile">
          <span className="lab">Days in training</span>
          <span className="val">{days ?? "—"}</span>
        </div>
        <div className="summary-tile">
          <span className="lab">Sessions logged</span>
          <span className="val">
            {sessions.data === undefined ? "—" : points.length}
          </span>
        </div>
        <div className="summary-tile">
          <span className="lab">Overall average</span>
          <span className="val">{formatAvg(overallAvg, scale)}</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
        <Link to={`/horses/${id}/report`} className="btn">
          View report again
        </Link>
        <button type="button" className="btn btn-leather" onClick={onDone}>
          Back to Today
        </button>
      </div>
    </div>
  );
}
