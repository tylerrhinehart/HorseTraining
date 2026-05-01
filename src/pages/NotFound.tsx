import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="card text-center">
      <h1 className="text-2xl font-semibold mb-2">Page not found</h1>
      <p className="text-slate-400 mb-4">
        The page you're looking for doesn't exist.
      </p>
      <Link to="/" className="btn-primary">
        Back to dashboard
      </Link>
    </div>
  );
}
