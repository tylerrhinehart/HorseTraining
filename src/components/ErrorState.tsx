export default function ErrorState({
  error,
  onRetry,
}: {
  error?: Error | null;
  onRetry: () => void;
}) {
  const message = !navigator.onLine
    ? "You appear to be offline. Check your connection and try again."
    : error?.message ?? "The request failed.";

  return (
    <div className="card">
      <h3 style={{ fontFamily: "var(--font-display)", margin: "0 0 8px" }}>
        Something went wrong
      </h3>
      <p style={{ margin: "0 0 16px", color: "var(--muted)", fontSize: 14 }}>
        {message}
      </p>
      <button className="btn" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}
