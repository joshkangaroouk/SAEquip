-- CreateIndex
CREATE INDEX "ProductTextItem_hubProductId_kind_sortOrder_idx" ON "ProductTextItem"("hubProductId", "kind", "sortOrder");

-- CreateIndex
CREATE INDEX "QuoteRequest_createdAt_idx" ON "QuoteRequest"("createdAt");

-- CreateIndex
CREATE INDEX "QuoteRequestItem_quoteRequestId_idx" ON "QuoteRequestItem"("quoteRequestId");

-- CreateIndex
CREATE INDEX "SpecRow_hubProductId_sortOrder_idx" ON "SpecRow"("hubProductId", "sortOrder");
