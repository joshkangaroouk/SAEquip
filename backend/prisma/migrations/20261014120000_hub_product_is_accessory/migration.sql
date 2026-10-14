-- Whether a product is an accessory (drives the listing's "Hide accessories" switch).
-- Additive with a default: existing rows read false until set from SA Equip's sheet.
ALTER TABLE "HubProduct" ADD COLUMN     "isAccessory" BOOLEAN NOT NULL DEFAULT false;
