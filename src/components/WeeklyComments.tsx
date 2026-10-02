import { useEffect, useRef, useState } from "react";
import { format, startOfWeek } from "date-fns";
import type { Horse } from "../supabase/types";
import { updateHorse } from "../supabase/queries";

export default function WeeklyComments({ horse }: { horse: Horse }) {
  const [week, setWeek] = useState(() => format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"));
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const dirty = useRef(false);
  useEffect(() => { dirty.current = false; setComment(horse.program_meta?.weekly_comments?.[week] ?? ""); setFeedback(""); }, [horse.id, week]);
  useEffect(() => { if (!dirty.current) setComment(horse.program_meta?.weekly_comments?.[week] ?? ""); }, [horse.program_meta, week]);
  return <section className="card" style={{ marginTop: "var(--gap)" }}>
    <h2 className="card-title">Weekly comments</h2>
    <label className="label" htmlFor="comments-week">Week beginning</label>
    <input id="comments-week" type="date" className="input" value={week} onChange={(e) => setWeek(e.target.value)} />
    <label className="label" htmlFor="weekly-comments" style={{ marginTop: 10 }}>Comments for {horse.name}</label>
    <textarea id="weekly-comments" className="input" rows={3} value={comment} onChange={(e) => { dirty.current = true; setComment(e.target.value); }} />
    <button className="btn btn-leather btn-sm" disabled={saving || !week} onClick={async () => {
      setSaving(true); setFeedback("");
      try {
        const weekly_comments = { ...horse.program_meta?.weekly_comments };
        if (comment.trim()) weekly_comments[week] = comment.trim(); else delete weekly_comments[week];
        await updateHorse(horse.id, { program_meta: { ...horse.program_meta, weekly_comments } });
        dirty.current = false; setFeedback("Weekly comments saved");
      } catch (error) { setFeedback((error as Error).message); }
      finally { setSaving(false); }
    }}>{saving ? "Saving…" : "Save weekly comments"}</button>
    {feedback && <p role="status">{feedback}</p>}
  </section>;
}
