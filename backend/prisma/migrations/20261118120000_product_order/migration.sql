-- The product's place in the website's product listing, set by dragging on the
-- Hub's Products page. Nullable and additive: NULL lists after every placed
-- product, A–Z, exactly as the listing was ordered before. Nothing is dropped
-- and no row changes.
ALTER TABLE "HubProduct" ADD COLUMN "sortOrder" INTEGER;
