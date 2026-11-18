# Runbook: product order (drag to order the website listing)

**For:** whoever rolls it out.

**What the migration does** (`backend/prisma/migrations/20261118120000_product_order/migration.sql`): adds a nullable `sortOrder` integer column to `HubProduct`. Nothing is dropped and no row changes. Every product starts unplaced (NULL), which lists A–Z, so the website's listing order does not change until someone drags.

⚠️ **The migration must go BEFORE the code.** The new code reads `HubProduct.sortOrder` in `GET /public/catalogue` (the website's listing) and `GET /api/products` (the Products page). Deployed first, both would fail until the column exists.

The procedure is [`13-enquiry-read-star-runbook.md`](13-enquiry-read-star-runbook.md)'s, and so are the hard rules: only `migrate deploy`, never a shadow database, never `migrate dev`, `reset` or `db push`. Run from `backend/`, with the connection strings loaded as in step 0 there.

## 1. Back up first

Dump the whole database to `~/saequip-backups`, as in runbook 13's step 1. Note the count:

```sh
psql "$DIRECT_URL" -c 'SELECT count(*) AS products FROM "HubProduct";'
```

## 2. Check the history

The newest row in `_prisma_migrations` is `20261109170000_user_invites`, finished and not rolled back. `npx prisma migrate status` lists exactly one pending migration: `20261118120000_product_order`. **Stop if not.**

## 3. Apply, then verify

```sh
npx prisma migrate deploy
psql "$DIRECT_URL" -c "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'HubProduct' AND column_name = 'sortOrder';"
psql "$DIRECT_URL" -c 'SELECT count(*) AS products, count("sortOrder") AS placed FROM "HubProduct";'
psql "$DATABASE_URL" -Atc "SELECT has_column_privilege(current_user, 'public.\"HubProduct\"', 'sortOrder', 'UPDATE');"
```

Expected:
- `sortOrder` is `integer`, nullable;
- the product count matches step 1, and `placed` is 0;
- the app's own login answers `t`.

## 4. Push the code

Then check the live listing still loads (`npm run smoke`).

## 5. Try it

On the Hub's Products page (Website order, the default), drag a product up, see "Saved", and within about two minutes see it move on a category page of the website.

## Roll back

Revert the code first. Then:

```sh
psql "$DIRECT_URL" -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
ALTER TABLE "HubProduct" DROP COLUMN IF EXISTS "sortOrder";
DELETE FROM "_prisma_migrations" WHERE migration_name = '20261118120000_product_order';
COMMIT;
SQL
```
