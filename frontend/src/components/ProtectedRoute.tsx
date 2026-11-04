import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Loader } from "./ui";

/**
 * Renders children only when authenticated — and, for an account with 2FA,
 * only once the code has been entered. Otherwise /login, which shows whichever
 * step is outstanding.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading, mfaPending } = useAuth();

  // Before the shell exists: the page background (light or dark, as the
  // pre-paint script set it) and the shared Loader, announced politely.
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <Loader label="Loading…" />
      </div>
    );
  }

  if (!user || mfaPending) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
