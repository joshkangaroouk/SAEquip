import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { reportActivity } from "../lib/activity";
import { sessionNeedsMfaSetup, sessionNeedsSecondFactor, verifyTotpCode } from "../lib/mfa";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  /**
   * Signed in, but the second factor is still owed. ⚠️ Derived from the
   * session, not remembered by the login page: a reload during the code step
   * used to lose that page's state, send the user to a dashboard the API
   * refuses, and bounce /login straight back to it.
   */
  mfaPending: boolean;
  /**
   * Signed in, but the account must set up two-factor first (invited users,
   * the super admin): /setup-2fa, and nothing else, until it is done.
   */
  mfaSetupPending: boolean;
  /**
   * The super admin role, from app_metadata (only the service role writes it).
   * Display-only: the server checks it, and a 2FA session, on every admin route.
   */
  isSuperAdmin: boolean;
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ error: string | null; mfaRequired: boolean }>;
  verifyMfa: (code: string) => Promise<{ error: string | null }>;
  /** `error` when Supabase could not be reached: the session is then still here. */
  signOut: () => Promise<{ error: string | null }>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Supabase's sign-in refusals in the Hub's words. A disabled account used to
 * see Supabase's raw "User is banned" (USERS-AUDIT L16).
 */
function signInErrorWords(error: { code?: string; message: string; status?: number }): string {
  switch (error.code) {
    case "user_banned":
      return "This account has been disabled. Ask the Hub's administrator if you think that's a mistake.";
    case "invalid_credentials":
      return "That email and password don't match an account.";
    case "over_request_rate_limit":
      return "Too many sign-in attempts. Wait a few minutes and try again.";
    default:
      return error.status === 429 ? "Too many sign-in attempts. Wait a few minutes and try again." : error.message;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Restore any existing session on load.
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
      /*
       * ⚠️ A stored session that says a code or a set-up is owed may be out of
       * date: the super admin can turn someone's two-factor off (or a
       * requirement may have changed) while this browser holds the old copy,
       * and it would keep them on the code step or /setup-2fa. Refresh it
       * once; onAuthStateChange delivers the server's current account. Only
       * these sessions pay for the round trip, and a refused refresh signs
       * out as usual.
       */
      if (data.session && (sessionNeedsSecondFactor(data.session) || sessionNeedsMfaSetup(data.session))) {
        void supabase.auth.refreshSession();
      }
    });

    // Keep in sync with sign-in / sign-out / token refresh.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  /**
   * Password sign-in. Resolves with `mfaRequired` when the account has a
   * verified factor, so the caller can collect a code before treating the user
   * as signed in.
   *
   * ⚠️ The session that exists at this point is real but `aal1`, and the API
   * rejects it with `mfa_required` (see requireAuth). So "signed in" is not
   * the same as "usable" for these accounts — the challenge is not cosmetic,
   * and skipping it leaves the dashboard authenticated but unable to load
   * anything.
   */
  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: signInErrorWords(error), mfaRequired: false };

    const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalError) return { error: aalError.message, mfaRequired: false };

    // nextLevel is aal2 only when a verified factor exists.
    const mfaRequired = aal.nextLevel === "aal2" && aal.currentLevel !== "aal2";
    return { error: null, mfaRequired };
  }

  /**
   * Complete the second factor with a TOTP code from ANY of the user's
   * authenticators — see verifyTotpCode() for why not just the first.
   */
  function verifyMfa(code: string): Promise<{ error: string | null }> {
    return verifyTotpCode(code);
  }

  /**
   * ⚠️ LOCAL scope: this device only (USERS-AUDIT M6). supabase-js defaults to
   * GLOBAL, so signing out of a laptop also revoked the phone, whose dashboard
   * then failed every request. The local scope still revokes THIS session on
   * the server. /reset-password signs out globally on purpose.
   *
   * ⚠️ supabase-js keeps the session when it cannot reach Supabase (network,
   * 5xx, 429), so the error is returned for the caller to say so; going to
   * /login regardless bounced straight back to the dashboard, silently.
   */
  async function signOut(): Promise<{ error: string | null }> {
    // Before the session goes: the report needs its token (lib/activity.ts).
    // Not from a session that still owes its code or its set-up: the API
    // refuses those, and the refusal was logged instead of the sign-out.
    if (session && !sessionNeedsSecondFactor(session) && !sessionNeedsMfaSetup(session)) {
      await reportActivity("auth.sign_out");
    }
    const { error } = await supabase.auth.signOut({ scope: "local" });
    return { error: error ? "Couldn't reach the sign-in service, so you're still signed in. Check your connection and try again." : null };
  }

  const value: AuthContextValue = {
    user: session?.user ?? null,
    session,
    loading,
    mfaPending: sessionNeedsSecondFactor(session),
    mfaSetupPending: sessionNeedsMfaSetup(session),
    isSuperAdmin: (session?.user.app_metadata as { role?: unknown } | undefined)?.role === "super_admin",
    signIn,
    verifyMfa,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
