import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { createHorse } from "../supabase/queries";

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
    navigate(`/horses/${horse.id}`);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-semibold">Register horse</h1>
      <form className="card space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label htmlFor="name" className="label">Horse name *</label>
          <input
            id="name"
            className="input"
            {...register("name", { required: "Name is required" })}
          />
          {errors.name && (
            <p className="text-red-400 text-sm mt-1">{errors.name.message}</p>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="breed" className="label">Breed</label>
            <input id="breed" className="input" {...register("breed")} />
          </div>
          <div>
            <label htmlFor="color" className="label">Color</label>
            <input id="color" className="input" {...register("color")} />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="dob" className="label">Date of birth</label>
            <input
              id="dob"
              type="date"
              className="input"
              {...register("dob")}
            />
          </div>
          <div>
            <label htmlFor="sex" className="label">Sex</label>
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

        <div>
          <label htmlFor="notes" className="label">Notes</label>
          <textarea
            id="notes"
            rows={3}
            className="input"
            {...register("notes")}
          />
        </div>

        <div className="flex gap-2 justify-end">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => navigate(-1)}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving…" : "Register"}
          </button>
        </div>
      </form>
    </div>
  );
}
