import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { createEngagement, getHorse } from "../supabase/queries";
import { useQuery } from "../supabase/useQuery";
import { TOTAL_WEEKS } from "../content/timeline";
import { todayLocal } from "../utils/dates";

interface FormValues {
  ownerName?: string;
  ownerInfo?: string;
  ownerEmail?: string;
  paymentMethod?: string;
  paymentAmount?: string;
  arrivalDate?: string;
  departureDate?: string;
  notes?: string;
  initialWeeks: number;
}

export default function EngagementNew() {
  const { id: horseId } = useParams();
  const navigate = useNavigate();
  const horse = useQuery(
    () => (horseId ? getHorse(horseId) : Promise.resolve(null)),
    [horseId],
  );

  const {
    register,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm<FormValues>({
    defaultValues: {
      arrivalDate: todayLocal(),
      initialWeeks: TOTAL_WEEKS,
    },
  });

  if (!horseId) return null;
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
        <div className="card">Horse not found.</div>
      </div>
    );
  }

  const onSubmit = async (values: FormValues) => {
    const engagement = await createEngagement({
      horseId,
      ownerName: values.ownerName,
      ownerInfo: values.ownerInfo,
      ownerEmail: values.ownerEmail,
      paymentMethod: values.paymentMethod,
      paymentAmount: values.paymentAmount
        ? Number(values.paymentAmount)
        : null,
      arrivalDate: values.arrivalDate || undefined,
      departureDate: values.departureDate || undefined,
      notes: values.notes,
      initialWeeks: Number(values.initialWeeks) || 0,
    });
    navigate(`/engagements/${engagement.id}`);
  };

  return (
    <div className="view" style={{ maxWidth: 720 }}>
      <div className="eyebrow">New engagement</div>
      <h1 className="h-display">{horse.data.name}</h1>
      <p className="muted" style={{ marginBottom: 14, fontSize: 14, maxWidth: 540 }}>
        TQA's published timeline is {TOTAL_WEEKS} weeks (Groundwork + Phase 1
        through Phase 4, two weeks each).
      </p>

      <form className="card" onSubmit={handleSubmit(onSubmit)}>
        <div className="field-row">
          <div className="field">
            <label htmlFor="ownerName" className="label">
              Owner name
            </label>
            <input id="ownerName" className="input" {...register("ownerName")} />
          </div>
          <div className="field">
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
        </div>

        <div className="field" style={{ marginBottom: 12 }}>
          <label htmlFor="ownerInfo" className="label">
            Owner info / address
          </label>
          <textarea
            id="ownerInfo"
            rows={2}
            className="input"
            {...register("ownerInfo")}
          />
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="arrivalDate" className="label">
              Arrival date
            </label>
            <input
              id="arrivalDate"
              type="date"
              className="input"
              {...register("arrivalDate")}
            />
          </div>
          <div className="field">
            <label htmlFor="departureDate" className="label">
              Expected departure
            </label>
            <input
              id="departureDate"
              type="date"
              className="input"
              {...register("departureDate")}
            />
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="paymentAmount" className="label">
              Payment amount ($)
            </label>
            <input
              id="paymentAmount"
              type="number"
              step="0.01"
              className="input"
              {...register("paymentAmount")}
            />
          </div>
          <div className="field">
            <label htmlFor="paymentMethod" className="label">
              Payment method
            </label>
            <input
              id="paymentMethod"
              className="input"
              {...register("paymentMethod")}
            />
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="initialWeeks" className="label">
              Initial week count
            </label>
            <input
              id="initialWeeks"
              type="number"
              min={0}
              max={26}
              className="input"
              {...register("initialWeeks", {
                valueAsNumber: true,
                min: { value: 0, message: "Must be 0 or greater" },
              })}
            />
            {errors.initialWeeks && (
              <p style={{ color: "var(--bad)", fontSize: 12, marginTop: 4 }}>
                {errors.initialWeeks.message}
              </p>
            )}
          </div>
          <div className="field" />
        </div>

        <div className="field" style={{ marginBottom: 12 }}>
          <label htmlFor="notes" className="label">
            Notes
          </label>
          <textarea
            id="notes"
            rows={2}
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
            {isSubmitting ? "Saving…" : "Start engagement"}
          </button>
        </div>
      </form>
    </div>
  );
}
