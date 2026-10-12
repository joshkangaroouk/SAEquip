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
- [ ] Reloading on the 2FA code step strands the user. Pages using raw `apiFetch` miss
  `mfa_required`.
- [ ] Keyboard access: clickable table rows have no link or button, and `SelectMenu` has no
  keyboard support.
- [ ] `Modal` can't scroll, has no focus management and no `aria-labelledby`.

## Phase 3: scripts and safety guards

- [ ] `duda:sync-categories --confirm` with an empty Hub empties every Duda category. Its dry
  run writes the mirror, and an empty category list deletes every mirror row.
- [ ] The destructive-DB guard hook misses:
  - heredocs fed to bash, node or psql
  - commands after a `<<<` here-string
  - `prisma@<version>`
- [ ] Imports unsafe to re-run against live data:
  - `--descriptions --confirm` overwrites editor edits
  - `downloads:import --force` recreates rows ungated and untyped
  - `duda:assign-product-types` clears hand assignments

## Phase 4: public site and widgets

- [ ] The 3D viewer is not a real modal. Opening it twice and pressing Escape leaves the page
  unable to scroll.
- [ ] The Arabic request form scrolls ~10,000px sideways (the honeypot's `left:-9999px`
  inside a right-to-left scroll box).
- [ ] The translation overlay has no time limit on its table load. One live request took 57s.
- [ ] The translation validator ignores a dropped minus sign and numbers the translation adds.
- [ ] The quote basket merges lines with different options when the choice ids are missing.

## Phase 5: dependencies

- [ ] `npm audit` reports 9 production advisories, all with fixes available: proxy-addr,
  brace-expansion, compression/serve, source-map-js, fast-uri, ip-address, qs, dompurify.

## Phase 6: low

**Security and privacy**
- [ ] Rate-limit rows (visitor IPs) are never deleted: `sweepExpiredRateLimits()` has no caller.
- [ ] `.gitignore` misses `.env.local` and `.env.production`.
- [ ] Remove the unused `staffToken()` with its hard-coded test credential (`mediaVerifyUpload.ts`).
- [ ] The CSP is report-only and has nowhere to report.
- [ ] The dashboard loads model-viewer without an SRI hash.
- [ ] Require `elapsedMs` and the honeypot field on `/public/quotes`.
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
