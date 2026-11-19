import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_BASE } from "../lib/api";
import { supabase } from "../lib/supabase";
import { useForceLightTheme } from "../lib/theme";
import { assessPassword } from "../lib/passwordPolicy";
import { formatDateTime } from "../lib/format";
import { TWO_FACTOR_ON } from "../lib/twoFactor";
import { AuthShell } from "../components/AuthShell";
import { Alert, Button, Field, Input, Loader } from "../components/ui";

type LinkState = "checking" | "ready" | "invalid" | "expired" | "used" | "revoked" | "error";

const LINK_PROBLEM: Record<Exclude<LinkState, "checking" | "ready">, string> = {
  invalid: "This invite link isn't valid. Check you copied all of it, or ask the person who sent it for a new one.",
  expired: "This invite has expired: links last 5 hours. Ask the person who sent it for a new one.",
  used: "This invite has already been used. If that was you, sign in.",
  revoked: "This invite was cancelled. Ask the person who sent it for a new one.",
  error: "Something went wrong checking your link. Try again in a moment.",
};

/**
 * The token for THIS tab, so a reload or a failed check can try again
 * (USERS-AUDIT L11). It used to live only in memory once it was taken off the
 * address bar, so a reload during the form said "This invite link isn't
 * valid". `sessionStorage` is per tab, never sent anywhere, and gone when the
 * tab closes; it is cleared as soon as the link is used or found dead.
 */
const TOKEN_KEY = "hub-invite-token";
function storedToken(): string {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}
function storeToken(token: string | null) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage blocked: a reload will need the link again */
  }
}

async function post(path: string, body: unknown) {
  const res = await fetch(`${API_BASE}/api/accept-invite${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

/**
 * /invite#t=<token>: create the account an invite is for. Outside the auth
 * guard (there is no account yet), light only like the other sign-in pages.
 *
 * - The token is in the URL FRAGMENT, which is never sent to a server, and is
 *   taken off the address bar as soon as the page has read it. It is only
 *   redeemed by Create account, so a chat app's link preview cannot use it up.
 * - The email comes from the invite and cannot be changed: the server ignores
 *   anything but the token, the name and the password.
 * - Once the account exists the page signs in with it and goes to /setup-2fa:
 *   an invited account can do nothing until two-factor is set up. While
 *   two-factor is off for the Hub (lib/twoFactor.ts) it goes to the dashboard.
 */
export default function AcceptInvite() {
  useForceLightTheme();
  const navigate = useNavigate();
  const [token] = useState(() => {
    const fromLink = new URLSearchParams(window.location.hash.slice(1)).get("t") ?? "";
    if (fromLink) storeToken(fromLink);
    return fromLink || storedToken();
  });
  const [state, setState] = useState<LinkState>("checking");
  /** Bumped by "Try again" to re-run the check after a temporary failure. */
  const [attempt, setAttempt] = useState(0);
  const [invite, setInvite] = useState<{ email: string; expiresAt: string } | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);

  useEffect(() => {
    // Off the address bar (and so out of history and screenshots) at once.
    if (window.location.hash) window.history.replaceState(null, "", window.location.pathname);
    if (!token) {
      setState("invalid");
      return;
    }
    let cancelled = false;
    setState("checking");
    post("/check", { token })
      .then(({ status, json }) => {
        if (cancelled) return;
        if (status === 200) {
          setInvite({ email: String(json.email), expiresAt: String(json.expiresAt) });
          setState("ready");
        } else if (status === 410 && (json.error === "expired" || json.error === "used" || json.error === "revoked")) {
          storeToken(null);
          setState(json.error);
        } else if (status === 404) {
          storeToken(null);
          setState("invalid");
        } else setState("error"); // 429, 5xx: worth another go, so the token is kept
      })
      .catch(() => !cancelled && setState("error"));
    return () => {
      cancelled = true;
    };
  }, [token, attempt]);

  const verdict = assessPassword(password);
  const mismatch = confirm.length > 0 && confirm !== password;
  const ready = firstName.trim() && lastName.trim() && verdict.ok && confirm === password;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!ready || !invite || submitting) return;
    setSubmitting(true);
    setError(null);
    setProblems([]);
    try {
      const { status, json } = await post("", { token, firstName, lastName, password });
      if (status === 201) {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: invite.email, password });
        if (signInError) {
          setError(`Your account was created, but signing in failed (${signInError.message}). Sign in with your new password.`);
          setSubmitting(false);
          return;
        }
        storeToken(null);
        navigate(TWO_FACTOR_ON ? "/setup-2fa" : "/", { replace: true });
        return;
      }
      if (status === 410 && (json.error === "expired" || json.error === "used" || json.error === "revoked")) {
        storeToken(null);
        setState(json.error);
      } else if (json.error === "weak_password" && Array.isArray(json.problems)) {
        setProblems(json.problems.map(String));
        setError("Choose a stronger password.");
      } else if (json.error === "already_has_account") {
        setError("There's already an account for this email. Sign in instead, or reset your password.");
      } else if (status === 429) {
        setError("Too many attempts. Wait a minute and try again.");
      } else if (json.error === "forbidden_domain") {
        // Trying again cannot help (USERS-AUDIT L12).
        setError("This invite is for an address that can't sign in to the Hub any more. Ask the person who sent it.");
      } else if (json.error === "validation_error") {
        setError("Your name or password wasn't accepted. Names can be up to 80 characters and passwords up to 256.");
      } else if (json.error === "create_failed") {
        setError(
          `The account couldn't be created${typeof json.detail === "string" ? ` (${json.detail})` : ""}. ` +
            "Your invite still works: try again, or ask the person who sent it.",
        );
      } else {
        setError(typeof json.detail === "string" ? json.detail : "Something went wrong creating your account. Try again.");
      }
    } catch {
      setError("Couldn't reach the Hub. Check your connection and try again.");
    }
    setSubmitting(false);
  }

  if (state === "checking") {
    return (
      <AuthShell title="Create your account">
        <Loader label="Checking your invite…" />
      </AuthShell>
    );
  }

  if (state !== "ready" || !invite) {
    return (
      <AuthShell title="Create your account">
        <Alert tone="danger" className="mt-5">
          {LINK_PROBLEM[state as keyof typeof LINK_PROBLEM]}
        </Alert>
        {state === "error" && token && (
          <Button className="mt-6 w-full" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </Button>
        )}
        <p className="t-help mt-6">
          <Link to="/login" className="font-semibold text-text underline underline-offset-2">
            Go to sign in
          </Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your account"
      description={`You've been invited to the SA Equip Product Hub. This link works until ${formatDateTime(invite.expiresAt)}.`}
    >
      <form onSubmit={onSubmit}>
        <div className="mt-6 space-y-4">
          <Field label="Email" htmlFor="email" hint="The invite is for this address, so it can't be changed.">
            <Input id="email" type="email" value={invite.email} readOnly aria-readonly="true" className="bg-surface-2 text-muted" />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="First name" htmlFor="first">
              <Input id="first" required autoFocus autoComplete="given-name" maxLength={80} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </Field>
            <Field label="Last name" htmlFor="last">
              <Input id="last" required autoComplete="family-name" maxLength={80} value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </Field>
          </div>
          <Field label="Password" htmlFor="password">
            <Input id="password" type="password" required autoComplete="new-password" maxLength={256} value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Field label="Confirm password" htmlFor="confirm" error={mismatch ? "The two passwords don't match." : undefined}>
            <Input id="confirm" type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
        </div>

        {password.length > 0 && !verdict.ok && (
          <ul className="t-help mt-3 list-disc space-y-0.5 pl-5">
            {verdict.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        {error && (
          <Alert tone="danger" className="mt-4">
            {error}
            {problems.length > 0 && (
              <ul className="mt-1 list-disc pl-5">
                {problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            )}
          </Alert>
        )}

        <Button type="submit" className="mt-6 w-full" disabled={!ready} loading={submitting}>
          Create account
        </Button>
        {TWO_FACTOR_ON && <p className="t-help mt-3">Next, you'll set up two-factor authentication with an app on your phone.</p>}
      </form>
    </AuthShell>
  );
}
