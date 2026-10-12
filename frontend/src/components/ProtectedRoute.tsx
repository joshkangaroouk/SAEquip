import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

/**
 * Renders children only when authenticated — and, for an account with 2FA,
 * only once the code has been entered. Otherwise /login, which shows whichever
 * step is outstanding.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading, mfaPending } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted">
        Loading…
      </div>
    );
  }

  if (!user || mfaPending) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
