import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { createHorse } from "../supabase/queries";
import { useActiveHorseId } from "../state/activeHorse";

interface FormValues {
  name: string;
  owner_name: string;
  owner_contact?: string;
  arrival_date?: string;
  notes?: string;
}

export default function HorseNew() {
  const navigate = useNavigate();
  const [, setActiveId] = useActiveHorseId();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>();

  const onSubmit = async (values: FormValues) => {
    const horse = await createHorse({
      name: values.name,
      owner_name: values.owner_name,
      owner_contact: values.owner_contact || null,
      arrival_date: values.arrival_date || undefined,
      notes: values.notes || null,
    });
    setActiveId(horse.id);
    navigate(`/horses/${horse.id}`);
  };

  return (
    <div className="view" style={{ maxWidth: 720 }}>
      <div className="eyebrow">new horse</div>
      <h1 className="h-display">Add a horse</h1>

      <form className="card" onSubmit={handleSubmit(onSubmit)}>
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
