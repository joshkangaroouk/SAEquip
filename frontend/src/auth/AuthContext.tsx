import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ error: string | null; mfaRequired: boolean }>;
  verifyMfa: (code: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

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
    if (error) return { error: error.message, mfaRequired: false };

    const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalError) return { error: aalError.message, mfaRequired: false };

    // nextLevel is aal2 only when a verified factor exists.
    const mfaRequired = aal.nextLevel === "aal2" && aal.currentLevel !== "aal2";
    return { error: null, mfaRequired };
  }

  /** Complete the second factor with a TOTP code from the user's app. */
  async function verifyMfa(code: string): Promise<{ error: string | null }> {
    const { data: list, error: listError } = await supabase.auth.mfa.listFactors();
    if (listError) return { error: listError.message };
    const factor = (list.totp ?? []).find((f) => f.status === "verified");
    if (!factor) return { error: "No confirmed authenticator on this account." };

    const challenge = await supabase.auth.mfa.challenge({ factorId: factor.id });
    if (challenge.error) return { error: challenge.error.message };

    const { error } = await supabase.auth.mfa.verify({
      factorId: factor.id,
      challengeId: challenge.data.id,
      code: code.trim(),
    });
    return { error: error ? error.message : null };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  const value: AuthContextValue = {
    user: session?.user ?? null,
    session,
    loading,
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
