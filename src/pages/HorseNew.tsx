import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { createHorse } from "../db/queries";
import { todayLocal } from "../utils/dates";

interface FormValues {
  name: string;
  breed?: string;
  ownerName?: string;
  ownerEmail?: string;
  startDate: string;
  durationDays: number;
  notes?: string;
}

export default function HorseNew() {
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      startDate: todayLocal(),
      durationDays: 20,
    },
  });

  const onSubmit = async (values: FormValues) => {
    const horse = await createHorse({
      ...values,
      durationDays: Number(values.durationDays) || 20,
    });
    navigate(`/horses/${horse.id}`);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-semibold">Register horse</h1>
      <form className="card space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label htmlFor="name" className="label">
            Horse name *
          </label>
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
            <label htmlFor="breed" className="label">
              Breed
            </label>
            <input id="breed" className="input" {...register("breed")} />
          </div>
          <div>
            <label htmlFor="ownerName" className="label">
              Owner name
            </label>
            <input
              id="ownerName"
              className="input"
              {...register("ownerName")}
            />
          </div>
        </div>

        <div>
          <label htmlFor="ownerEmail" className="label">
            Owner email
          </label>
          <input
            id="ownerEmail"
            type="email"
            className="input"
            {...register("ownerEmail")}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="startDate" className="label">
              Start date *
            </label>
            <input
              id="startDate"
              type="date"
              className="input"
              {...register("startDate", { required: true })}
            />
          </div>
          <div>
            <label htmlFor="durationDays" className="label">
              Duration (days)
            </label>
            <input
              id="durationDays"
              type="number"
              min={1}
              max={365}
              className="input"
              {...register("durationDays", { valueAsNumber: true, min: 1 })}
            />
          </div>
        </div>

        <div>
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
