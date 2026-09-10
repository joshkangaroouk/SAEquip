import { useEffect, useState } from "react";
import { apiJson } from "../lib/api";
import { Badge, Button, Card, Table, TBody, TD, TH, THead, TR, toast } from "../components/ui";

interface StaffUser {
  id: string;
  email: string;
  createdAt: string;
  lastSignInAt: string | null;
  emailConfirmed: boolean;
  mfaEnabled: boolean;
  dudaEditor: boolean;
}

function when(iso: string | null): string {
  if (!iso) return "never";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Staff accounts.
 *
 * ⚠️ READ-ONLY by design, apart from triggering a password-reset email.
 * Creating and deleting accounts is a CLI operation
 * (`npm run users:create --workspace=backend`) because `requireAuth` only
 * proves "valid token + allowed email domain", and that domain list spans two
 * whole companies — as buttons on this page, any signed-in session could mint
 * itself another account or delete a colleague's.
 */
export default function Users() {
  const [users, setUsers] = useState<StaffUser[] | null>(null);
  const [domains, setDomains] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiJson<{ users: StaffUser[]; allowedDomains: string[] }>("/api/users")
      .then((d) => {
        if (cancelled) return;
        setUsers(d.users);
        setDomains(d.allowedDomains);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load users");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function sendReset(email: string) {
    setSending(email);
    try {
      await apiJson("/api/users/password-reset", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      toast.success(`Reset email sent to ${email}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send the reset email");
    } finally {
      setSending(null);
    }
  }

  return (
    <>
      <h1 className="text-xl font-semibold text-text">Users</h1>
      <p className="mt-1 text-sm text-muted">
        Staff accounts that can sign into this dashboard.
      </p>

      <Card className="mt-6">
        <h2 className="text-body font-semibold text-text">Who can sign in</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-muted">
          <li>
            Public sign-up is <strong className="font-semibold text-text">disabled</strong>. An account has
            to be created for someone before they can log in.
          </li>
          <li>
            Only these email domains are accepted:{" "}
            {domains.map((d) => (
              <code key={d} className="mr-1 rounded bg-surface-2 px-1 py-0.5 text-xs text-text">
                @{d}
              </code>
            ))}
          </li>
          <li>
            <strong className="font-semibold text-text">Everyone here has the same access.</strong> There is
            no admin/editor split yet — any signed-in user can change any product. Ask if you want roles.
          </li>
          <li>
            New accounts are created from the command line, on purpose — a button here would let anyone
            already signed in create more accounts for themselves.
          </li>
        </ul>
      </Card>

      {error && (
        <div className="mt-6 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {!users && !error && <p className="mt-8 text-muted">Loading users…</p>}

      {users && (
        <Card className="mt-6">
          <Table>
            <THead>
              <TR>
                <TH>Email</TH>
                <TH>Two-factor</TH>
                <TH>Last sign-in</TH>
                <TH>Added</TH>
                <TH>Duda editor</TH>
                <TH className="w-px" />
              </TR>
            </THead>
            <TBody>
              {users.map((u) => (
                <TR key={u.id}>
                  <TD>
                    <span className="font-medium text-text">{u.email}</span>
                    {!u.emailConfirmed && (
                      <Badge tone="danger" className="ml-2">
                        Unconfirmed
                      </Badge>
                    )}
                  </TD>
                  <TD>
                    {u.mfaEnabled ? (
                      <Badge tone="success">On</Badge>
                    ) : (
                      <Badge tone="neutral">Off</Badge>
                    )}
                  </TD>
                  <TD className="text-muted">{when(u.lastSignInAt)}</TD>
                  <TD className="text-muted">{when(u.createdAt)}</TD>
                  <TD>{u.dudaEditor ? <Badge tone="accent">Yes</Badge> : <span className="text-subtle">—</span>}</TD>
                  <TD className="w-px whitespace-nowrap">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={sending === u.email}
                      onClick={() => sendReset(u.email)}
                    >
                      {sending === u.email ? "Sending…" : "Send reset email"}
                    </Button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </>
  );
}
