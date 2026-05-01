import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { createHorse, listPhases } from "../supabase/queries";
import { useQuery } from "../supabase/useQuery";
import { todayLocal } from "../utils/dates";

interface FormValues {
  name: string;
  breed?: string;
  ownerName?: string;
  ownerEmail?: string;
  startDate?: string;
  notes?: string;
  currentPhaseId?: string;
}

export default function HorseNew() {
  const navigate = useNavigate();
  const phases = useQuery(() => listPhases(), []);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      startDate: todayLocal(),
    },
  });

  const onSubmit = async (values: FormValues) => {
    const horse = await createHorse({
      name: values.name,
      breed: values.breed,
      ownerName: values.ownerName,
      ownerEmail: values.ownerEmail,
      startDate: values.startDate || undefined,
      notes: values.notes,
      currentPhaseId: values.currentPhaseId || undefined,
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
            <label htmlFor="currentPhaseId" className="label">
              Starting phase
            </label>
            <select
              id="currentPhaseId"
              className="input"
              {...register("currentPhaseId")}
              defaultValue=""
            >
              <option value="">
                {phases.loading
                  ? "Loading phases…"
                  : "Default (Foundation)"}
              </option>
              {phases.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="ownerName" className="label">Owner name</label>
            <input
              id="ownerName"
              className="input"
              {...register("ownerName")}
            />
          </div>
          <div>
            <label htmlFor="ownerEmail" className="label">Owner email</label>
            <input
              id="ownerEmail"
              type="email"
              className="input"
              {...register("ownerEmail")}
            />
          </div>
        </div>

        <div>
          <label htmlFor="startDate" className="label">
            Training start date
          </label>
          <input
            id="startDate"
            type="date"
            className="input"
            {...register("startDate")}
          />
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
