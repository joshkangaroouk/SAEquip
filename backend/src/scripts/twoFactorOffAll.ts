import "dotenv/config";
import { supabase } from "../supabase.js";
import { hasVerifiedFactor } from "../services/supabaseUsers.js";

/**
 * Turn two-factor OFF for EVERY account in the Supabase project: delete every
 * factor (confirmed or half-enrolled) and set `mfa_required` false.
 *
 *   npm run users:2fa-off-all --workspace=backend                                     # dry run
 *   npm run users:2fa-off-all --workspace=backend -- --by josh@kangaroouk.com --confirm
 *
 * Josh, 2026-11-18: "turn off 2FA for everyone, for now". It goes with
 * `TWO_FACTOR_ON = false` (services/twoFactor.ts): without that switch the
 * super admin would lose their routes (they need a 2FA session) and new
 * invites would still require it. Deploy the switch FIRST.
 *
 * Each account is stamped with who did it and when (`mfa_disabled_by`/`_at`,
 * which the Users page shows) and `mfa_was_required`, so turning it back on
 * can put the requirement back on the same people.
 *
 * Every account is read back afterwards, and the run fails if any still has a
 * factor or the requirement. Re-running is harmless.
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

async function allUsers() {
  // listUsers omits `factors` (see services/supabaseUsers.ts): re-read each one.
  const ids: string[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    ids.push(...data.users.map((u) => u.id));
    if (data.users.length < 200) break;
  }
  const users = [];
  for (const id of ids) {
    const { data, error } = await supabase.auth.admin.getUserById(id);
    if (error || !data.user) throw error ?? new Error(`Could not read user ${id}`);
    users.push(data.user);
  }
  return users;
}

const required = (u: { app_metadata?: Record<string, unknown> }) => u.app_metadata?.mfa_required === true;

async function main() {
  const confirm = flag("confirm");
  const by = arg("by")?.trim().toLowerCase();
  if (confirm && !by) fail("--confirm needs --by <your email>, for the record on each account.");

  const users = await allUsers();
  const todo = users.filter((u) => (u.factors ?? []).length > 0 || required(u));
  console.log(`\n${users.length} accounts; ${todo.length} with two-factor set up or required:\n`);
  for (const u of users) {
    const n = (u.factors ?? []).length;
    console.log(
      `  ${(u.email ?? u.id).padEnd(38)} ${hasVerifiedFactor(u) ? "2FA on " : "2FA off"}  ${String(n).padStart(2)} factor(s)  required: ${required(u) ? "yes" : "no "}`,
    );
  }
  if (!todo.length) {
    console.log("\n✓ Nothing to do: no account has two-factor set up or required.\n");
    return;
  }
  if (!confirm) {
    console.log(`\nDry run. Add --by <your email> --confirm to turn two-factor off for these ${todo.length}.\n`);
    return;
  }

  const at = new Date().toISOString();
  for (const u of todo) {
    for (const f of u.factors ?? []) {
      const { error } = await supabase.auth.admin.mfa.deleteFactor({ userId: u.id, id: f.id });
      if (error) fail(`${u.email}: could not delete factor ${f.id}: ${error.message}`);
    }
    // Merged over what is there: app_metadata also holds Supabase's own keys.
    const { error } = await supabase.auth.admin.updateUserById(u.id, {
      app_metadata: {
        ...(u.app_metadata ?? {}),
        mfa_required: false,
        mfa_was_required: required(u),
        mfa_disabled_by: by,
        mfa_disabled_at: at,
      },
    });
    if (error) fail(`${u.email}: factors removed, but the requirement could not be cleared: ${error.message}`);
    console.log(`  ✓ ${u.email}: ${(u.factors ?? []).length} factor(s) removed${required(u) ? ", no longer required" : ""}`);
  }

  // Read every account back: the change must have held.
  const after = await allUsers();
  const left = after.filter((u) => (u.factors ?? []).length > 0 || required(u));
  if (left.length) fail(`Still set up or required: ${left.map((u) => u.email).join(", ")}`);
  const lostProvider = after.filter((u) => {
    const before = users.find((b) => b.id === u.id);
    return before?.app_metadata?.provider && !u.app_metadata?.provider;
  });
  if (lostProvider.length) fail(`Supabase's own app_metadata was lost for: ${lostProvider.map((u) => u.email).join(", ")}`);
  console.log(`\n✓ Two-factor is off for all ${after.length} accounts, checked with Supabase.\n`);
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
