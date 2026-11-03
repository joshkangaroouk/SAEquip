import { Toggle } from "../ui";
import { EditorSection } from "./EditorSection";

/**
 * Whether this product is an accessory (a bracket, film, charger, trolley…)
 * rather than a main unit. Listing pages offer "Hide accessories", which
 * leaves these out. Stored Hub-side; first set from SA Equip's sheet.
 */
export function AccessorySection({
  checked,
  onChange,
  error,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  error?: string;
}) {
  return (
    <EditorSection
      id="section-accessory"
      title="Accessory"
      description='Listing pages can hide accessories with "Hide accessories".'
      error={error}
    >
      <Toggle id="product-is-accessory" checked={checked} onChange={onChange} label="This product is an accessory" />
    </EditorSection>
  );
}
