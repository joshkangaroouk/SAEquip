-- The platform activity log (docs/redesign/17-activity-log-runbook.md).
-- Additive only: two new tables. Written by hand from an offline
-- `migrate diff --from-schema-datamodel` (no database involved); apply with
-- `prisma migrate deploy` BEFORE the code that writes them is deployed.
--
-- ⚠️ Needs the `saequip_app` role (the app's login, see CLAUDE.md "The runtime
-- role cannot do DDL"): the policies below name it.

-- CreateTable
CREATE TABLE "ActivityEvent" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "category" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "targetLabel" TEXT,
    "summary" TEXT NOT NULL,
    "details" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "country" TEXT,
    "city" TEXT,
    "method" TEXT,
    "path" TEXT,
    "status" INTEGER,
    "durationMs" INTEGER,
    "sessionId" TEXT,
    "batchId" TEXT,
    "externalKey" TEXT,

    CONSTRAINT "ActivityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivitySession" (
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "ActivitySession_pkey" PRIMARY KEY ("sessionId")
);

-- CreateIndex
CREATE UNIQUE INDEX "ActivityEvent_externalKey_key" ON "ActivityEvent"("externalKey");

-- CreateIndex
CREATE INDEX "ActivityEvent_at_idx" ON "ActivityEvent"("at");

-- CreateIndex
CREATE INDEX "ActivityEvent_category_at_idx" ON "ActivityEvent"("category", "at");

-- CreateIndex
CREATE INDEX "ActivityEvent_actorId_at_idx" ON "ActivityEvent"("actorId", "at");

-- CreateIndex
CREATE INDEX "ActivityEvent_targetType_targetId_at_idx" ON "ActivityEvent"("targetType", "targetId", "at");

-- CreateIndex
CREATE INDEX "ActivityEvent_batchId_idx" ON "ActivityEvent"("batchId");

-- CreateIndex
CREATE INDEX "ActivitySession_userId_lastSeenAt_idx" ON "ActivitySession"("userId", "lastSeenAt");


-- ⚠️ ActivityEvent is APPEND-ONLY for the app. Row level security with a
-- policy per command: the app may read and add rows, and may delete only rows
-- older than two years (the retention period Josh chose, 2026-11-18). There is
-- no UPDATE policy, and UPDATE is revoked as well, so history cannot be edited
-- or cut short even by a bug or a hijacked server. The owner (this migration's
-- login) is not subject to row level security and can still repair the table.
--
-- The anon and authenticated roles hold no rights on this table (the schema's
-- default privileges grant to saequip_app only), so Supabase's REST API cannot
-- reach it either way.
ALTER TABLE "ActivityEvent" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ActivityEvent_app_read" ON "ActivityEvent"
  FOR SELECT TO saequip_app USING (true);

CREATE POLICY "ActivityEvent_app_add" ON "ActivityEvent"
  FOR INSERT TO saequip_app WITH CHECK (true);

CREATE POLICY "ActivityEvent_app_expire" ON "ActivityEvent"
  FOR DELETE TO saequip_app USING ("at" < now() - interval '730 days');

REVOKE UPDATE, TRUNCATE ON "ActivityEvent" FROM saequip_app;
