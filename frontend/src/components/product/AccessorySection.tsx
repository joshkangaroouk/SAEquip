import { AccordionCard, Toggle } from "../ui";

/**
 * Whether this product is an accessory (a bracket, film, charger, trolley…)
 * rather than a main unit. Listing pages offer "Hide accessories", which
 * leaves these out. Stored Hub-side; first set from SA Equip's sheet.
 */
export function AccessorySection({
  checked,
  onChange,
  dirty,
  error,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  dirty: boolean;
  error?: string;
}) {
  return (
    <AccordionCard
      id="section-accessory"
      title="Accessory"
      description='Listing pages can hide accessories with "Hide accessories".'
      summary={checked ? "Accessory" : undefined}
      dirty={dirty}
      error={error}
      defaultOpen
    >
      <Toggle id="product-is-accessory" checked={checked} onChange={onChange} label="This product is an accessory" />
    </AccordionCard>
  );
}
