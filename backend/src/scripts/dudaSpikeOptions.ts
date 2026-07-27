/**
 * WRITE-CAPABLE investigation spike. Run with:
 *   npm run duda:spike-options -- --confirm
 *
 * Answers the questions that gate the options/variations editor design:
 *   A. Can a product attach a store-level option but expose only a SUBSET of
 *      its choices?  (HARD GATE — if no, per-product options are impossible
 *      within the 20-option catalog cap.)
 *   B. Do variation IDs (and their SKUs) survive an option change?
 *   C. Does product PATCH images:[{url}] re-host an external URL onto Duda's
 *      CDN directly, making the /resources/upload hop optional?
 *   D. Is an already-Duda-hosted URL returned byte-identical on repeat PATCH?
 *   E. Is variation regeneration synchronous with the PATCH response?
 *   F. Assorted cheap confirmations (see printed report).
 *
 * SAFETY (see CLAUDE.md "Verification / testing policy"):
 *   - EX Heater is DENY-listed; any attempt to target it aborts the run.
 *   - Everything is created fresh and torn down in a `finally`, in reverse.
 *   - Options are STORE-LEVEL, so a leaked test option is live catalog
 *     pollution that also consumes one of the 20 slots. We snapshot the
 *     catalog before and after and diff it to prove we left nothing behind.
 */
import { env } from "../env.js";

const site = env.DUDA_SITE_NAME;
const base = env.DUDA_API_BASE_URL;
const auth = "Basic " + Buffer.from(`${env.DUDA_API_USER}:${env.DUDA_API_PASS}`).toString("base64");

/** Live products that must never be touched by this script. */
const DENY = new Set(["01KW9R473XZGWZWC5206EPYAWB"]); // EX Heater

/** A real, stable, publicly-reachable external image for the ingest test (C). */
const EXTERNAL_IMAGE = "https://saequip.com/wp-content/themes/saequip/images/black-check-box-with-white-check.png";

const findings: string[] = [];
function record(key: string, answer: string) {
  findings.push(`${key}: ${answer}`);
  console.log(`\n  ==> ${key}: ${answer}`);
}

function guard(path: string) {
  for (const id of DENY) {
    if (path.includes(id)) throw new Error(`ABORT: refusing to touch DENY-listed product ${id}`);
  }
}

type Res<T> = { status: number; body: T | undefined; raw: string };

async function req<T = unknown>(method: string, path: string, body?: unknown): Promise<Res<T>> {
  if (method !== "GET") guard(path);
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      Authorization: auth,
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const raw = await res.text();
  let parsed: T | undefined;
  try {
    parsed = raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    parsed = undefined;
  }
  const label = `[${res.status}] ${method} ${path.replace(`/sites/multiscreen/`, "")}`;
  console.log(`${label}${body !== undefined ? ` <- ${JSON.stringify(body).slice(0, 220)}` : ""}`);
  if (!res.ok) console.log(`      ! ${raw.slice(0, 300).replace(/\s+/g, " ")}`);
  return { status: res.status, body: parsed, raw };
}

// --- shapes ---
interface Choice { id: string; value: string }
interface Option { id: string; name: string; type: string; choices: Choice[] }
interface Variation {
  id: string;
  sku: string;
  price_difference: string;
  status: string;
  options: { option_id: string; option_name: string; choice_id: string; choice_value: string }[];
}
interface Product {
  id: string;
  name: string;
  sku: string;
  status: string;
  quantity?: number;
  images: { alt: string; url: string }[];
  options: Option[];
  variations: Variation[];
  seo: { product_url: string; title: string; description: string };
}
interface OptionList { results: Option[]; total_responses: number }

const P = {
  products: `/sites/multiscreen/${site}/ecommerce/products`,
  product: (id: string) => `/sites/multiscreen/${site}/ecommerce/products/${id}`,
  variation: (pid: string, vid: string) =>
    `/sites/multiscreen/${site}/ecommerce/products/${pid}/variations/${vid}`,
  options: `/sites/multiscreen/${site}/ecommerce/options`,
  option: (oid: string) => `/sites/multiscreen/${site}/ecommerce/options/${oid}`,
  choices: (oid: string) => `/sites/multiscreen/${site}/ecommerce/options/${oid}/choices`,
  choice: (oid: string, cid: string) =>
    `/sites/multiscreen/${site}/ecommerce/options/${oid}/choices/${cid}`,
};

function variationSummary(p: Product | undefined): string {
  if (!p) return "(no product body)";
  const combos = (p.variations ?? []).map(
    (v) => `${v.options.map((o) => o.choice_value).join("/")}${v.sku ? ` sku=${v.sku}` : ""}`,
  );
  return `${p.variations?.length ?? 0} variations: ${combos.join(" | ") || "(none)"}`;
}

// ---------------------------------------------------------------------------

if (!process.argv.includes("--confirm")) {
  console.log(`
This spike CREATES and DELETES real objects in the live Duda store "${site}".

It will:
  1. snapshot the store-level option catalog
  2. create a HIDDEN product "ZZ-SPIKE-DELETE-ME"
  3. create a store-level option "ZZ Spike Voltage" with 3 choices
  4. probe option attachment / choice subsetting / variation regeneration
  5. probe image URL ingest
  6. delete everything it created and diff the option catalog

EX Heater (${[...DENY].join(", ")}) is DENY-listed and cannot be touched.

Re-run with --confirm to execute.
`);
  process.exit(0);
}

let productId: string | undefined;
let optionId: string | undefined;
let catalogBefore: Option[] = [];

try {
  console.log(`\n=== 0. Option catalog snapshot (BEFORE) ===`);
  const before = await req<OptionList>("GET", P.options);
  catalogBefore = before.body?.results ?? [];
  console.log(`      ${catalogBefore.length} options: ${catalogBefore.map((o) => o.name).join(", ")}`);
  record("F/catalog-size-before", `${catalogBefore.length} of max 20`);

  console.log(`\n=== 1. Create throwaway product (F: minimum POST body) ===`);
  const created = await req<Product>("POST", P.products, {
    name: "ZZ-SPIKE-DELETE-ME",
    prices: [{ price: "1.00" }],
    status: "HIDDEN",
  });
  productId = created.body?.id;
  if (!productId) throw new Error(`could not create test product: ${created.raw.slice(0, 300)}`);
  console.log(`      created ${productId}`);
  record("F/create-min-body", `{name, prices:[{price}], status} accepted -> ${created.status}`);
  record(
    "F/quantity-on-read",
    Object.prototype.hasOwnProperty.call(created.body ?? {}, "quantity")
      ? `present (${created.body?.quantity})`
      : "ABSENT from read shape (write-only)",
  );
  record(
    "F/seo-autoslug",
    created.body?.seo?.product_url ? `auto-set to "${created.body.seo.product_url}"` : "empty",
  );

  console.log(`\n=== 2. Create store-level option with 3 choices ===`);
  const optRes = await req<Option>("POST", P.options, {
    name: "ZZ Spike Voltage",
    type: "TEXT",
    choices: ["110V", "240V", "440V"],
  });
  optionId = optRes.body?.id;
  if (!optionId) throw new Error(`could not create test option: ${optRes.raw.slice(0, 300)}`);
  const allChoices = optRes.body?.choices ?? [];
  console.log(`      option ${optionId} choices: ${allChoices.map((c) => `${c.value}=${c.id}`).join(", ")}`);

  // ---- QUESTION A: choice subsetting ----
  console.log(`\n=== 3. QUESTION A — attach option with only 2 of 3 choices ===`);
  const subset = allChoices.slice(0, 2);
  const attachShapes: { label: string; options: unknown }[] = [
    {
      label: "[{id, choices:[{id}]}]",
      options: [{ id: optionId, choices: subset.map((c) => ({ id: c.id })) }],
    },
    {
      label: "[{id, name, type, choices:[{id, value}]}] (full echo, subset choices)",
      options: [
        {
          id: optionId,
          name: "ZZ Spike Voltage",
          type: "TEXT",
          choices: subset.map((c) => ({ id: c.id, value: c.value })),
        },
      ],
    },
    { label: "[{id}] (bare reference)", options: [{ id: optionId }] },
  ];

  let workingShape: string | undefined;
  let subsetWorks: boolean | undefined;

  for (const shape of attachShapes) {
    console.log(`\n   -- trying shape: ${shape.label}`);
    const patch = await req("PATCH", P.product(productId), { options: shape.options });
    if (patch.status < 200 || patch.status >= 300) continue;

    const after = await req<Product>("GET", P.product(productId));
    const attached = after.body?.options ?? [];
    const attachedChoiceCount = attached[0]?.choices?.length ?? 0;
    console.log(`      attached options: ${attached.length}, choices on it: ${attachedChoiceCount}`);
    console.log(`      ${variationSummary(after.body)}`);

    if (attached.length > 0 && !workingShape) {
      workingShape = shape.label;
      subsetWorks = attachedChoiceCount === subset.length;
      record(
        "E/regeneration-sync",
        (after.body?.variations?.length ?? 0) > 0
          ? "SYNCHRONOUS — variations present in the immediate re-GET"
          : "variations EMPTY on immediate re-GET (may be eventual)",
      );
      break;
    }
  }

  record("A/attach-payload-shape", workingShape ?? "NONE of the tried shapes attached an option");
  record(
    "A/choice-subsetting",
    subsetWorks === undefined
      ? "UNDETERMINED (attach failed)"
      : subsetWorks
        ? `YES — asked for ${subset.length} of ${allChoices.length}, product exposes ${subset.length}`
        : `NO — asked for ${subset.length} of ${allChoices.length}, product exposes ALL ${allChoices.length}`,
  );

  // ---- QUESTION B: variation ID + SKU stability across an option change ----
  console.log(`\n=== 4. QUESTION B — do variation IDs/SKUs survive an option change? ===`);
  const preChange = await req<Product>("GET", P.product(productId));
  const firstVar = preChange.body?.variations?.[0];

  if (!firstVar) {
    record("B/variation-id-stability", "UNDETERMINED (no variations to stamp)");
  } else {
    const stampedSku = "SPIKE-SKU-001";
    await req("PATCH", P.variation(productId, firstVar.id), {
      sku: stampedSku,
      price_difference: "12.34",
    });
    const stamped = await req<Product>("GET", P.product(productId));
    const stampedOk = stamped.body?.variations?.some((v) => v.sku === stampedSku);
    record(
      "B/variation-patch",
      stampedOk ? `sku+price_difference persisted on ${firstVar.id}` : "variation PATCH did NOT persist",
    );
    const idsBefore = (stamped.body?.variations ?? []).map((v) => v.id);

    console.log(`\n   -- adding a 3rd choice to the shared option, then re-reading the product`);
    const addCh = await req<Choice>("POST", P.choices(optionId), { value: "690V" });
    record(
      "F/choice-add",
      addCh.status < 300 ? `POST .../choices accepted -> ${addCh.status}` : `FAILED (${addCh.status})`,
    );

    const afterChange = await req<Product>("GET", P.product(productId));
    const idsAfter = (afterChange.body?.variations ?? []).map((v) => v.id);
    const survivors = idsAfter.filter((id) => idsBefore.includes(id));
    const skuSurvived = afterChange.body?.variations?.some((v) => v.sku === stampedSku);
    console.log(`      ${variationSummary(afterChange.body)}`);
    record(
      "B/variation-id-stability",
      `${survivors.length}/${idsBefore.length} original IDs survived; stamped SKU ${skuSurvived ? "SURVIVED" : "LOST"}`,
    );
    record(
      "B/choice-propagation",
      `product now exposes ${afterChange.body?.options?.[0]?.choices?.length ?? 0} choices ` +
        `(a 3rd choice was added to the SHARED option${subsetWorks ? " while the product had subset 2" : ""})`,
    );
  }

  // ---- QUESTION C/D: image ingest ----
  console.log(`\n=== 5. QUESTION C — does product PATCH re-host an external image URL? ===`);
  const imgPatch = await req("PATCH", P.product(productId), {
    images: [{ url: EXTERNAL_IMAGE, alt: "spike ingest test" }],
  });
  if (imgPatch.status >= 200 && imgPatch.status < 300) {
    const withImg = await req<Product>("GET", P.product(productId));
    const url = withImg.body?.images?.[0]?.url ?? "";
    console.log(`      stored url: ${url}`);
    const rehosted = url.includes("cdn-website.com") || url.includes("irp.cdn");
    record(
      "C/patch-rehosts-external-url",
      rehosted
        ? "YES — Duda re-hosted onto its CDN; /resources/upload hop is OPTIONAL"
        : `NO — stored as-is (${url.slice(0, 80)}); /resources/upload hop is REQUIRED`,
    );

    console.log(`\n=== 6. QUESTION D — is a Duda-hosted URL stable on repeat PATCH? ===`);
    await req("PATCH", P.product(productId), { images: [{ url, alt: "spike ingest test" }] });
    const again = await req<Product>("GET", P.product(productId));
    const url2 = again.body?.images?.[0]?.url ?? "";
    record(
      "D/url-stability-on-repatch",
      url2 === url ? "STABLE — byte-identical" : `CHANGED\n        was: ${url}\n        now: ${url2}`,
    );
  } else {
    record("C/patch-rehosts-external-url", `UNDETERMINED — images PATCH returned ${imgPatch.status}`);
  }

  // ---- QUESTION F: does options:[] detach? ----
  console.log(`\n=== 7. F — does PATCH options:[] detach and clear variations? ===`);
  const detach = await req("PATCH", P.product(productId), { options: [] });
  if (detach.status >= 200 && detach.status < 300) {
    const cleared = await req<Product>("GET", P.product(productId));
    record(
      "F/detach-all",
      `options=${cleared.body?.options?.length ?? 0}, variations=${cleared.body?.variations?.length ?? 0}`,
    );
  } else {
    record("F/detach-all", `PATCH options:[] returned ${detach.status}`);
  }

  // ---- QUESTION F: choice PUT/DELETE existence, page size ----
  console.log(`\n=== 8. F — choice PUT/DELETE existence + product page size ===`);
  const chList = await req<Option>("GET", P.option(optionId));
  const lastChoice = chList.body?.choices?.at(-1);
  if (lastChoice) {
    const delCh = await req("DELETE", P.choice(optionId, lastChoice.id));
    record(
      "F/choice-delete",
      delCh.status < 300 ? `exists -> ${delCh.status}` : `NOT available (${delCh.status})`,
    );
  }
  const bigPage = await req<{ results: unknown[]; limit: number; total_responses: number }>(
    "GET",
    `${P.products}?limit=1000&offset=0`,
  );
  record(
    "F/max-page-size",
    `asked limit=1000, server echoed limit=${bigPage.body?.limit}, returned ${bigPage.body?.results?.length} of ${bigPage.body?.total_responses}`,
  );
} catch (err) {
  console.error(`\n!!! SPIKE ABORTED: ${err instanceof Error ? err.message : String(err)}`);
} finally {
  console.log(`\n=== TEARDOWN (reverse order) ===`);
  if (productId) {
    const d = await req("DELETE", P.product(productId));
    console.log(`      product ${productId} delete -> ${d.status}`);
  }
  if (optionId) {
    const d = await req("DELETE", P.option(optionId));
    console.log(`      option ${optionId} delete -> ${d.status}`);
  }

  const after = await req<OptionList>("GET", P.options);
  const namesBefore = catalogBefore.map((o) => o.id).sort();
  const namesAfter = (after.body?.results ?? []).map((o) => o.id).sort();
  const leaked = namesAfter.filter((id) => !namesBefore.includes(id));
  const lost = namesBefore.filter((id) => !namesAfter.includes(id));

  console.log(`\n=== OPTION CATALOG DIFF ===`);
  console.log(`      before: ${namesBefore.length}   after: ${namesAfter.length}`);
  if (leaked.length === 0 && lost.length === 0) {
    console.log(`      ✅ CLEAN — catalog identical, nothing leaked or lost`);
  } else {
    if (leaked.length) console.log(`      ❌ LEAKED (delete these manually): ${leaked.join(", ")}`);
    if (lost.length) console.log(`      ❌ LOST pre-existing options: ${lost.join(", ")}`);
  }

  console.log(`\n=========== FINDINGS ===========`);
  for (const f of findings) console.log(`  ${f}`);
  console.log(`================================\n`);
}
