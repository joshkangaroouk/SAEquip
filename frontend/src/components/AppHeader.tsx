import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

/** Shared header for authenticated pages. */
export function AppHeader() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate("/login", { replace: true });
  }

  return (
    <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
      <Link to="/" className="text-lg font-semibold text-gray-900 hover:text-gray-700">
        SAEquip Product Hub
      </Link>
      <div className="flex items-center gap-4 text-sm">
        <span className="hidden text-gray-500 sm:inline">{user?.email}</span>
        <Link to="/logos" className="text-gray-500 hover:text-gray-900">
          Logos
        </Link>
        <Link to="/media" className="text-gray-500 hover:text-gray-900">
          Media
        </Link>
        <Link to="/status" className="text-gray-500 hover:text-gray-900">
          Status
        </Link>
        <button
          onClick={handleSignOut}
          className="rounded-md border border-gray-300 px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-100"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}

/** Small status badge for product ACTIVE/HIDDEN etc. */
export function StatusBadge({ status }: { status: string }) {
  const active = status === "ACTIVE" || status === "IN_STOCK";
  const cls = active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700";
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}
