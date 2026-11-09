# Runbook: user invites, super admin and required 2FA

**For:** whoever rolls it out.

**What the migration does** (`backend/prisma/migrations/20261109170000_user_invites/migration.sql`):
- creates the `UserInvite` table;
- adds a nullable `grantedBy` column to `DudaEditorSiteAccess`.

Nothing is dropped and no rows change. The code live before it ignores both.

The procedure is [`13-enquiry-read-star-runbook.md`](13-enquiry-read-star-runbook.md)'s, and so are the hard rules: only `migrate deploy`, never a shadow database, never `migrate dev`, `reset` or `db push`. Run from `backend/`, with the connection strings loaded as in step 0 there.

## 1. Back up first

Dump the whole database to `~/saequip-backups`, as in runbook 13's step 1. Note the counts:

```sh
psql "$DIRECT_URL" -c 'SELECT (SELECT count(*) FROM "DudaEditorAccount") AS editor_accounts, (SELECT count(*) FROM "DudaEditorSiteAccess") AS editor_sites;'
```

## 2. Check the history

The newest row in `_prisma_migrations` is `20261109150000_enquiry_notes`, finished and not rolled back. `npx prisma migrate status` lists exactly one pending migration: `20261109170000_user_invites`. **Stop if not.**

## 3. Apply, then verify

```sh
npx prisma migrate deploy
psql "$DIRECT_URL" -c '\d "UserInvite"'
psql "$DIRECT_URL" -c "SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = 'DudaEditorSiteAccess' AND column_name = 'grantedBy';"
psql "$DIRECT_URL" -c 'SELECT (SELECT count(*) FROM "DudaEditorAccount") AS editor_accounts, (SELECT count(*) FROM "DudaEditorSiteAccess") AS editor_sites;'
psql "$DATABASE_URL" -Atc "SELECT has_table_privilege(current_user, 'public.\"UserInvite\"', 'SELECT'), has_table_privilege(current_user, 'public.\"UserInvite\"', 'INSERT'), has_table_privilege(current_user, 'public.\"UserInvite\"', 'UPDATE');"
```

Expected:
- the table has twelve columns, a unique `tokenHash` and two indexes;
- `grantedBy` is nullable;
- the editor counts match step 1;
- the app's own login answers `t|t|t`.

## 4. Push the code

Nothing changes for existing users: there is no super admin yet, and no account has 2FA required.

## 5. Make Josh super admin (with his OK)

```sh
npm run users:admin --workspace=backend -- --email josh@kangaroouk.com --check
npm run users:admin --workspace=backend -- --email josh@kangaroouk.com --super-admin          # dry run
npm run users:admin --workspace=backend -- --email josh@kangaroouk.com --super-admin --confirm
```

⚠️ This also makes 2FA required on his account, and he has none yet. His next dashboard load sends him to **/setup-2fa**, where he needs an authenticator app on his phone. Nothing else works until that's done. If he loses the phone later, `users:mfa -- --reset --confirm` is the way back in, so he should add a second device on Security.

## 6. Try it end to end

1. On Users: **Invite user** → `josh+invitetest@kangaroouk.com`, tick **Give Website Editor access** → copy the link.
2. In a private window: open the link → names and a password → **Create account** → /setup-2fa → scan the code → the dashboard.
3. Before step 2's 2FA, check that the API refuses the account (every page fails until 2FA is set up). After it, check that **Website Editor** opens Duda's editor.
4. Back on Users: **Disable access** on the test account. Then confirm Duda holds nothing for it:
   `npm run duda:editor-provision --workspace=backend -- --email josh+invitetest@kangaroouk.com --check`
5. Delete the test account in Supabase (Authentication → Users), or ask for a CLI delete.

## Roll back

Revert the code first. Then:

```sh
psql "$DIRECT_URL" -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
DROP TABLE IF EXISTS "UserInvite";
ALTER TABLE "DudaEditorSiteAccess" DROP COLUMN IF EXISTS "grantedBy";
DELETE FROM "_prisma_migrations" WHERE migration_name = '20261109170000_user_invites';
COMMIT;
SQL
```

To remove the role and the requirement from an account afterwards: `users:admin --revoke-super-admin --confirm`. That leaves `mfa_required`, which is harmless once 2FA is set up.
