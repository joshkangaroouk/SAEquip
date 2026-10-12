# Fixes from the whole-portal review (2026-10-12)

The review covered five parallel code reviews (public API, admin API, dashboard, `widget.js`,
and the Duda-pasted widgets with the scripts and schema), the earlier review of the distributor
widget, and live read-only checks. This file tracks the fixes, phase by phase.

**Rules:**
- One commit per fix.
- Each fix states how it was verified.
- Nothing is pushed until Josh says "push".
- Verification uses throwaways, never the live EX Heater.

Status: `[x]` done (commit noted) · `[ ]` to do · `[-]` decided not to fix (reason noted).

## Phase 1: fix first

- [x] **1. Duda ids escaped the catalogue** (`7f2ae53`). Route ids were pasted raw into Duda API paths.
  Express decodes `%2F` and `fetch` resolves `../`, so a signed-in user could make the
  agency credential act on any of ~871 client sites. Vercel forwards `%2F` undecoded (probed
  live), so this was reachable in production.
  - Fix: `seg()` in `services/duda.ts` checks every id against `DUDA_ID` and encodes it, and
    the error handler answers 400 `invalid_id`.
  - Verified with `npm run duda-ids:test` (in pre-push, 67 checks). With the guard removed,
    61 checks fail.
- [x] **2. `duda:import-products --rollback` ignored `--only`/`--limit`** and would have deleted
  95 of the 96 live products, EX Heater included.
  - Fix: the rollback is now:
    - scoped to the selection;
    - a dry run without `--confirm`;
    - for the whole ledger, refused unless given `--all --expect <exact count>`;
    - preceded by a snapshot of the Hub rows to `migration/`;
    - honest about deleted and failed counts.
  - Verified with the Duda API pointed at a dead port, so nothing could be deleted:
    - a scoped dry run listed 1 product, and an unscoped dry run listed 95;
    - unscoped `--confirm`, a wrong `--expect` and an `--only` matching nothing were each refused;
    - a scoped `--confirm` wrote its snapshot, the delete failed, and the ledger was unchanged.
  - The live catalogue still has 96 products afterwards.
- [x] **3a. 2FA login tried only the first verified authenticator**, so a backup device's codes
  were refused.
  - Fix: `verifyTotpCode()` in `lib/mfa.ts` tries each confirmed factor in turn.
- [x] **3b. Password reset for a 2FA user needs an aal2 session.**
  - Fix: `/reset-password` now asks for the code when the account has a factor, and handles an
    `insufficient_aal` reply the same way.
  - 3a and 3b: typechecked only.
  - **Josh to check in the browser:**
    - add a second device on `/security`, then sign in with a code from it;
    - send a reset to a 2FA account and complete it.
- [x] **4. Dropping several images kept only the last.** Uploads appended to a stale gallery,
  and the same bug reverted alt-text edits made during an upload.
  - Fix: `setSection` takes a function of the current slice; `ImagesSection` uses it, and
    `FileDropzone` calls the current handler through a ref.
  - Verified in a jsdom harness on the real components, dropping 3 files with uploads finishing
    at different times:
    - old code kept `[existing, c]`;
    - fixed code keeps `[existing, a, b, c]`.

## Phase 2: dashboard data loss and access

- [x] Edits typed while a save ran were overwritten.
  - Fix: a finished task banks only into a draft slice untouched since it was sent.
- [x] A variation edit was lost when options changed in the same save, but the toast said "Saved".
  - Fix: variations save first. If they fail, the option change refuses to run, and a section's
    first error is kept.
  - Both verified in a jsdom harness on the real `useProductEditor`, with the API stubbed.
    - Old code:
      - typing during a save was lost and read as clean;
      - the SKU edit was never sent.
    - Fixed code:
      - the edit stays and reads as unsaved;
      - the order is `variations` then `options`, and the SKU survives;
      - a failed variations save skips options and shows Duda's error.
- [x] Reloading on the 2FA code step stranded the user. Pages using raw `apiFetch` missed
  `mfa_required`.
  - Fix: `mfaPending` is derived from the session. `ProtectedRoute` and `Login` route on it, and
    `apiFetch` handles `mfa_required`.
  - Verified:
    - `sessionNeedsSecondFactor()` passed 7/7 against crafted tokens;
    - its rule matches supabase-js's own `getAuthenticatorAssuranceLevel`, which I read.
- [x] Keyboard access: clickable table rows had no link or button, and `SelectMenu` had no
  keyboard support.
  - Fix:
    - Products rows link to the product; Quotes, Resource Requests and Translations rows have a
      button;
    - `TR` skips a click that started on a control;
    - `SelectMenu` follows the select-only combobox pattern.
  - Verified in a jsdom harness on the real components (11/11):
    - `SelectMenu`: open, start on the selected option, arrows, End, type-ahead, Enter chooses,
      focus stays on the trigger, Escape closes without reaching `document`, options are not
      tab stops;
    - rows: the cell's button fires once and a plain-cell click still opens the row.
- [x] `Modal` couldn't scroll, had no focus management and no `aria-labelledby`.
  - Fix:
    - the panel is capped at the viewport and its body scrolls;
    - focus moves in, is trapped, and returns on close;
    - the dialog is labelled by its title and description;
    - only the top dialog in a stack handles Escape and Tab (Escape used to close every open
      dialog).
  - Verified:
    - a jsdom harness on the real `Modal` passed all 10 checks: focus in, labels, Tab and
      Shift+Tab wrap, Escape closes only the top dialog, focus and overflow restored;
    - a Vite build emits the `max-height` rules.
  - Josh to eyeball: a long DESCRIPTION translation in the edit dialog on a laptop.

## Phase 3: scripts and safety guards

- [x] `duda:sync-categories --confirm` with an empty Hub emptied every Duda category. An empty
  category list deleted every mirror row.
  - Fix: plan first, then write. `syncRefusal()` refuses an empty Hub, and a removal of more than
    a quarter of the links without `--allow-removals`. No categories from Duda means the mirror
    is left alone.
  - The dry run's mirror refresh is deliberate; I corrected the header that said it writes
    nothing.
  - Verified:
    - `script-guards:test` (10/10, in pre-push);
    - a live dry run is unchanged: 23 categories, 194 links in step, 0 to drop.
- [x] The destructive-DB guard hook missed:
  - heredocs fed to bash, node or psql
  - commands after a `<<<` here-string (and after a `$((1<<X))` shift)
  - `prisma@<version>`
  - Fix: heredoc bodies are checked when the line names an interpreter. Here-strings and
    arithmetic shifts no longer open a heredoc. The pattern allows `@<version>`.
  - Verified with 14 hook cases in `script-guards:test`: the new hook passes all 14, and the old
    hook fails the 6 gap cases.
- [x] Imports unsafe to re-run against live data:
  - `--descriptions --confirm` overwrote editor edits
    - Fix: `keepEditedDescription()`; `--force` overwrites after a snapshot.
  - `downloads:import --force` recreated rows ungated and untyped, and detached requests
    - Fix: `planDownloadSet()`, a keyed diff in which new rows are gated and typed.
    - `--verify` now flags ungated or untyped rows.
  - `duda:assign-product-types` cleared hand assignments
    - Fix: `planTypeLinks()` scopes the changes to the products it assigns, and the dry run
      lists them.
  - Verified:
    - `script-guards:test` now has 38 cases;
    - all live, read-only:
      - `downloads:import --verify` reconciles 176/176 as gated and typed;
      - the product-types dry run has 0 to add, 0 to remove and 0 left alone;
      - 94/94 descriptions are unedited today, so nothing was at risk yet.

## Phase 4: public site and widgets

- [x] The 3D viewer was not a real modal. Opening it twice and pressing Escape left the page
  unable to scroll.
  - Fix:
    - a named, modal dialog;
    - focus moves to the close button, is trapped, and returns to the opener;
    - a second open is a no-op.
  - Verified: `widget:test` passes 9 new checks (525 total). The old widget fails 6 of them,
    including the stuck `overflow: hidden`.
- [x] The Arabic request form scrolled ~10,000px sideways (the honeypot's `left:-9999px`
  inside a right-to-left scroll box).
  - Fix: the honeypot is clipped in place.
  - Verified in headless Chrome: the scroll width went from 10,620px in a 485px box to 485px,
    in both Arabic and English. `widget:test` pins the rule (516 checks).
- [x] The translation overlay had no time limit on its table load. One live request took 57s.
  - Fix:
    - a 2.5s limit, then English;
    - a translated request answered in English is `no-store`.
  - Verified: `i18n:test` (72 checks) stubs a load that never settles. It now answers in English
    after 2,504ms, and the cache headers are right in every case.
- [x] The translation validator ignored a dropped minus sign and numbers the translation added.
  - Fix:
    - an output-only number is refused;
    - each figure must carry a minus exactly as often as in the English.
  - Verified:
    - 7 new `i18n:test` cases (79 total): a dropped sign, a flipped sign, an added number, a
      kept minus, U+2212, a separator dash, a range;
    - the shipped validator over all 5,238 stored translations: 0 newly rejected.
- [x] The quote basket merged lines with different options when the choice ids were missing.
  - Fix: ids are compared only when both lines have them, otherwise the option text; an id match
    is tried first.
  - Verified:
    - 4 new `quote-widgets:test` checks (42 total); the old code fails all 4 (Purchase vanished);
    - `distributor-widget:test` passes 24/24.
  - **Josh to re-paste all three quote widgets (and the distributor JS) into Duda.**

## Phase 5: dependencies

- [x] `npm audit` reported 9 production advisories: proxy-addr, brace-expansion,
  compression/serve, source-map-js, fast-uri, ip-address, qs, dompurify.
  - Fix:
    - removed `serve` (only the old Railway `start` script used it; `start` is now
      `vite preview`);
    - `npm audit fix`;
    - Express 4.22.1 → 4.22.3 (published 2026-09-14), which moves its pinned `qs` to 6.16.
  - Verified:
    - `npm audit --omit=dev`: 0 vulnerabilities;
    - `npm run check` passes, and the frontend builds.
- [-] 9 advisories remain in dev-only tooling. They are fixed only by majors: Tailwind 3 → 4 (a
  config rewrite) and Vite 5 → 8. Neither runs in production; Vite's matter only for a dev
  server exposed on a network. Left for a planned upgrade.

## Phase 6: low

**Security and privacy**
- [x] Rate-limit rows (visitor IPs) were never deleted: `sweepExpiredRateLimits()` had no caller.
  - Fix: `increment()` runs the sweep on about 1 call in 20, unawaited and best-effort.
  - Verified: one manual sweep removed the 9 stored rows, all expired (0 were live).
- [x] `.gitignore` missed `.env.local` and `.env.production`.
  - Fix: `.env*` is ignored, except the `.env.example` files.
  - Verified: 6 variants are ignored and both examples are still tracked.
- [x] Removed the unused `staffToken()` and its hard-coded test credential (`mediaVerifyUpload.ts`).
- [ ] The CSP is report-only and has nowhere to report.
- [x] The dashboard loaded model-viewer without an SRI hash.
  - Fix: the widget's pinned sha384 plus `crossOrigin`, and a failed load is no longer cached.
  - Verified: the hash recomputed from the CDN matches.
- [x] Require `elapsedMs` and the honeypot field on `/public/quotes`.
  - Fix: both must be present, otherwise 400 (not a silent `{ok:true}`).
  - Verified: the live `/basket` page's widget sends both, which I read in the page source;
    typechecked.
  - Not exercised by an automated test, because the route writes rate-limit rows. **After
    deploy, Josh to place one clearly fake quote, then delete it.**
- [ ] Distributor widget: scheme-check the website and map links (`javascript:`).
- [-] RLS off and the global `cors()` on `/api`: defence in depth only, so left for now.

**Correctness**
- [ ] `stripAnchors` misses an unclosed `<a href>`, so the save fails with Duda's 403.
- [ ] A missing `/assets/*` file is served as `index.html` with an immutable year-long cache.
- [ ] Lead limits (30/hour/IP) are tight now that every download needs the form.
- [ ] A stale Hub slug blocks a new product with the same slug.
- [ ] Option-delete cascades can hit the 60s function limit.
- [ ] Malformed percent-encoding returns 500 instead of 400.

**Dashboard**
- [ ] "+ Create a subcategory" does nothing.
- [ ] Deleting a product with unsaved edits shows the unsaved-changes dialog.
- [ ] A category deleted in Duda makes a product's categories unsaveable.
- [ ] Switching language quickly on Translations can save text into the wrong language.
  `Logos` has the same race when switching tabs.
- [ ] A failed category drag discards unsaved form edits.
- [ ] A partial variations failure shows a raw error code.
- [ ] The products list loads every thumbnail eagerly.

**Quote widgets**
- [ ] With site data blocked, all three crash and the form submits as a GET with personal details
  in the URL.
- [ ] Focus is lost in the header popup and on basket re-renders.
- [ ] Quantity and line limits are not enforced before the server rejects the whole quote.

**widget.js**
- [ ] A late response can overwrite a newer render after re-init.
- [ ] The media-query listener leaks on every re-init.
- [ ] Async diagnostics land on the wrong `lastInit` record.
- [ ] Category mode rewrites `data-saeh-section`.
- [ ] A human submit under 1.5s gets the generic error.
- [ ] Focus can escape the request form via the backdrop.

**Housekeeping**
- [ ] Add the missing indexes: `SpecRow.hubProductId`, `ProductTextItem.hubProductId`,
  `QuoteRequestItem.quoteRequestId`, `QuoteRequest.createdAt`.
- [ ] Two stale comments: `storage.ts:74-77` and `public.ts:586`.
- [ ] The remaining 17 distributor-widget code-review points.
