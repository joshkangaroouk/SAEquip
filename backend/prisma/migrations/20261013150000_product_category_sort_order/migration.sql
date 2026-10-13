-- A product's own order for its categories (SA Equip's Site Challenge priority).
-- Additive and nullable: existing rows keep NULL and follow the tree's order.
ALTER TABLE "ProductCategory" ADD COLUMN     "sortOrder" INTEGER;
