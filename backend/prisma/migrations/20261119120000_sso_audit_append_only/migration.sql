-- DudaSsoAudit is the record of every Duda editor login link the Hub has
-- minted (and every refusal). Like ActivityEvent, it is now APPEND-ONLY for the
-- app (USERS-AUDIT L7, 2026-11-19): the runtime role could UPDATE and DELETE
-- it, so a bug or a hijacked server could rewrite who opened the live site's
-- editor. Nothing in the code updates or deletes these rows (routes/
-- websiteEditor.ts only inserts), so this changes no behaviour. The owner
-- (this migration's login) can still repair the table.
--
-- Independent of any deploy: apply it before or after.
REVOKE UPDATE, DELETE, TRUNCATE ON "DudaSsoAudit" FROM saequip_app;
