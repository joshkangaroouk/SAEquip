import { Toggle } from "../ui";

/**
 * Whether this product is an accessory (a bracket, film, charger, trolley…)
 * rather than a main unit. Listing pages offer "Hide accessories", which
 * leaves these out. Stored Hub-side; first set from SA Equip's sheet.
 *
 * In the side panel's Visibility card since batch 10 (10 §3), under the
 * status; the same `accessory` save key. `id` is the failed pill's anchor.
 */
export function AccessorySection({ checked, onChange }: { checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <div id="section-accessory">
      <Toggle id="product-is-accessory" checked={checked} onChange={onChange} label="This product is an accessory" />
      <p className="t-help mt-2">Listing pages can hide accessories with "Hide accessories".</p>
    </div>
  );
}
