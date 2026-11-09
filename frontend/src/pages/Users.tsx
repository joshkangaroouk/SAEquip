import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiJson } from "../lib/api";
import { initialsFrom } from "../lib/initials";
import { formatDateTime } from "../lib/format";
import { useAuth } from "../auth/AuthContext";
import {
  PageHeader,
  Alert,
  Badge,
  Button,
  Checkbox,
  DropdownMenu,
  Field,
  Input,
  Modal,
  Skeleton,
  SkeletonLine,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  toast,
  useConfirm,
  type MenuAction,
} from "../components/ui";

interface StaffUser {
  id: string;
  email: string;
  /** "First Last" for invited accounts; null for older ones. */
  name: string | null;
  role: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  emailConfirmed: boolean;
  mfaEnabled: boolean;
  mfaRequired: boolean;
  disabled: boolean;
  dudaEditor: boolean;
  dudaAccountName: string | null;
  /** Website Editor access was ticked on the invite but could not be set up. */
  editorError: string | null;
}

type InviteStatus = "pending" | "used" | "revoked" | "expired";

interface Invite {
  id: string;
  email: string;
  grantWebsiteEditor: boolean;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
  revokedAt: string | null;
  status: InviteStatus;
}

function when(iso: string | null): string {
  if (!iso) return "never";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

const errorText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

/**
 * Staff accounts.
 *
 * Everyone signed in sees the list and can send a password reset to
 * THEMSELVES. The SUPER ADMIN (2026-11; set with the `users:admin` CLI, and
 * only from a 2FA session) also gets:
 * - a password reset for anyone;
 * - Invite user: an email in, a link out (5 hours, once), sent by hand;
 * - the invites list, with Revoke and New link;
 * - per person: give or remove Website Editor access, disable or enable.
 *
 * The server checks the role on every one of those (requireSuperAdmin); the
 * page only decides what to show, from `viewer.superAdmin` in GET /api/users.
 */
/** Initials avatar from the name, else the email (02a Q19). */
function Avatar({ u }: { u: StaffUser }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-8 w-8 shrink-0 items-center justify-center border border-border bg-surface-2 text-label font-semibold text-text"
    >
      {initialsFrom(u.name ?? u.email)}
    </span>
  );
}

/** The name over the email (or the email alone), with the account's chips. */
function Who({ u }: { u: StaffUser }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <Avatar u={u} />
      <span className="min-w-0">
        <span className="block break-all font-medium text-text">{u.name ?? u.email}</span>
        {u.name && <span className="block break-all text-help text-muted">{u.email}</span>}
        {(u.role === "super_admin" || u.disabled || !u.emailConfirmed) && (
          <span className="mt-1 flex flex-wrap gap-1.5">
            {u.role === "super_admin" && <Badge tone="solid">Super admin</Badge>}
            {u.disabled && <Badge tone="neutral">Disabled</Badge>}
            {!u.emailConfirmed && <Badge tone="danger">Unconfirmed</Badge>}
          </span>
        )}
      </span>
    </span>
  );
}

function TwoFactor({ u }: { u: StaffUser }) {
  if (u.mfaEnabled) return <Badge tone="ok">On</Badge>;
  // Invited accounts must set it up before they can do anything.
  if (u.mfaRequired) return <Badge tone="warning">Required, not set up</Badge>;
  return <Badge tone="neutral">Off</Badge>;
}

function WebsiteEditor({ u }: { u: StaffUser }) {
  if (u.dudaEditor) {
    return (
      <span className="block">
        <Badge tone="solid">Yes</Badge>
        {u.dudaAccountName && u.dudaAccountName !== u.email && (
          <span className="mt-1 block break-all text-label text-muted" title="The Duda account it uses">
            {u.dudaAccountName}
          </span>
        )}
      </span>
    );
  }
  if (u.editorError) {
    return (
      <span title={u.editorError}>
        <Badge tone="danger">Couldn't be set up</Badge>
      </span>
    );
  }
  return (
    <>
      <span aria-hidden="true" className="text-muted">
        —
      </span>
      <span className="sr-only">No</span>
    </>
  );
}

const INVITE_STATUS: Record<InviteStatus, { label: string; tone: "ok" | "neutral" | "warning" }> = {
  pending: { label: "Pending", tone: "warning" },
  used: { label: "Account created", tone: "ok" },
  expired: { label: "Expired", tone: "neutral" },
  revoked: { label: "Revoked", tone: "neutral" },
};

/**
 * The page while the staff list loads (11 §1): the table from xl and the
 * cards below it, as the page lays them out, with the static labels as
 * themselves and blocks for each person. One polite announcement; the
 * blocks are aria-hidden.
 */
function UsersSkeleton() {
  const text = (w: string) => <SkeletonLine text="text-body" className={`h-[0.8em] ${w}`} />;
  const who = (
    <span className="flex min-w-0 items-center gap-3">
      <Skeleton className="h-8 w-8 shrink-0" />
      <Skeleton className="h-3.5 w-56 max-w-full" />
    </span>
  );
  return (
    <div aria-busy="true">
      <p role="status" className="sr-only">
        Loading users
      </p>
      <div aria-hidden="true">
        <div className="hidden xl:block">
          <Table>
            <THead>
              <TR>
                <TH>User</TH>
                <TH>Two-factor</TH>
                <TH>Website Editor</TH>
                <TH>Last sign-in</TH>
                <TH>Added</TH>
                <TH className="w-px">
                  <span className="sr-only">Actions</span>
                </TH>
              </TR>
            </THead>
            <TBody>
              {[0, 1].map((i) => (
                <TR key={i}>
                  <TD>{who}</TD>
                  <TD>
                    <Skeleton className="h-6.5 w-10" />
                  </TD>
                  <TD>
                    <Skeleton className="h-6.5 w-10" />
                  </TD>
                  <TD>{text("w-20")}</TD>
                  <TD>{text("w-20")}</TD>
                  <TD className="w-px">
                    <Skeleton className="h-8.5 w-[140px]" />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
        <ul className="grid gap-3 md:grid-cols-2 xl:hidden">
          {[0, 1].map((i) => (
            <li key={i} className="border border-border bg-surface p-4">
              {who}
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                {["Two-factor", "Website Editor", "Last sign-in", "Added"].map((label, j) => (
                  <div key={label}>
                    <dt className="t-label">{label}</dt>
                    <dd className="mt-1">{j < 2 ? <Skeleton className="h-6.5 w-10" /> : text("w-20")}</dd>
                  </div>
                ))}
              </dl>
              <Skeleton className="mt-4 h-8.5 w-full" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * Invite user: an email (and whether to give Website Editor access) in, a link
 * out. The link is shown ONCE (only a hash of it is kept), with Copy, its
 * expiry, and a reminder that whoever has it can create the account.
 */
function InviteDialog({
  open,
  onClose,
  allowedDomains,
  initial,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  allowedDomains: string[];
  /** For "New link": the email and choice of the invite it replaces. */
  initial: { email: string; grantWebsiteEditor: boolean } | null;
  onCreated: (invite: Invite) => void;
}) {
  const [email, setEmail] = useState("");
  const [editor, setEditor] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [made, setMade] = useState<{ link: string; invite: Invite } | null>(null);

  useEffect(() => {
    if (!open) return;
    setEmail(initial?.email ?? "");
    setEditor(initial?.grantWebsiteEditor ?? false);
    setError(null);
    setMade(null);
  }, [open, initial]);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiJson<{ invite: Invite; token: string }>("/api/invites", {
        method: "POST",
        body: JSON.stringify({ email, grantWebsiteEditor: editor }),
      });
      // Built here from this dashboard's own address; the server never sees the link.
      setMade({ link: `${window.location.origin}/invite#t=${res.token}`, invite: res.invite });
      onCreated(res.invite);
    } catch (err) {
      setError(errorText(err, "Couldn't create the invite"));
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!made) return;
    try {
      await navigator.clipboard.writeText(made.link);
      toast.success("Invite link copied");
    } catch {
      toast.error("Couldn't copy. Select the link and copy it instead.");
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={made ? "Invite link ready" : "Invite user"}
      description={
        made
          ? `Send this link to ${made.invite.email}. It works once, until ${formatDateTime(made.invite.expiresAt)}.`
          : "Enter their email to get a link they use to create their account. It lasts 5 hours and works once."
      }
      footer={
        made ? (
          <Button onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" form="invite-form" loading={busy} disabled={!email.trim()}>
              Create invite link
            </Button>
          </>
        )
      }
    >
      {made ? (
        <div className="space-y-4">
          <Field label="Invite link">
            <div className="flex gap-2">
              <Input readOnly value={made.link} onFocus={(e) => e.currentTarget.select()} className="min-w-0" />
              <Button variant="secondary" onClick={() => void copy()}>
                Copy
              </Button>
            </div>
          </Field>
          <Alert tone="warning" live="off">
            Anyone with this link can create this account, so send it only to {made.invite.email}, somewhere you trust.
            You won't be able to see it again; if it's lost, make a new one.
          </Alert>
          <p className="t-help">
            They'll choose a password and set up two-factor before they can use the Hub.
            {made.invite.grantWebsiteEditor && " Website Editor access is set up when they create the account."}
          </p>
        </div>
      ) : (
        <form id="invite-form" onSubmit={create} className="space-y-4">
          <Field
            label="Email"
            hint={allowedDomains.length ? `Only ${listDomains(allowedDomains)} addresses can sign in.` : undefined}
            error={error ?? undefined}
          >
            <Input type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <div>
            <Checkbox checked={editor} onChange={setEditor} label="Give Website Editor access" />
            <p className="t-help mt-1 pl-7">
              Lets them edit and publish the live site in Duda's editor (no shop or code settings).
            </p>
          </div>
        </form>
      )}
    </Modal>
  );
}

export default function Users() {
  const { user: me } = useAuth();
  const confirm = useConfirm();
  const [users, setUsers] = useState<StaffUser[] | null>(null);
  const [allowedDomains, setAllowedDomains] = useState<string[]>([]);
  const [superAdmin, setSuperAdmin] = useState(false);
  const [invites, setInvites] = useState<Invite[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [busyUser, setBusyUser] = useState<string | null>(null);
  const [inviting, setInviting] = useState<{ email: string; grantWebsiteEditor: boolean } | null | false>(false);

  const loadUsers = useCallback(async () => {
    // `allowedDomains` is ALLOWED_EMAIL_DOMAINS, which GET /api/users already returns.
    const d = await apiJson<{ users: StaffUser[]; allowedDomains?: string[]; viewer?: { superAdmin?: boolean } }>("/api/users");
    setUsers(d.users);
    setAllowedDomains(d.allowedDomains ?? []);
    setSuperAdmin(!!d.viewer?.superAdmin);
    return !!d.viewer?.superAdmin;
  }, []);

  const loadInvites = useCallback(async () => {
    const d = await apiJson<{ invites: Invite[] }>("/api/invites");
    setInvites(d.invites);
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadUsers()
      .then((admin) => (admin && !cancelled ? loadInvites() : undefined))
      .catch((e) => {
        if (!cancelled) setError(errorText(e, "Failed to load users"));
      });
    return () => {
      cancelled = true;
    };
  }, [loadUsers, loadInvites]);

  async function sendReset(email: string) {
    setSending(email);
    try {
      await apiJson("/api/users/password-reset", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      toast.success(`Reset email sent to ${email}`);
    } catch (e) {
      toast.error(errorText(e, "Could not send the reset email"));
    } finally {
      setSending(null);
    }
  }

  /** Runs a super admin action on one person, then reloads the list. */
  async function act(u: StaffUser, run: () => Promise<string | void>) {
    setBusyUser(u.id);
    try {
      const message = await run();
      if (message) toast.success(message);
    } catch (e) {
      toast.error(errorText(e, "That didn't work"));
    } finally {
      setBusyUser(null);
      await loadUsers().catch(() => {});
    }
  }

  const who = (u: StaffUser) => u.name ?? u.email;

  async function disable(u: StaffUser) {
    const ok = await confirm({
      title: `Disable ${who(u)}?`,
      description: `They're signed out of the Hub at once and can't sign in again until you enable them.${
        u.dudaEditor ? " Their Website Editor access is removed too." : ""
      } Nothing is deleted.`,
      confirmLabel: "Disable access",
      danger: true,
    });
    if (!ok) return;
    await act(u, async () => {
      const res = await apiJson<{ editorRevoked: boolean; editorError?: string }>(`/api/users/${u.id}/disable`, { method: "POST" });
      if (res.editorError) {
        toast.error(`Disabled, but Website Editor access couldn't be removed: ${res.editorError} Try Remove Website Editor access.`);
        return;
      }
      return `${who(u)} is disabled${res.editorRevoked ? ", and their Website Editor access removed" : ""}`;
    });
  }

  async function enable(u: StaffUser) {
    await act(u, async () => {
      await apiJson(`/api/users/${u.id}/enable`, { method: "POST" });
      return `${who(u)} can sign in again. Website Editor access isn't restored; give it again if they need it.`;
    });
  }

  async function giveEditor(u: StaffUser) {
    const ok = await confirm({
      title: `Give ${who(u)} Website Editor access?`,
      description: "They'll be able to edit and publish the live site in Duda's editor, from Website Editor in the Hub. Shop, code and site settings stay off.",
      confirmLabel: "Give access",
    });
    if (!ok) return;
    await act(u, async () => {
      const res = await apiJson<{ dudaAccountName: string; aliased: boolean }>(`/api/users/${u.id}/website-editor`, { method: "POST" });
      return res.aliased
        ? `Website Editor access given, through the Duda account ${res.dudaAccountName} (their own email is a Kangaroo Duda login)`
        : "Website Editor access given";
    });
  }

  async function removeEditor(u: StaffUser) {
    const ok = await confirm({
      title: `Remove ${who(u)}'s Website Editor access?`,
      description: "Their Duda access to the live site is removed and checked with Duda. Their Hub account is unchanged.",
      confirmLabel: "Remove access",
      danger: true,
    });
    if (!ok) return;
    await act(u, async () => {
      await apiJson(`/api/users/${u.id}/website-editor`, { method: "DELETE" });
      return "Website Editor access removed";
    });
  }

  /** The super admin's actions for one person; none for themselves or another super admin, beyond editor access. */
  function adminActions(u: StaffUser): MenuAction[] {
    const actions: MenuAction[] = [];
    if (u.dudaEditor) actions.push({ label: "Remove Website Editor access", onSelect: () => void removeEditor(u), danger: true });
    else if (!u.disabled) actions.push({ label: u.editorError ? "Retry Website Editor access" : "Give Website Editor access", onSelect: () => void giveEditor(u) });
    if (u.id !== me?.id && u.role !== "super_admin") {
      actions.push(
        u.disabled
          ? { label: "Enable access", onSelect: () => void enable(u) }
          : { label: "Disable access…", onSelect: () => void disable(u), danger: true },
      );
    }
    return actions;
  }

  async function revokeInvite(i: Invite) {
    const ok = await confirm({
      title: `Revoke the invite for ${i.email}?`,
      description: "The link stops working at once.",
      confirmLabel: "Revoke",
      danger: true,
    });
    if (!ok) return;
    try {
      await apiJson(`/api/invites/${i.id}/revoke`, { method: "POST" });
      toast.success("Invite revoked");
    } catch (e) {
      toast.error(errorText(e, "Couldn't revoke the invite"));
    }
    await loadInvites().catch(() => {});
  }

  const rowActions = (u: StaffUser, wide = false) => {
    const actions = superAdmin ? adminActions(u) : [];
    // A reset goes to your own address only, unless you are the super admin:
    // the server refuses the rest, so the button is not offered.
    const canReset = superAdmin || u.id === me?.id;
    if (!canReset && actions.length === 0) return null;
    return (
      <div className={wide ? "mt-4 flex gap-2" : "flex items-center justify-end gap-2"}>
        {canReset && (
          <Button
            variant="secondary"
            size="sm"
            className={wide ? "flex-1" : undefined}
            disabled={sending === u.email || u.disabled}
            onClick={() => sendReset(u.email)}
          >
            {sending === u.email ? "Sending…" : "Send reset email"}
          </Button>
        )}
        {actions.length > 0 && (
          <DropdownMenu label={`More actions for ${who(u)}${busyUser === u.id ? " (working…)" : ""}`} actions={actions} />
        )}
      </div>
    );
  };

  // Pending first, then the rest newest first; the 20 most recent are plenty here.
  const shownInvites = (invites ?? [])
    .slice()
    .sort((a, b) => Number(b.status === "pending") - Number(a.status === "pending"))
    .slice(0, 20);

  return (
    <>
      <PageHeader
        title="Users"
        description="Staff accounts that can sign into this dashboard."
        actions={
          superAdmin ? (
            <Button size="sm" onClick={() => setInviting(null)}>
              Invite user
            </Button>
          ) : undefined
        }
      />

      {error && <Alert tone="danger">{error}</Alert>}

      {!users && !error && <UsersSkeleton />}

      {users && (
        <>
          {/*
            From xl, the table. No Card round it: <Table> is already a bordered
            surface. Below xl, cards (two up from md).
          */}
          <div className="hidden xl:block">
            <Table>
              <THead>
                <TR>
                  <TH>User</TH>
                  <TH>Two-factor</TH>
                  <TH>Website Editor</TH>
                  <TH>Last sign-in</TH>
                  <TH>Added</TH>
                  <TH className="w-px">
                    <span className="sr-only">Actions</span>
                  </TH>
                </TR>
              </THead>
              <TBody>
                {users.map((u) => (
                  <TR key={u.id}>
                    {/* Room for a whole email on one line: without it the Duda account
                        name beside it squeezed this column and emails broke mid-word. */}
                    <TD className="min-w-[16rem]">
                      <Who u={u} />
                    </TD>
                    <TD>
                      <TwoFactor u={u} />
                    </TD>
                    <TD>
                      <WebsiteEditor u={u} />
                    </TD>
                    <TD className="whitespace-nowrap text-muted">{when(u.lastSignInAt)}</TD>
                    <TD className="whitespace-nowrap text-muted">{when(u.createdAt)}</TD>
                    <TD className="w-px whitespace-nowrap">{rowActions(u)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>

          <ul className="grid gap-3 md:grid-cols-2 xl:hidden">
            {users.map((u) => (
              <li key={u.id} className="border border-border bg-surface p-4">
                <Who u={u} />
                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                  <div>
                    <dt className="t-label">Two-factor</dt>
                    <dd className="mt-1">
                      <TwoFactor u={u} />
                    </dd>
                  </div>
                  <div>
                    <dt className="t-label">Website Editor</dt>
                    <dd className="mt-1">
                      <WebsiteEditor u={u} />
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
                {rowActions(u, true)}
              </li>
            ))}
          </ul>
        </>
      )}

      {superAdmin && invites && invites.length > 0 && (
        <section aria-labelledby="invites-h" className="mt-8">
          <h2 id="invites-h" className="t-section mb-3 text-text">
            Invites
          </h2>
          <Table>
            <THead>
              <TR>
                <TH>Email</TH>
                <TH>Status</TH>
                <TH>Website Editor</TH>
                <TH>Invited by</TH>
                <TH className="w-px">
                  <span className="sr-only">Actions</span>
                </TH>
              </TR>
            </THead>
            <TBody>
              {shownInvites.map((i) => (
                <TR key={i.id}>
                  <TD className="break-all font-medium text-text">{i.email}</TD>
                  <TD>
                    <Badge tone={INVITE_STATUS[i.status].tone}>{INVITE_STATUS[i.status].label}</Badge>
                    <span className="mt-1 block text-label text-muted tabular-nums">
                      {i.status === "pending"
                        ? `Until ${formatDateTime(i.expiresAt)}`
                        : i.status === "used" && i.usedAt
                          ? formatDateTime(i.usedAt)
                          : i.status === "revoked" && i.revokedAt
                            ? formatDateTime(i.revokedAt)
                            : `Ended ${formatDateTime(i.expiresAt)}`}
                    </span>
                  </TD>
                  <TD>{i.grantWebsiteEditor ? "Yes" : "No"}</TD>
                  <TD className="break-all text-muted">
                    {i.createdBy}
                    <span className="block text-label tabular-nums">{formatDateTime(i.createdAt)}</span>
                  </TD>
                  <TD className="w-px whitespace-nowrap">
                    <div className="flex justify-end gap-2">
                      {i.status === "pending" && (
                        <Button variant="secondary" size="sm" onClick={() => void revokeInvite(i)}>
                          Revoke
                        </Button>
                      )}
                      {i.status !== "used" && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setInviting({ email: i.email, grantWebsiteEditor: i.grantWebsiteEditor })}
                        >
                          New link
                        </Button>
                      )}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </section>
      )}

      {/*
        Invite domains (00, 02a Q19): exactly ALLOWED_EMAIL_DOMAINS as the API
        reports it. The backend requires at least one, so there is always a
        restriction to state; the note is left out only if the list is missing.
      */}
      {users && allowedDomains.length > 0 && (
        <Alert tone="info" live="off" title="Adding someone" className="mt-5">
          Only email addresses at {listDomains(allowedDomains)} can sign in.{" "}
          {superAdmin
            ? "Use Invite user: they'll set a password and two-factor before they can use the Hub."
            : "New accounts are invited by the Hub's super admin."}
        </Alert>
      )}

      {superAdmin && (
        <InviteDialog
          open={inviting !== false}
          onClose={() => setInviting(false)}
          allowedDomains={allowedDomains}
          initial={inviting || null}
          onCreated={() => void loadInvites().catch(() => {})}
        />
      )}
    </>
  );
}

/** "a.com", "a.com or b.com", "a.com, b.com or c.com". */
function listDomains(domains: string[]): string {
  const d = domains.map((x) => `@${x}`);
  return d.length <= 1 ? d.join("") : `${d.slice(0, -1).join(", ")} or ${d[d.length - 1]}`;
}
