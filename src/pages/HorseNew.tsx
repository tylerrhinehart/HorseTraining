import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { createHorse } from "../supabase/queries";
import { useActiveHorseId } from "../state/activeHorse";

interface FormValues {
  name: string;
  breed?: string;
  dob?: string;
  sex?: string;
  color?: string;
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
      breed: values.breed,
      dob: values.dob || undefined,
      sex: values.sex,
      color: values.color,
      notes: values.notes,
    });
    setActiveId(horse.id);
    navigate(`/horses/${horse.id}`);
  };

  return (
    <div className="view" style={{ maxWidth: 720 }}>
      <div className="eyebrow">New registration</div>
      <h1 className="h-display">Register a horse</h1>

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
            <label htmlFor="breed" className="label">
              Breed
            </label>
            <input
              id="breed"
              className="input"
              placeholder="AQHA Quarter Horse"
              {...register("breed")}
            />
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="color" className="label">
              Color
            </label>
            <input id="color" className="input" {...register("color")} />
          </div>
          <div className="field">
            <label htmlFor="sex" className="label">
              Sex
            </label>
            <select
              id="sex"
              className="input"
              defaultValue=""
              {...register("sex")}
            >
              <option value="">—</option>
              <option value="mare">Mare</option>
              <option value="gelding">Gelding</option>
              <option value="stallion">Stallion</option>
              <option value="filly">Filly</option>
              <option value="colt">Colt</option>
            </select>
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="dob" className="label">
              Date of birth
            </label>
            <input
              id="dob"
              type="date"
              className="input"
              {...register("dob")}
            />
          </div>
          <div className="field" />
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
