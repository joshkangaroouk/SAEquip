# Runbook: the activity log (the super admin's Activity page)

**For:** whoever rolls it out.

**What the migration does** (`backend/prisma/migrations/20261118150000_activity_log/migration.sql`):
- Adds two tables, `ActivityEvent` and `ActivitySession`, with their indexes.
- Makes `ActivityEvent` **append-only for the app's login** (`saequip_app`): row level security with three policies, then `UPDATE` and `TRUNCATE` revoked:
  - read: any row;
  - add: any row;
  - delete: only rows older than 730 days.
- Nothing existing is touched.

⚠️ **The policies name `saequip_app`, so that role must exist.** It does in production (CLAUDE.md "The runtime role cannot do DDL").

⚠️ **The migration must go BEFORE the code.** The new code writes an `ActivityEvent` on every changing request and reads `ActivitySession` on every signed-in one. Deployed first, every write would fail. Those failures are caught, so no request breaks, but nothing is recorded until the tables exist.

The procedure is [`13-enquiry-read-star-runbook.md`](13-enquiry-read-star-runbook.md)'s, and so are the hard rules: only `migrate deploy`, never a shadow database, never `migrate dev`, `reset` or `db push`. Run from `backend/`, with the connection strings loaded as in step 0 there.

## 1. Back up first

Dump the whole database to `~/saequip-backups`, as in runbook 13's step 1.

## 2. Check the history

- The newest row in `_prisma_migrations` is `20261118120000_product_order`, finished and not rolled back.
- `npx prisma migrate status` lists exactly one pending migration: `20261118150000_activity_log`.

**Stop if not.**

## 3. Apply, then verify

```sh
npx prisma migrate deploy
psql "$DIRECT_URL" -Atc "SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('ActivityEvent','ActivitySession') ORDER BY 1;"
psql "$DIRECT_URL" -Atc "SELECT policyname, cmd, roles::text, coalesce(qual,'') FROM pg_policies WHERE tablename = 'ActivityEvent' ORDER BY 1;"
psql "$DATABASE_URL" -Atc "SELECT p, has_table_privilege(current_user, 'public.\"ActivityEvent\"', p) FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE']) p;"
psql "$DATABASE_URL" -Atc "SELECT has_table_privilege(current_user, 'public.\"ActivitySession\"', 'UPDATE');"
psql "$DIRECT_URL" -Atc "SELECT grantee FROM information_schema.role_table_grants WHERE table_name IN ('ActivityEvent','ActivitySession') AND grantee IN ('anon','authenticated','service_role');"
```

Expected:
- `ActivityEvent|t` (row level security on) and `ActivitySession|f`;
- three policies:
  - `ActivityEvent_app_add` INSERT;
  - `ActivityEvent_app_expire` DELETE with `(at < (now() - '730 days'::interval))`;
  - `ActivityEvent_app_read` SELECT;

  each for `{saequip_app}`;
- the app's login: SELECT `t`, INSERT `t`, UPDATE `f`, DELETE `t`, TRUNCATE `f`;
- `t` for `ActivitySession`;
- no rows for anon or authenticated.

Writes are not tried in production: the rules were proven on a throwaway database. There, update and truncate were refused, a recent delete removed 0 rows and a 3-year-old one 1.

## 4. Push the code

Then check the live site with `npm run smoke`.

## 5. Try it

1. Sign out of the Hub and sign in again. Open **Activity** (Admin group): "Signed in" with your IP and city is at the top. ⚠️ If it is missing, the access token carries no `session_id`. Nothing else is affected; say so, and sign-ins will need another way.
2. On a **throwaway** product, never EX Heater, change the name and a spec, then save. Each change shows with its before → after, grouped as one save.
3. Open a quote request: "Opened". Export the activity log as CSV: an "Exported the activity log" entry appears.

## Roll back

Revert the code first. Then:

```sh
psql "$DIRECT_URL" -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
DROP TABLE IF EXISTS "ActivityEvent";
DROP TABLE IF EXISTS "ActivitySession";
DELETE FROM "_prisma_migrations" WHERE migration_name = '20261118150000_activity_log';
COMMIT;
SQL
```
