# Runbook: apply the `enquiry_handled` migration (batch 6)

**For:** Josh, before `redesign/ui` is merged.
**What it does:** adds four nullable columns, `handledAt` and `handledBy` on `QuoteRequest` and on `Lead`. Nothing is dropped, no row is rewritten, and no default is filled in. The migration is `backend/prisma/migrations/20261030120000_enquiry_handled/migration.sql`.

> ⚠️ Read CLAUDE.md "Prisma migrations" first. The hard rules:
> - Never pass a real database to `--shadow-database-url`.
> - Never run `migrate dev`, `migrate reset` or `db push` against this project.
>
> Only `migrate deploy` applies migrations here. This Supabase tier has no backups, so step 1 is the only copy you will have.

Run everything from `backend/`, in a terminal that is not shared or recorded.

## 0. Load the connection strings

```sh
cd backend
set -a; . ./.env; set +a   # loads DATABASE_URL and DIRECT_URL; do not echo them
```

- `DIRECT_URL` is the owner (`postgres`) connection. It is the only one that can `ALTER TABLE`. `DATABASE_URL` is the restricted `saequip_app` role.
- If `pg_dump` or `psql` rejects the URL with `invalid URI query parameter`, use `"${DIRECT_URL%%\?*}"` (the URL without its `?…` part) wherever `"$DIRECT_URL"` appears below.

Check the tools. `pg_dump` must be at least as new as the server.

```sh
psql "$DIRECT_URL" -Atc 'show server_version;'
pg_dump --version
```

If `pg_dump` is older, install a matching client (for example `brew install postgresql@17`) and use its `pg_dump`.

## 1. Back up first

Store the files **outside the repo**: they contain customer names, emails and phone numbers. Never commit them.

```sh
mkdir -p ~/saequip-backups && chmod 700 ~/saequip-backups
STAMP=$(date +%Y%m%d-%H%M%S)

# The two tables the migration alters, plus quote line items (a quote is
# incomplete without them). Schema and data.
pg_dump "$DIRECT_URL" --format=custom --no-owner \
  --table='public."QuoteRequest"' \
  --table='public."QuoteRequestItem"' \
  --table='public."Lead"' \
  --file ~/saequip-backups/enquiries-$STAMP.dump

# Optional, recommended: the whole database.
pg_dump "$DIRECT_URL" --format=custom --no-owner \
  --file ~/saequip-backups/saequip-full-$STAMP.dump
```

Check the backup is readable and note the row counts. Step 4 compares against these.

```sh
pg_restore --list ~/saequip-backups/enquiries-$STAMP.dump | grep 'TABLE DATA'
psql "$DIRECT_URL" -c 'SELECT (SELECT count(*) FROM "QuoteRequest") AS quotes, (SELECT count(*) FROM "QuoteRequestItem") AS quote_items, (SELECT count(*) FROM "Lead") AS leads;'
```

## 2. Check the migration history is intact

The history table has gone missing before (P3005; see CLAUDE.md). `migrate deploy` must not run without it.

```sh
psql "$DIRECT_URL" -c "SELECT to_regclass('public._prisma_migrations') AS history_table;"
psql "$DIRECT_URL" -c 'SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY started_at DESC LIMIT 5;'
```

Expected:
- `history_table` is `_prisma_migrations`, not empty.
- The newest row is `20261014120000_hub_product_is_accessory`, with `finished_at` set and `rolled_back_at` empty.

Then ask Prisma, which only reads:

```sh
npx prisma migrate status
```

Expected: exactly one migration not yet applied, `20261030120000_enquiry_handled`.

**Stop if any of this differs.** That means a missing history table, a failed or rolled-back migration, or more than one pending. Don't try to fix it with `migrate resolve` or anything else on the spot; work out first what happened.

## 3. Apply

```sh
npx prisma migrate deploy
```

Prisma runs the one pending migration on `DIRECT_URL` (the `directUrl` in `schema.prisma`) and records it in `_prisma_migrations`. It should print `1 migration found` … `applied`.

**Never add `--shadow-database-url`, and never substitute another migrate subcommand.**

## 4. Verify

```sh
psql "$DIRECT_URL" -c "
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('QuoteRequest', 'Lead')
  AND column_name IN ('handledAt', 'handledBy')
ORDER BY table_name, column_name;"
```

Expected: four rows.

| table_name | column_name | data_type | is_nullable | column_default |
|---|---|---|---|---|
| Lead | handledAt | timestamp without time zone | YES | (empty) |
| Lead | handledBy | text | YES | (empty) |
| QuoteRequest | handledAt | timestamp without time zone | YES | (empty) |
| QuoteRequest | handledBy | text | YES | (empty) |

Then confirm the migration is recorded and no rows changed:

```sh
psql "$DIRECT_URL" -c "SELECT migration_name, finished_at FROM \"_prisma_migrations\" WHERE migration_name = '20261030120000_enquiry_handled';"
psql "$DIRECT_URL" -c 'SELECT (SELECT count(*) FROM "QuoteRequest") AS quotes, (SELECT count(*) FROM "QuoteRequestItem") AS quote_items, (SELECT count(*) FROM "Lead") AS leads;'
```

The counts must match step 1. Every existing row has both new columns empty, so every enquiry reads as "New".

The app's runtime role (`saequip_app`) needs nothing extra: its table-level `SELECT/INSERT/UPDATE/DELETE` covers new columns.

## 5. If you need to roll back

This removes the columns, and any handled marks with them. Also revert the batch 6 code first: the deployed API reads these columns, so it will error without them.

```sh
psql "$DIRECT_URL" -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
ALTER TABLE "QuoteRequest" DROP COLUMN IF EXISTS "handledAt";
ALTER TABLE "QuoteRequest" DROP COLUMN IF EXISTS "handledBy";
ALTER TABLE "Lead" DROP COLUMN IF EXISTS "handledAt";
ALTER TABLE "Lead" DROP COLUMN IF EXISTS "handledBy";
DELETE FROM "_prisma_migrations" WHERE migration_name = '20261030120000_enquiry_handled';
COMMIT;
SQL
```

After this, `npx prisma migrate status` shows the migration as pending again.

## 6. Order of work

- **Do not merge `redesign/ui` until steps 1 to 4 are done.**
- **Migration first, code second.** The current production code ignores the new columns, so applying the migration early is harmless.
- **Code first breaks the enquiry pages.** The batch 6 code reads the new columns, so deploying it first makes the Quote requests and Resource requests pages and their sidebar badges error. The same is expected of a preview deployment that points at production before the migration.
