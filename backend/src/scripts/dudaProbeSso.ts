/**
 * Read-only probe for Duda's ACCOUNT-scoped API paths.
 *
 * Why this exists: services/duda.ts's site paths needed a `/multiscreen/`
 * segment that isn't obvious, and omitting it 404s with RESTEASY003210 (see
 * CLAUDE.md). The account/SSO paths in services/dudaSso.ts were written from
 * the documented shapes, so this verifies each one against the live API before
 * anything is built on top of them.
 *
 * How to read the output: a 404 whose body mentions RESTEASY003210 / "Could
 * not find resource" means the PATH is wrong. Any other error (e.g. "account
 * not found") means the path resolved and Duda simply rejected the argument —
 * which is what we want, since we probe with an account that doesn't exist.
 *
 * Safe to run: GETs only, no writes. Uses a deliberately nonexistent account.
 *
 *   npm run duda:probe-sso --workspace=backend
 */
import { env } from "../env.js";
import { DUDA_SSO_PATHS } from "../services/dudaSso.js";

const FAKE_ACCOUNT = "zz-nonexistent-probe-account@example.invalid";
const REAL_SITE = "099434f3";

function authHeader(): string {
  const token = Buffer.from(`${env.DUDA_API_USER}:${env.DUDA_API_PASS}`).toString("base64");
  return `Basic ${token}`;
}

async function probe(label: string, path: string): Promise<void> {
  const url = `${env.DUDA_API_BASE_URL}${path}`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: authHeader(), Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await res.text().catch(() => "")).slice(0, 300);
    const routeMissing = /RESTEASY003210|Could not find resource/i.test(body);
    const verdict = res.ok
      ? "OK (200)"
      : routeMissing
        ? "*** WRONG PATH (route not found) ***"
        : "path resolved (argument rejected, as expected)";
    console.log(`\n[${label}]`);
    console.log(`  GET ${path}`);
    console.log(`  status: ${res.status}  -> ${verdict}`);
    console.log(`  body:   ${body || "(empty)"}`);
  } catch (err) {
    console.log(`\n[${label}]`);
    console.log(`  GET ${path}`);
    console.log(`  FETCH FAILED: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function main() {
  console.log("Probing Duda account-scoped paths (read-only)…");
  console.log(`Base: ${env.DUDA_API_BASE_URL}`);
  console.log(`Fake account: ${FAKE_ACCOUNT}`);

  await probe("getAccount", DUDA_SSO_PATHS.account(FAKE_ACCOUNT));
  // NOTE: `/accounts/{name}/sites` was probed and 404s with RESTEASY003210 —
  // there is no account-level site listing at that path, which is why
  // dudaSso.getSitePermissions() asks about one site instead.
  await probe(
    "ssoLink (EDITOR)",
    `${DUDA_SSO_PATHS.ssoLink(FAKE_ACCOUNT)}?${new URLSearchParams({
      target: "EDITOR",
      site_name: REAL_SITE,
    }).toString()}`,
  );
  await probe(
    "sitePermissions (GET, to validate path shape)",
    DUDA_SSO_PATHS.sitePermissions(FAKE_ACCOUNT, REAL_SITE),
  );
  // Real site, so this one should genuinely succeed and also gives us the
  // metadata shape the Website Editor page will render.
  await probe("getSiteDetails (REAL site)", DUDA_SSO_PATHS.site(REAL_SITE));

  console.log("\nDone. Any '*** WRONG PATH ***' above needs the PATHS const in services/dudaSso.ts corrected.");
}

void main();
