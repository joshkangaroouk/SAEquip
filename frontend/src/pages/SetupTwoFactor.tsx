import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { supabase } from "../lib/supabase";
import { useForceLightTheme } from "../lib/theme";
import { useSignOut } from "../hooks/useSignOut";
import { AuthShell } from "../components/AuthShell";
import { TotpEnrolment } from "../components/TotpEnrolment";
import { Loader } from "../components/ui";

/**
 * /setup-2fa: an account that MUST have two-factor (every invited user, and
 * the super admin) sets up its authenticator here before the dashboard loads.
 * The route guard sends such an account here, and the API refuses it
 * everything else (`mfa_setup_required`), so there is no way round it.
 *
 * Light only, like the other sign-in pages. Anyone without that requirement
 * is sent on to the dashboard; anyone signed out, to /login.
 */
export default function SetupTwoFactor() {
  useForceLightTheme();
  const { user, loading, mfaSetupPending } = useAuth();
  const navigate = useNavigate();
  const signOut = useSignOut();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <Loader label="Loading…" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!mfaSetupPending) return <Navigate to="/" replace />;

  return (
    <AuthShell
      title="Set up two-factor"
      description="Your account needs a 6-digit code from an app on your phone each time you sign in, as well as your password. It takes a minute."
    >
      <p className="t-help mt-3">
        Signed in as <span className="font-semibold text-text">{user.email}</span>
      </p>
      <TotpEnrolment
        className="mt-6"
        idleSteps
        startLabel="Start"
        onEnrolled={async () => {
          // A fresh session carries the new factor, so the guard lets it through.
          await supabase.auth.refreshSession();
          navigate("/", { replace: true });
        }}
      />
      <p className="t-help mt-6 border-t border-border pt-4">
        Not you, or doing this later?{" "}
        <button type="button" onClick={() => void signOut()} className="font-semibold text-text underline underline-offset-2">
          Sign out
        </button>
      </p>
    </AuthShell>
  );
}
