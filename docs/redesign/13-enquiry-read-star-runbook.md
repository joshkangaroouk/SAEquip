# Runbook: apply the `enquiry_read_star_notes` migration

**For:** Josh, before the `enquiries/read-star-notes` branch is merged to `main`.

**What it does:**
- adds seven nullable columns to `QuoteRequest` and to `Lead`: `readAt`, `readBy`, `starredAt`, `starredBy`, `notes`, `notesUpdatedAt` and `notesUpdatedBy`;
- copies `handledAt` / `handledBy` into `readAt` / `readBy`, so anything already marked handled starts read.

Nothing is dropped and no default is filled in. `handledAt` / `handledBy` stay where they are, because the code live while the migration is applied still reads them. The migration is `backend/prisma/migrations/20261109120000_enquiry_read_star_notes/migration.sql`.

This is the same procedure as [`06b-migration-runbook.md`](06b-migration-runbook.md). Only the names and the expected results change.

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

`DIRECT_URL` is the owner connection, the only one that can `ALTER TABLE`. If `pg_dump` or `psql` rejects it with `invalid URI query parameter`, use `"${DIRECT_URL%%\?*}"` instead. Check that `pg_dump --version` is at least `psql "$DIRECT_URL" -Atc 'show server_version;'`.

## 1. Back up first

Store the files **outside the repo**: they contain customer names, emails and phone numbers.

```sh
mkdir -p ~/saequip-backups && chmod 700 ~/saequip-backups
STAMP=$(date +%Y%m%d-%H%M%S)
pg_dump "$DIRECT_URL" --format=custom --no-owner \
  --table='public."QuoteRequest"' \
  --table='public."QuoteRequestItem"' \
  --table='public."Lead"' \
  --file ~/saequip-backups/enquiries-$STAMP.dump
pg_dump "$DIRECT_URL" --format=custom --no-owner \
  --file ~/saequip-backups/saequip-full-$STAMP.dump
```

Check the backup is readable, and note the counts. Step 4 compares against these.

```sh
pg_restore --list ~/saequip-backups/enquiries-$STAMP.dump | grep 'TABLE DATA'
psql "$DIRECT_URL" -c '
SELECT (SELECT count(*) FROM "QuoteRequest") AS quotes,
       (SELECT count(*) FROM "QuoteRequest" WHERE "handledAt" IS NOT NULL) AS quotes_handled,
       (SELECT count(*) FROM "QuoteRequestItem") AS quote_items,
       (SELECT count(*) FROM "Lead") AS leads,
       (SELECT count(*) FROM "Lead" WHERE "handledAt" IS NOT NULL) AS leads_handled;'
```

## 2. Check the migration history is intact

```sh
psql "$DIRECT_URL" -c "SELECT to_regclass('public._prisma_migrations') AS history_table;"
psql "$DIRECT_URL" -c 'SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY started_at DESC LIMIT 3;'
npx prisma migrate status
```

Expected:
- `history_table` is `_prisma_migrations`.
- The newest row is `20261030120000_enquiry_handled`, with `finished_at` set and `rolled_back_at` empty.
- `migrate status` lists exactly one migration not yet applied: `20261109120000_enquiry_read_star_notes`.

**Stop if any of this differs.** Don't fix it with `migrate resolve` or anything else on the spot.

## 3. Apply

```sh
npx prisma migrate deploy
```

It should print `1 migration found` and then `applied`. **Never add `--shadow-database-url`, and never substitute another migrate subcommand.**

## 4. Verify

```sh
psql "$DIRECT_URL" -c "
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('QuoteRequest', 'Lead')
  AND column_name IN ('readAt','readBy','starredAt','starredBy','notes','notesUpdatedAt','notesUpdatedBy')
ORDER BY table_name, column_name;"
```

Expected: 14 rows, 7 per table. Every column is nullable with an empty default. The `…At` columns are `timestamp without time zone`; the rest are `text`.

Then check that the migration is recorded, that no rows were added or lost, and that the copy matched:

```sh
psql "$DIRECT_URL" -c "SELECT migration_name, finished_at FROM \"_prisma_migrations\" WHERE migration_name = '20261109120000_enquiry_read_star_notes';"
psql "$DIRECT_URL" -c '
SELECT (SELECT count(*) FROM "QuoteRequest") AS quotes,
       (SELECT count(*) FROM "QuoteRequest" WHERE "readAt" IS NOT NULL) AS quotes_read,
       (SELECT count(*) FROM "QuoteRequest" WHERE "readAt" IS DISTINCT FROM "handledAt" OR "readBy" IS DISTINCT FROM "handledBy") AS quotes_mismatch,
       (SELECT count(*) FROM "QuoteRequestItem") AS quote_items,
       (SELECT count(*) FROM "Lead") AS leads,
       (SELECT count(*) FROM "Lead" WHERE "readAt" IS NOT NULL) AS leads_read,
       (SELECT count(*) FROM "Lead" WHERE "readAt" IS DISTINCT FROM "handledAt" OR "readBy" IS DISTINCT FROM "handledBy") AS leads_mismatch;'
```

Expected:
- `quotes`, `quote_items` and `leads` match step 1;
- `quotes_read` equals `quotes_handled`, and `leads_read` equals `leads_handled`;
- both `…_mismatch` counts are 0.

The app's runtime role (`saequip_app`) needs nothing extra: its table-level grants cover new columns.

## 5. If you need to roll back

This removes the new columns, and any read marks, stars and notes with them. Revert the code first, because the new code reads these columns.

```sh
psql "$DIRECT_URL" -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
ALTER TABLE "QuoteRequest" DROP COLUMN IF EXISTS "readAt", DROP COLUMN IF EXISTS "readBy",
  DROP COLUMN IF EXISTS "starredAt", DROP COLUMN IF EXISTS "starredBy",
  DROP COLUMN IF EXISTS "notes", DROP COLUMN IF EXISTS "notesUpdatedAt", DROP COLUMN IF EXISTS "notesUpdatedBy";
ALTER TABLE "Lead" DROP COLUMN IF EXISTS "readAt", DROP COLUMN IF EXISTS "readBy",
  DROP COLUMN IF EXISTS "starredAt", DROP COLUMN IF EXISTS "starredBy",
  DROP COLUMN IF EXISTS "notes", DROP COLUMN IF EXISTS "notesUpdatedAt", DROP COLUMN IF EXISTS "notesUpdatedBy";
DELETE FROM "_prisma_migrations" WHERE migration_name = '20261109120000_enquiry_read_star_notes';
COMMIT;
SQL
```

## 6. Order of work

- **Migration first, code second.** The code on `main` today ignores the new columns, so applying the migration early is harmless.
- **Code first breaks both enquiry pages.** The new code reads the new columns, so merging before the migration makes Quote Requests, Resource Requests and their sidebar badges error. A preview deployment of the branch, which uses the production database, does the same until the migration is applied.
- **Requests marked handled between steps 1 and 3** are not copied. Nobody is likely to mark one in those few minutes. If someone does, it starts unread; open it once.
- **Later:** once nothing reads them, a separate migration can drop `handledAt` / `handledBy`. They are harmless until then.
