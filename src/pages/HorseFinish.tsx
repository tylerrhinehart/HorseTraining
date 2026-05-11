import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getHorse, getTrifectaForHorse, setHorseStatus } from "../supabase/queries";
import { useQuery } from "../supabase/useQuery";
import TrifectaEvaluation from "../components/TrifectaEvaluation";

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

  const horse = useQuery(
    () => (id ? getHorse(id) : Promise.resolve(null)),
    [id],
  );

  const trifectaQ = useQuery(
    () => (id ? getTrifectaForHorse(id) : Promise.resolve(null)),
    [id],
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

  if (horse.loading) {
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
          <Link to="/" style={{ color: "var(--leather)" }}>
            Back
          </Link>
        </div>
      </div>
    );
  }

  if (step === 1) {
    return (
      <div className="view">
        <div className="eyebrow">Finish training · Step 1 of 3</div>
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
        <div className="eyebrow">Finish training · Step 2 of 3</div>
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
                setStep(3);
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
    <div className="view" style={{ textAlign: "center" }}>
      <div className="eyebrow">Finish training · Step 3 of 3</div>
      <h1 className="h-display">Training complete</h1>
      <p className="muted" style={{ margin: "12px 0", fontSize: 14 }}>
        {horse.data.name}'s training is marked complete. You can re-open the
        evaluation or regenerate the report from the horse's page anytime.
      </p>
      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
        <Link to={`/horses/${id}/report`} className="btn">
          View report again
        </Link>
        <button type="button" className="btn btn-leather" onClick={() => navigate("/")}>
          Back to Today
        </button>
      </div>
    </div>
  );
}
