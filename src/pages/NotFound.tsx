import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="view" style={{ textAlign: "center" }}>
      <div className="eyebrow">404</div>
      <h1 className="h-display">Page not found</h1>
      <p className="muted" style={{ marginBottom: 16 }}>
        The page you're looking for doesn't exist.
      </p>
      <Link to="/" className="btn btn-leather">
        Back to today
      </Link>
    </div>
  );
}
