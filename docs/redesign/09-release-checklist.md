# Release checklist: `redesign/ui` → `main`

**For:** Josh, on release day.
**What ships:** the whole dashboard redesign (batches 1 to 10), plus the batch 6 backend pieces: the handled routes, `GET /api/enquiries/counts`, the slug on `GET /api/products`, and the site's SEO and languages on `/api/website/sites`. The public widget and the Duda widgets are not part of it.

Work through the steps in order, and don't skip ahead: the order is what keeps production working. If more commits land on `redesign/ui` before you release, run steps 2 and 3 again on the newest preview.

⚠️ **Batch 10 changed where things are in the product editor**, and this checklist now describes it: Save is in the band at the top of the editor (not a bar along the bottom), and the Accessory toggle and the categories are in the side panel. The branch on GitHub stops at batch 9 (906a3e5); batch 10 is local until step 2.

Run every command from the repo root unless a step says otherwise.

## 0. Park your own uncommitted work

`CLAUDE.md` differs between `main` and `redesign/ui`, so Git won't switch branches while your own edits to it (the "Both" Hire/Purchase notes) are uncommitted. Commit them, or stash just that file:

```sh
git status --short
git stash push -m "josh: Both Hire/Purchase notes" -- CLAUDE.md
```

Bring them back after step 4 with `git stash pop`. Your other pending files don't block a switch, so they can stay where they are: `backend/package.json` and `catalogueOldSiteOptions.ts` are the same on both branches, and the rest are untracked.

## 1. Apply the migration

Follow [`06b-migration-runbook.md`](06b-migration-runbook.md) from start to finish: back up, check `_prisma_migrations`, `migrate deploy`, verify.

- **Don't merge until the runbook's step 4 shows all four columns.** The enquiry pages and the sidebar badges read `handledAt`, so the new code errors without them.
- The current production code ignores the new columns, so applying the migration first is safe.

## 2. Push the branch

```sh
git checkout redesign/ui
git push origin redesign/ui
```

- The push is a fast-forward of `origin/redesign/ui` (it carries batch 10). The pre-push hook runs `npm run check` first (about 12 seconds).
- Vercel builds a **Preview** deployment of the branch. Find its URL in the Vercel dashboard (project `sa-equip-backend` → Deployments), or in the deployment status on the branch in GitHub.

## 3. Check the preview with your real login

⚠️ **The preview uses the production database and the live Duda site.** Everything you save in this step is real. That's why the edit test uses a throwaway product.

Before you start:

- **Environment variables.** CLAUDE.md suggests leaving `SUPABASE_SERVICE_ROLE_KEY` and `DUDA_API_PASS` unset on Preview. If they are unset (Vercel → Settings → Environment Variables), the preview's API can't write. Then either:
  - do the read-only checks here, and the edit and mark-handled checks straight after the merge (step 6), or
  - add the two variables to Preview for this check, redeploy the preview, and remove them afterwards.
- **Deployment Protection.** If it's on, Vercel asks you to sign in to Vercel before the preview opens.
- **Read-only smoke test.** Optional, and only works if Deployment Protection is off for the preview:

  ```sh
  node scripts/smoke.mjs https://<preview-url>
  ```

Sign in with your own account (and your 2FA code). Then:

1. **Theme saves to your account.**
   - Switch the top bar to **Dark** and reload. It should still be dark.
   - Sign out, then sign in again (or open the preview in another browser). It should still be dark.
   - Switch back to whichever theme you prefer.
2. **2FA QR code sits on paper.** Stay in the dark theme and open **Security**.
   - Press **Turn on two-factor** (or **Add another device** if 2FA is already on).
   - The QR code should be on a white tile and scannable.
   - Press **Cancel**. Don't scan it: Cancel removes the half-finished authenticator.
3. **One full edit cycle on a throwaway product.**
   - **Products → New product.**
     - Name `ZZ-AUDIT-DELETE-ME`, SKU `ZZ-AUDIT`. Leave the status **Hidden**.
     - Type one sentence in Description, then press **Create and edit**.
     - In Chrome a "Saving for multi-languages…" dialog opens. Press **Skip for now**, so no translations of test text are stored.
   - In the editor, make one change on every tab and in the side panel, then press **Save changes** once. It is in the band at the top of the editor, which stays in view as you scroll (from 1024px wide):

     | Tab | Change |
     |---|---|
     | Overview | Change the name to `ZZ-AUDIT-DELETE-ME 2`. |
     | Content | Add a description sentence, a technical spec row, a key benefit and an application. Add one compatible product. |
     | Compliance | Switch on one SA logo and one certification logo. |
     | Options | **Attach option** → Hire/Purchase, then untick one of its values. ⚠️ Don't type in **New value…**: that adds a value to the shared option for every product, straight away. |
     | Files & media | **Add from Media** → pick an existing image. **+ Add download** → pick an existing PDF and choose its type. Don't upload new files: uploads stay in Media after the product is deleted. |
     | SEO | Edit the title. The counters and the search preview should update as you type. |
     | Side panel | Visibility: leave **Hidden** selected, and switch on "This product is an accessory". Categories: **Edit** → tick one site challenge → **Done**; it shows as a chip. |

   - Each tab's dot should show while it has unsaved changes, and the band should count the unsaved sections. Pressing Save should report "Saved N sections", clear every dot and the count. Press **Skip for now** if the translation dialog opens.
   - Reload the page. Every change should still be there.
   - **Overview → Delete product → Delete…**, type the name exactly, then **Delete permanently**. You should land back on Products, with the product gone from the list.
4. **Mark one enquiry handled, then back.**
   - On **Quote requests**, open any request and press **Mark as handled**.
   - Status should read "Handled … by you", and the sidebar badge should go down by one.
   - Press **Mark as new**. The badge goes back up. Nothing has changed overall.
5. **Every page in both themes.** In the light theme, then again in the dark:
   - Website editor and Products
   - a product (open EX Heater and look at each tab, but **don't save it**)
   - New product (look only)
   - Categories and a category's own page
   - Product options, Media and Logos
   - Quote requests and Resource requests (open one of each)
   - Translations (both tabs)
   - Users, Security and Status
   - `/widgets` (not in the sidebar)

   Keep the browser console open while you go. There should be no red errors. The CSP is report-only, so a "[Report Only]" message is worth a note, but it doesn't break anything.

If anything fails here, stop. Don't merge.

## 4. Merge to `main`

The branch is a fast-forward of `main` (`main` hasn't moved since 1426d8b). Choose one of these.

**Fast-forward** (history stays linear):

```sh
git checkout main
git pull --ff-only
git merge --ff-only redesign/ui
git push origin main
```

**Merge commit** (one commit to revert later):

```sh
git checkout main
git pull --ff-only
git merge --no-ff redesign/ui -m "Merge redesign/ui: the dashboard redesign"
git push origin main
```

Then bring back your own work with `git stash pop`, if you stashed it in step 0. Keep `origin/redesign/ui`; don't delete it.

## 5. Watch the production deploy

- **Vercel → Deployments:** the production build of the merge commit should finish. A failed build leaves the previous deployment live.
- **GitHub → Actions → "Post-deploy smoke test":** it waits until production serves your commit, then runs the read-only smoke test. It emails you if it fails.
- **By hand**, once the build is live:

  ```sh
  curl -s https://sa-equip-backend.vercel.app/api/health   # "commit" should be the merge commit's sha
  npm run smoke
  ```

## 6. After the merge

At https://sa-equip-backend.vercel.app:

- Sign in. Check the sidebar's Quote requests and Resource requests badges, then open both pages. If they load, the migration is in place.
- If step 3's edit cycle and mark-handled check were skipped on the preview, do them now, exactly as written there.
- Spot-check three or four pages in each theme.
- Check that the live widget still answers:

  ```sh
  curl -s https://sa-equip-backend.vercel.app/public/widget.js | grep -o 'version: "[^"]*"'
  ```

  It should end in a hash, not `%BUILD%`. Then open https://saequip.multiscreensite.com/product/ex-heater. The logos, tabs and compatible carousel should all show.
- A dashboard tab left open from before the deploy is still running the old code. Reload it.

## 7. If something goes wrong: roll back

**Fastest:** in Vercel → Deployments, find the previous production deployment, then **⋯ → Instant Rollback**.
- Production goes back to the old code within seconds, with no Git change.
- Vercel then stops promoting new `main` deployments until you **undo the rollback** (or promote a deployment by hand).

**Then fix Git**, so `main` matches what's live:

```sh
git checkout main && git pull --ff-only
# after a merge commit:
git revert -m 1 <merge-commit-sha>
# after a fast-forward (reverts every redesign commit as one commit):
git revert --no-commit 1426d8b..HEAD && git commit -m "Revert the redesign release"
git push origin main
```

- **Leave the migration in place.** The old code ignores the four columns, so they're harmless. The runbook's step 5 (dropping them) is only for abandoning the feature altogether.
- Any enquiries marked handled while the new code was live keep their marks, and the old code simply doesn't show them.

## 8. Launch day (the move to saequip.com)

- `frontend/src/lib/site.ts`: set `LIVE_SITE_ORIGIN` to the custom domain. It drives every "View on website" link in the dashboard. Commit, push, and check one of those links.
- Then work through **"Launch checklist (staging → saequip.com)"** in CLAUDE.md, in its order:
  1. Turn "No index for the entire site" off, then republish.
  2. Re-enable the six languages.
  3. Run the pre-launch translation pass.
  4. Create `/privacy-policy`.
  5. Update every widget shim's URL and the basket's `ENDPOINT`.
  6. Set Supabase's Site URL and redirect list.
  7. Run "Refresh all languages from Duda".

## Known items that ship with this release (none block it)

- **The live widget's body text is below AA contrast**: `#878787` on white, 3.59:1. axe flags it on the `/widgets` previews, which copy the widget's CSS exactly. CLAUDE.md records it as a deliberate brand choice; changing it is a change to the live widget (`#767676` is the darkest grey that passes).
- **Menus portalled outside the page landmarks** (axe "region", moderate): the More menu and select lists are placed at the end of the page so nothing clips them.
- **Inner sideways scroll in the variations table at phone width.** Accepted (10 §6): it's a data grid. The page itself never scrolls sideways, and the editor's tab row scrolls in its own row (02a).
- **Enquiry route tests are still a scratch test.** They become a repo test once `backend/package.json` is free.
