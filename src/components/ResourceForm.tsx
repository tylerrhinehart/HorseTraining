import { useState } from "react";
import { createResource } from "../supabase/queries";
import type { ResourceKind } from "../supabase/types";

interface Props {
  phaseId?: string;
  questionId?: string;
  onCreated: () => void;
}

const YOUTUBE_PATTERN =
  /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)/i;

function detectKind(url: string): ResourceKind {
  return YOUTUBE_PATTERN.test(url) ? "youtube" : "link";
}

export default function ResourceForm({ phaseId, questionId, onCreated }: Props) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!title.trim() || !url.trim()) return;
    setBusy(true);
    try {
      await createResource({
        phaseId,
        questionId,
        title,
        url,
        kind: detectKind(url),
      });
      setTitle("");
      setUrl("");
      onCreated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card grid gap-2 md:grid-cols-[1fr_2fr_auto]">
      <input
        className="input"
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <input
        className="input"
        placeholder="URL (YouTube link or any URL)"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <button className="btn-primary" type="submit" disabled={busy}>
        {busy ? "Adding…" : "Add"}
      </button>
      {error && (
        <p className="text-sm text-red-400 md:col-span-3">{error}</p>
      )}
    </form>
  );
}
