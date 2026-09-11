import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { env } from "../env.js";
import { supabase } from "../supabase.js";
import { findUserWithFactors } from "../services/supabaseUsers.js";

/**
 * Create (or repair) a staff Supabase account.
 *
 *   npm run users:create --workspace=backend -- --email josh@kangaroouk.com --confirm
 *   npm run users:create --workspace=backend -- --email <addr> --check
 *   npm run users:create --workspace=backend -- --email <addr> --reset --confirm
 *
 * ⚠️ CLI-ONLY, deliberately — never an HTTP route. `requireAuth` proves only
 * "valid token + allowed email domain", and ALLOWED_EMAIL_DOMAINS spans two
 * whole companies, so an HTTP version would let any signed-in session mint
 * itself further accounts. Same reasoning as dudaEditorProvision.ts.
 *
 * ⚠️ The password is read from a PROMPT (or STAFF_PASSWORD in the
 * environment), never from a command-line flag. Argv is visible to every
 * process on the machine via `ps`, lands in shell history, and would get
 * pasted into tickets and chat logs. The prompt is not echoed.
 */

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const arg = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
// A function DECLARATION rather than an arrow const: TypeScript only narrows
// on a `never`-returning call when it can resolve the signature statically,
// so `const fail = (): never =>` leaves everything after `fail(...)` still
// possibly-null.
function fail(msg: string): never {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

/** Refuses the passwords that make "extremely secure" a fiction. */
function assessPassword(pw: string): { ok: boolean; problems: string[] } {
  const problems: string[] = [];
  if (pw.length < 12) problems.push(`only ${pw.length} characters — 12 is the practical minimum, 16+ is better`);
  if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw)) problems.push("no mix of upper and lower case");
  if (!/\d/.test(pw)) problems.push("no digit");
  if (!/[^A-Za-z0-9]/.test(pw)) problems.push("no symbol");
  // A dictionary word plus a trailing digit or two is the single most common
  // human password shape, and the first thing any credential-stuffing list
  // tries. Length alone does not rescue it.
  if (/^[A-Za-z]+\d{0,3}[!?.]?$/.test(pw)) problems.push("word-plus-digits shape — the first pattern any cracking list tries");
  return { ok: problems.length === 0, problems };
}

async function readPassword(): Promise<string> {
  const fromEnv = process.env.STAFF_PASSWORD;
  if (fromEnv) return fromEnv;

  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  // Suppress echo so the password is not left on screen or in a screenshot.
  const stdout = process.stdout as unknown as { write: (s: string) => boolean };
  const originalWrite = stdout.write.bind(stdout);
  let muted = false;
  stdout.write = (chunk: string) => (muted ? true : originalWrite(chunk));
  const answer = rl.question("Password (not echoed): ").finally(() => {
    stdout.write = originalWrite;
  });
  muted = true;
  const pw = await answer;
  muted = false;
  console.log("");
  rl.close();
  return pw;
}

/**
 * ⚠️ Goes through findUserWithFactors, not listUsers — the latter omits
 * `factors`, so `--check` reported "MFA not enrolled" for accounts that had a
 * verified authenticator.
 */
async function findByEmail(email: string) {
  return (await findUserWithFactors(email)) ?? undefined;
}

async function main() {
  const email = (arg("email") ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) fail("Pass --email <address>");

  const domain = email.split("@")[1] ?? "";
  if (!env.allowedEmailDomains.includes(domain)) {
    fail(
      `${domain} is not in ALLOWED_EMAIL_DOMAINS (${env.allowedEmailDomains.join(", ")}).\n` +
        "  The account would be created but could never sign in — requireAuth rejects it.",
    );
  }

  const existing = await findByEmail(email);

  if (flag("check")) {
    console.log(`\n${email}`);
    if (!existing) {
      console.log("  ✗ no account");
    } else {
      console.log(`  ✓ exists      id=${existing.id}`);
      console.log(`    confirmed   ${existing.email_confirmed_at ? "yes" : "NO — cannot sign in"}`);
      console.log(`    last sign-in ${existing.last_sign_in_at ?? "never"}`);
      const verified = (existing.factors ?? []).filter((f) => f.status === "verified");
      console.log(`    MFA         ${verified.length ? `${verified.length} factor(s)` : "not enrolled"}`);
    }
    console.log("");
    return;
  }

  if (!flag("confirm")) {
    fail("Refusing to write without --confirm. Add --check to inspect instead.");
  }

  const password = await readPassword();
  if (!password) fail("No password given.");

  const verdict = assessPassword(password);
  if (!verdict.ok) {
    console.warn("\n⚠️  WEAK PASSWORD — this account can sign into the whole dashboard:");
    for (const p of verdict.problems) console.warn(`      • ${p}`);
    console.warn("    A password manager entry of 20+ random characters costs nothing to use here.");
    if (!flag("force")) {
      fail("Refusing to set it. Use a stronger password, or --force if you accept the risk.");
    }
    console.warn("    --force given; proceeding anyway.\n");
  }

  if (existing && flag("reset")) {
    const { error } = await supabase.auth.admin.updateUserById(existing.id, { password });
    if (error) fail(`Password update failed: ${error.message}`);
    console.log(`\n✓ password reset for ${email} (id=${existing.id})\n`);
    return;
  }

  if (existing) {
    fail(`${email} already exists (id=${existing.id}). Add --reset to change its password.`);
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    // Pre-confirmed: public signup is disabled and this is a deliberate,
    // out-of-band provisioning step, so there is no address to verify that we
    // did not already choose.
    email_confirm: true,
  });
  if (error) fail(`Create failed: ${error.message}`);
  const created = data?.user;
  if (!created) fail("Create returned no user.");

  console.log(`\n✓ created ${email} (id=${created.id})`);
  console.log("  Every authenticated user has the SAME access — there is no role model yet.");
  console.log("  Next: have them enrol MFA, and grant Duda editor access separately with");
  console.log(`    npm run duda:editor-provision --workspace=backend -- --email ${email} --supabase-user-id ${created.id} --confirm\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
