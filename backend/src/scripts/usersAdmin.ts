import "dotenv/config";
import { supabase } from "../supabase.js";
import { findUserWithFactors, hasVerifiedFactor } from "../services/supabaseUsers.js";

/**
 * The super admin role (2026-11): who may invite people, disable accounts and
 * give Website Editor access from the Users page.
 *
 *   npm run users:admin --workspace=backend -- --email josh@kangaroouk.com --check
 *   npm run users:admin --workspace=backend -- --email josh@kangaroouk.com --super-admin [--confirm]
 *   npm run users:admin --workspace=backend -- --email <addr> --revoke-super-admin [--confirm]
 *
 * ⚠️ CLI-ONLY, deliberately: no HTTP route can grant this role, so a bug or a
 * stolen session in the dashboard cannot make anyone a super admin. The role
 * lives in Supabase `app_metadata`, which only the service role can write.
 *
 * Becoming super admin also makes two-factor REQUIRED (`mfa_required`): the
 * account can do nothing until an authenticator is set up, and the super admin
 * routes need a 2FA-verified session. Revoking the role leaves 2FA required.
 *
 * Dry run without --confirm.
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
  const email = arg("email")?.trim().toLowerCase();
  if (!email) fail("--email is required");
  const user = await findUserWithFactors(email);
  if (!user) fail(`No account for ${email}.`);

  const app = { ...(user.app_metadata ?? {}) } as Record<string, unknown>;
  console.log(`${email}  (id ${user.id})`);
  console.log(`  role          ${typeof app.role === "string" ? app.role : "—"}`);
  console.log(`  2FA required  ${app.mfa_required === true ? "yes" : "no"}`);
  console.log(`  2FA set up    ${hasVerifiedFactor(user) ? "yes" : "no"}`);
  console.log(`  disabled      ${user.banned_until && Date.parse(user.banned_until) > Date.now() ? "yes" : "no"}`);

  const grant = flag("super-admin");
  const revoke = flag("revoke-super-admin");
  if (!grant && !revoke) return;
  if (grant && revoke) fail("Pass --super-admin or --revoke-super-admin, not both.");

  // Merged over what is there: app_metadata also holds Supabase's own keys
  // (provider, providers), which must survive.
  const next = grant ? { ...app, role: "super_admin", mfa_required: true } : { ...app, role: null };
  console.log(`\n→ ${grant ? "make super admin (2FA becomes required)" : "remove the super admin role (2FA stays required)"}`);
  if (grant && !hasVerifiedFactor(user)) {
    console.log("  ⚠ no authenticator yet: the dashboard will ask for one at the next visit, and nothing else works until then.");
  }
  if (!flag("confirm")) {
    console.log("\nDry run. Add --confirm to apply.\n");
    return;
  }
  const { error } = await supabase.auth.admin.updateUserById(user.id, { app_metadata: next });
  if (error) fail(`Update failed: ${error.message}`);
  const after = await findUserWithFactors(email);
  const role = (after?.app_metadata as { role?: unknown } | undefined)?.role ?? null;
  if (grant ? role !== "super_admin" : role) fail(`Supabase did not keep the change (role is ${String(role)}).`);
  console.log(`\n✓ Done. Sign out and in again for the dashboard to show it.\n`);
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
