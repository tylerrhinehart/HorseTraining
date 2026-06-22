import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { createHorse } from "../supabase/queries";
import { useActiveHorseId } from "../state/activeHorse";
import { PROGRAMS } from "../content/programs";
import type { ProgramMeta, TrainingType } from "../supabase/types";

interface FormValues {
  name: string;
  owner_name: string;
  owner_contact?: string;
  arrival_date?: string;
  notes?: string;
  training_type: TrainingType;
  target_market?: string;
  price_low?: string;
  price_high?: string;
}

export default function HorseNew() {
  const navigate = useNavigate();
  const [, setActiveId] = useActiveHorseId();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ defaultValues: { training_type: "foundation" } });

  const trainingType = watch("training_type");

  const onSubmit = async (values: FormValues) => {
    const program_meta: ProgramMeta = {};
    if (values.training_type === "sale_horse") {
      if (values.target_market?.trim())
        program_meta.target_market = values.target_market.trim();
      if (values.price_low) program_meta.price_low = Number(values.price_low);
      if (values.price_high) program_meta.price_high = Number(values.price_high);
    }
    const horse = await createHorse({
      name: values.name,
      owner_name: values.owner_name,
      owner_contact: values.owner_contact || null,
      arrival_date: values.arrival_date || undefined,
      notes: values.notes || null,
      training_type: values.training_type,
      program_meta,
    });
    setActiveId(horse.id);
    navigate(`/horses/${horse.id}`);
  };

  return (
    <div className="view" style={{ maxWidth: 720 }}>
      <div className="eyebrow">new horse</div>
      <h1 className="h-display">Add a horse</h1>

      <form className="card" onSubmit={handleSubmit(onSubmit)}>
        <div className="field" style={{ marginBottom: 14 }}>
          <label className="label">Type of training *</label>
          <div
            style={{
              display: "grid",
              gap: 8,
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              marginTop: 4,
            }}
          >
            {PROGRAMS.map((p) => {
              const selected = trainingType === p.id;
              return (
                <label
                  key={p.id}
                  className="card"
                  style={{
                    cursor: "pointer",
                    margin: 0,
                    padding: 12,
                    borderColor: selected ? "var(--leather)" : "var(--line)",
                    background: selected ? "var(--paper-2)" : "transparent",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="radio"
                      value={p.id}
                      {...register("training_type", { required: true })}
                    />
                    <span style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>
                      {p.label}
                    </span>
                  </div>
                  <p className="mono muted" style={{ margin: "4px 0 0", fontSize: 11 }}>
                    {p.tagline}
                  </p>
                </label>
              );
            })}
          </div>
          <p className="muted" style={{ margin: "6px 0 0", fontSize: 12 }}>
            {PROGRAMS.find((p) => p.id === trainingType)?.description}
          </p>
        </div>

        {trainingType === "sale_horse" && (
          <div className="field-row">
            <div className="field">
              <label htmlFor="target_market" className="label">
                Target market
              </label>
              <input
                id="target_market"
                className="input"
                placeholder="e.g. All-around performance prospect"
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
            <label htmlFor="name" className="label">
              Horse name *
            </label>
            <input
              id="name"
              className="input"
              placeholder="e.g. Whiskey Pete"
              {...register("name", { required: "Name is required" })}
            />
            {errors.name && (
              <p style={{ color: "var(--bad)", fontSize: 12, marginTop: 4 }}>
                {errors.name.message}
              </p>
            )}
          </div>
          <div className="field">
            <label htmlFor="owner_name" className="label">
              Owner name *
            </label>
            <input
              id="owner_name"
              className="input"
              placeholder="e.g. Jane Smith"
              {...register("owner_name", { required: "Owner name is required" })}
            />
            {errors.owner_name && (
              <p style={{ color: "var(--bad)", fontSize: 12, marginTop: 4 }}>
                {errors.owner_name.message}
              </p>
            )}
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="owner_contact" className="label">
              Owner contact
            </label>
            <input
              id="owner_contact"
              className="input"
              placeholder="Phone, email, or address"
              {...register("owner_contact")}
            />
          </div>
          <div className="field">
            <label htmlFor="arrival_date" className="label">
              Arrival date
            </label>
            <input
              id="arrival_date"
              type="date"
              className="input"
              {...register("arrival_date")}
            />
          </div>
        </div>

        <div className="field" style={{ marginBottom: 12 }}>
          <label htmlFor="notes" className="label">
            Notes
          </label>
          <textarea
            id="notes"
            rows={3}
            className="input"
            {...register("notes")}
          />
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            marginTop: 4,
          }}
        >
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => navigate(-1)}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-leather"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving…" : "Add horse"}
          </button>
        </div>
      </form>
    </div>
  );
}
