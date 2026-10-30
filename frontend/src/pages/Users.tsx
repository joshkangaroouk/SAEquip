import { useEffect, useState } from "react";
import { apiJson } from "../lib/api";
import { initialsFrom } from "../lib/initials";
import { PageHeader, Alert, Badge, Button, Loader, Table, TBody, TD, TH, THead, TR, toast } from "../components/ui";

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
/** Initials avatar from the email (02a Q19): there is no name field. */
function Avatar({ email }: { email: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-8 w-8 shrink-0 items-center justify-center border border-border bg-surface-2 text-label font-semibold text-text"
    >
      {initialsFrom(email)}
    </span>
  );
}

/** The email as the main line, with the Unconfirmed fault chip when it applies. */
function Who({ u }: { u: StaffUser }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <Avatar email={u.email} />
      <span className="min-w-0">
        <span className="block break-all font-medium text-text">{u.email}</span>
        {!u.emailConfirmed && (
          <Badge tone="danger" className="mt-1">
            Unconfirmed
          </Badge>
        )}
      </span>
    </span>
  );
}

const TwoFactor = ({ on }: { on: boolean }) => (on ? <Badge tone="ok">On</Badge> : <Badge tone="neutral">Off</Badge>);

const DudaEditor = ({ yes }: { yes: boolean }) =>
  yes ? (
    <Badge tone="solid">Yes</Badge>
  ) : (
    <>
      <span aria-hidden="true" className="text-muted">
        —
      </span>
      <span className="sr-only">No</span>
    </>
  );

export default function Users() {
  const [users, setUsers] = useState<StaffUser[] | null>(null);
  const [allowedDomains, setAllowedDomains] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // `allowedDomains` is ALLOWED_EMAIL_DOMAINS, which GET /api/users already returns.
    apiJson<{ users: StaffUser[]; allowedDomains?: string[] }>("/api/users")
      .then((d) => {
        if (cancelled) return;
        setUsers(d.users);
        setAllowedDomains(d.allowedDomains ?? []);
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

  const resetButton = (u: StaffUser, className?: string) => (
    <Button
      variant="secondary"
      size="sm"
      className={className}
      disabled={sending === u.email}
      onClick={() => sendReset(u.email)}
    >
      {sending === u.email ? "Sending…" : "Send reset email"}
    </Button>
  );

  return (
    <>
      <PageHeader title="Users" description="Staff accounts that can sign into this dashboard." />

      {error && <Alert tone="danger">{error}</Alert>}

      {!users && !error && <Loader label="Loading users…" />}

      {users && (
        <>
          {/*
            From xl, the table. No Card round it: <Table> is already a bordered
            surface. Between lg and xl the column is ~670px and six columns plus
            "Send reset email" need ~730, so the cards carry on until xl.
          */}
          <div className="hidden xl:block">
            <Table>
              <THead>
                <TR>
                  <TH>User</TH>
                  <TH>Two-factor</TH>
                  <TH>Last sign-in</TH>
                  <TH>Added</TH>
                  <TH>Duda editor</TH>
                  <TH className="w-px">
                    <span className="sr-only">Actions</span>
                  </TH>
                </TR>
              </THead>
              <TBody>
                {users.map((u) => (
                  <TR key={u.id}>
                    <TD>
                      <Who u={u} />
                    </TD>
                    <TD>
                      <TwoFactor on={u.mfaEnabled} />
                    </TD>
                    <TD className="whitespace-nowrap text-muted">{when(u.lastSignInAt)}</TD>
                    <TD className="whitespace-nowrap text-muted">{when(u.createdAt)}</TD>
                    <TD>
                      <DudaEditor yes={u.dudaEditor} />
                    </TD>
                    <TD className="w-px whitespace-nowrap">{resetButton(u)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>

          {/* Below xl, one card per user (02a "After stage 5": not a sideways-scrolling table), two up from md. */}
          <ul className="grid gap-3 md:grid-cols-2 xl:hidden">
            {users.map((u) => (
              <li key={u.id} className="border border-border bg-surface p-4">
                <Who u={u} />
                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                  <div>
                    <dt className="t-label">Two-factor</dt>
                    <dd className="mt-1">
                      <TwoFactor on={u.mfaEnabled} />
                    </dd>
                  </div>
                  <div>
                    <dt className="t-label">Duda editor</dt>
                    <dd className="mt-1">
                      <DudaEditor yes={u.dudaEditor} />
                    </dd>
                  </div>
                  <div>
                    <dt className="t-label">Last sign-in</dt>
                    <dd className="mt-1 text-body text-text">{when(u.lastSignInAt)}</dd>
                  </div>
                  <div>
                    <dt className="t-label">Added</dt>
                    <dd className="mt-1 text-body text-text">{when(u.createdAt)}</dd>
                  </div>
                </dl>
                {resetButton(u, "mt-4 w-full")}
              </li>
            ))}
          </ul>
        </>
      )}

      {/*
        Invite domains (00, 02a Q19): exactly ALLOWED_EMAIL_DOMAINS as the API
        reports it. The backend requires at least one, so there is always a
        restriction to state; the note is left out only if the list is missing.
      */}
      {users && allowedDomains.length > 0 && (
        <Alert tone="info" live="off" title="Adding someone" className="mt-5">
          Only email addresses at {listDomains(allowedDomains)} can sign in. Accounts are created by Kangaroo, not
          from this page — ask them to add a colleague.
        </Alert>
      )}
    </>
  );
}

/** "a.com", "a.com or b.com", "a.com, b.com or c.com". */
function listDomains(domains: string[]): string {
  const d = domains.map((x) => `@${x}`);
  return d.length <= 1 ? d.join("") : `${d.slice(0, -1).join(", ")} or ${d[d.length - 1]}`;
}
