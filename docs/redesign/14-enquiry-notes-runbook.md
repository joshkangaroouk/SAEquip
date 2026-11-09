# Runbook: apply the `enquiry_notes` migration

**For:** whoever applies it, before the notes-thread code is pushed to `main`.

**What it does:**
- creates the `EnquiryNote` table: each note's text, who wrote it and when, on one quote request or one resource request;
- copies any text from the single notes box (`QuoteRequest.notes`, `Lead.notes`) in as that request's first note, with its author and time.

Nothing is dropped. The old `notes`, `notesUpdatedAt` and `notesUpdatedBy` columns stay, because the code live while the migration is applied still reads them. The migration is `backend/prisma/migrations/20261109150000_enquiry_notes/migration.sql`.

The procedure is [`13-enquiry-read-star-runbook.md`](13-enquiry-read-star-runbook.md)'s, and its hard rules apply: only `migrate deploy`, never a shadow database, never `migrate dev`, `reset` or `db push`. Only the names and expected results differ, below. Run from `backend/`, with the connection strings loaded as in step 0 there.

## 1. Back up first

Same as runbook 13's step 1: dump the enquiry tables and the whole database to `~/saequip-backups`. Note the counts:

```sh
psql "$DIRECT_URL" <<'SQL'
SELECT (SELECT count(*) FROM "QuoteRequest") AS quotes,
       (SELECT count(*) FROM "QuoteRequest" WHERE "notes" IS NOT NULL AND btrim("notes") <> '') AS quotes_with_notes,
       (SELECT count(*) FROM "Lead") AS leads,
       (SELECT count(*) FROM "Lead" WHERE "notes" IS NOT NULL AND btrim("notes") <> '') AS leads_with_notes;
SQL
```

## 2. Check the history

The newest row in `_prisma_migrations` is `20261109120000_enquiry_read_star_notes`, finished and not rolled back. `npx prisma migrate status` lists exactly one pending migration: `20261109150000_enquiry_notes`. **Stop if not.**

## 3. Apply

```sh
npx prisma migrate deploy
```

## 4. Verify

```sh
psql "$DIRECT_URL" -c '\d "EnquiryNote"'
psql "$DIRECT_URL" -c "SELECT migration_name, finished_at FROM \"_prisma_migrations\" WHERE migration_name = '20261109150000_enquiry_notes';"
psql "$DIRECT_URL" -c '
SELECT (SELECT count(*) FROM "EnquiryNote" WHERE "quoteRequestId" IS NOT NULL) AS quote_notes,
       (SELECT count(*) FROM "EnquiryNote" WHERE "leadId" IS NOT NULL) AS lead_notes,
       (SELECT count(*) FROM "QuoteRequest") AS quotes,
       (SELECT count(*) FROM "Lead") AS leads;'
psql "$DATABASE_URL" -Atc "SELECT has_table_privilege(current_user, 'public.\"EnquiryNote\"', 'SELECT'), has_table_privilege(current_user, 'public.\"EnquiryNote\"', 'INSERT'), has_table_privilege(current_user, 'public.\"EnquiryNote\"', 'DELETE');"
```

Expected:
- the table has six columns, two indexes, two cascading foreign keys and the `EnquiryNote_one_parent` check;
- the migration is recorded;
- `quote_notes` equals step 1's `quotes_with_notes`, and `lead_notes` equals `leads_with_notes`;
- `quotes` and `leads` are unchanged;
- the last line, run as the app's own restricted login, is `t|t|t`. Default privileges grant it on new tables. If it isn't, grant SELECT, INSERT and DELETE on the table to `saequip_app` before pushing.

## 5. Roll back

Revert the code first, because the new code reads the table. Notes added since are lost with it.

```sh
psql "$DIRECT_URL" -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
DROP TABLE IF EXISTS "EnquiryNote";
DELETE FROM "_prisma_migrations" WHERE migration_name = '20261109150000_enquiry_notes';
COMMIT;
SQL
```

## 6. Order of work

**Migration first, then push.** The code live today ignores the new table. The new code reads it in both list endpoints, so pushing first breaks Quote Requests, Resource Requests and their badges.
