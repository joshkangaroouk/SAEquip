import "dotenv/config";
import { supabase } from "../supabase.js";

/**
 * Inspect or clear a staff account's two-factor enrolment.
 *
 *   npm run users:mfa --workspace=backend -- --email <addr> --check
 *   npm run users:mfa --workspace=backend -- --email <addr> --reset --confirm
 *
 * ⚠️ THE LOCKOUT ESCAPE HATCH. `requireAuth` refuses an `aal1` token once an
 * account has a verified factor, so a lost or wiped authenticator locks that
 * person out of the dashboard completely — there is no "email me a bypass",
 * by design. `--reset` deletes their factors so they can sign in with the
 * password alone and enrol again.
 *
 * ⚠️ CLI-only, and this is the most privilege-escalating operation in the
 * repo: it REMOVES a security control from someone else's account. As an HTTP
 * route, anyone already signed in could strip MFA off a colleague and then
 * only need their password. Keep it here, and confirm out-of-band that the
 * request really came from the person who owns the account.
 */

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const arg = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
function fail(msg: string): never {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

async function main() {
  const email = (arg("email") ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) fail("Pass --email <address>");

  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) fail(`Could not list users: ${error.message}`);
  const user = data?.users.find((u) => (u.email ?? "").toLowerCase() === email);
  if (!user) fail(`No account for ${email}`);

  const factors = user.factors ?? [];
  console.log(`\n${email}  (id=${user.id})`);
  if (!factors.length) {
    console.log("  no factors enrolled — signs in with a password alone\n");
    return;
  }
  for (const f of factors) {
    console.log(`  ${f.id}  ${String(f.factor_type).padEnd(6)} ${f.status.padEnd(10)} ${f.friendly_name ?? ""}`);
  }
  const verified = factors.filter((f) => f.status === "verified");
  console.log(
    verified.length
      ? `\n  ${verified.length} verified factor(s) — this account MUST present a code (requireAuth enforces aal2).`
      : "\n  enrolment started but never confirmed — requireAuth ignores unverified factors.",
  );

  if (!flag("reset")) {
    console.log("  Add --reset --confirm to delete these factors.\n");
    return;
  }
  if (!flag("confirm")) fail("--reset requires --confirm (it removes a security control).");

  for (const f of factors) {
    const { error: delErr } = await supabase.auth.admin.mfa.deleteFactor({
      userId: user.id,
      id: f.id,
    });
    if (delErr) fail(`Failed to delete factor ${f.id}: ${delErr.message}`);
    console.log(`  ✓ deleted ${f.id}`);
  }
  console.log(
    `\n✓ ${email} can now sign in with just a password. Have them re-enrol immediately at /security.\n`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
