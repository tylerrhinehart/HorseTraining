import type { UseFormRegister } from "react-hook-form";
import { TASK_COMPLETION_GROUPS } from "../content/programs";
import type { ProgramMeta, TrainingType } from "../supabase/types";

export interface HorseProgramForm {
  training_type: TrainingType;
  foundation_subtype?: string;
  training_goals?: string[];
  departure_date?: string;
  payment_method?: string;
  payment_amount?: string;
  sale_date?: string;
  estimated_rides?: string;
  purchase_price?: string;
  target_market?: string;
  price_low?: string;
  price_high?: string;
}

export function programFormDefaults(meta: ProgramMeta = {}): Partial<HorseProgramForm> {
  return {
    foundation_subtype: meta.foundation_subtype ?? "",
    training_goals: meta.training_goals ?? [],
    departure_date: meta.departure_date ?? "",
    payment_method: meta.payment_method ?? "",
    payment_amount: meta.payment_amount?.toString() ?? "",
    sale_date: meta.sale_date ?? "",
    estimated_rides: meta.estimated_rides?.toString() ?? "",
    purchase_price: meta.purchase_price?.toString() ?? "",
    target_market: meta.target_market ?? "",
    price_low: meta.price_low?.toString() ?? "",
    price_high: meta.price_high?.toString() ?? "",
  };
}

export function programMetaFromForm(values: HorseProgramForm, existing: ProgramMeta = {}): ProgramMeta {
  // Preserve weekly notes, unknown future metadata and dormant program fields.
  const meta = { ...existing };
  const text = ["foundation_subtype", "departure_date", "payment_method", "sale_date", "target_market"] as const;
  for (const key of text) {
    if (values[key] === undefined) continue;
    const value = values[key]?.trim();
    if (value) (meta as Record<string, unknown>)[key] = value;
    else delete meta[key];
  }
  for (const key of ["payment_amount", "estimated_rides", "purchase_price", "price_low", "price_high"] as const) {
    if (values[key] === undefined) continue;
    if (values[key] === "") { delete meta[key]; continue; }
    const value = Number(values[key]);
    if (!Number.isFinite(value) || value < 0 || (key === "estimated_rides" && !Number.isInteger(value))) throw new Error("Enter valid non-negative amounts and a whole number of estimated rides.");
    meta[key] = value;
  }
  if (values.training_goals !== undefined) meta.training_goals = [...new Set(Array.isArray(values.training_goals) ? values.training_goals : [])];
  if (meta.price_low !== undefined && meta.price_high !== undefined && meta.price_low > meta.price_high) throw new Error("The low target price must not exceed the high price.");
  return meta;
}

export default function HorseProgramFields({ register, trainingType, prefix }: {
  register: UseFormRegister<HorseProgramForm>;
  trainingType: TrainingType;
  prefix: string;
}) {
  const field = (name: keyof HorseProgramForm, label: string, type = "text") => <div className="field" key={name}>
    <label className="label" htmlFor={`${prefix}-${name}`}>{label}</label>
    <input id={`${prefix}-${name}`} type={type} min={type === "number" ? 0 : undefined} step={name === "estimated_rides" ? 1 : type === "number" ? "0.01" : undefined} className="input" {...register(name)} />
  </div>;
  return <>
    {trainingType === "foundation" && <div className="field" style={{ marginBottom: 12 }}>
      <label className="label" htmlFor={`${prefix}-foundation-subtype`}>Foundation training</label>
      <select id={`${prefix}-foundation-subtype`} className="input" {...register("foundation_subtype")}>
        <option value="">Not specified</option><option value="colt_starting">Colt Starting</option><option value="tune_up">Foundation Tune-Up</option>
      </select>
    </div>}
    <details className="card"><summary>Training goals (optional)</summary>
    <fieldset style={{ border: "1px solid var(--line)", padding: 12, borderRadius: 8, margin: "12px 0" }}>
      <legend className="label">Owner / client training goals</legend>
      <p className="muted" style={{ fontSize: 12 }}>Select any combination. Goals guide the work; each ride can record different tasks and phases.</p>
      <div className="field-row">{TASK_COMPLETION_GROUPS.map((group) => <div key={group.name}>
        <strong>{group.name}</strong>
        {group.jobs.map((job) => <label key={job.code} style={{ display: "flex", gap: 8, padding: "8px 0", alignItems: "center" }}>
          <input type="checkbox" value={job.code} {...register("training_goals")} />{job.name}
        </label>)}
      </div>)}</div>
    </fieldset></details>
    <details className="card"><summary>Dates and payment details (optional)</summary>
    <div className="field-row">{field("departure_date", "Departure date", "date")}</div>
    {trainingType === "sale_horse" ? <>
      <p className="muted" style={{ fontSize: 12 }}>Sale Horse: training toward a future buyer. The owner pays feed and board.</p>
      <div className="field-row">{field("sale_date", "Expected sale date", "date")}{field("estimated_rides", "Estimated rides needed", "number")}{field("purchase_price", "Purchase price", "number")}</div>
    </> : <>
      <p className="muted" style={{ fontSize: 12 }}>Client-owned training: monthly training fee plus feed and board.</p>
      <div className="field-row">{field("payment_method", "Payment method")}{field("payment_amount", "Payment amount", "number")}</div>
    </>}
    </details>
  </>;
}
