import { Card, CardHeader, Checkbox, Field, Input, Select } from "../ui";
import type { NativeForm } from "./productEditorTypes";

const TYPES = ["PHYSICAL", "DIGITAL", "SERVICE", "DONATION"];
const STOCK = ["IN_STOCK", "OUT_OF_STOCK"];

/**
 * Native Duda product fields on Overview: name, SKU and, unless hidden, the
 * commerce fields. Controlled — the parent owns the draft and the unified save
 * bar commits it.
 *
 * The rest of the same `details` key lives elsewhere (02a "Batch 8"): status
 * is the side panel's Live toggle, the SEO fields are the SEO tab, and the
 * description is on Content. Its errors show at the top of the panel.
 */
export function ProductDetailsSection({
  value,
  onChange,
  hideCommerce = false,
}: {
  value: NativeForm;
  onChange: (next: NativeForm) => void;
  /**
   * Hides the native-commerce fields (type, stock, pricing, quantity, shipping,
   * inventory). They're still on the product and still saved untouched — a
   * hidden field simply never becomes dirty, so it isn't sent.
   */
  hideCommerce?: boolean;
}) {
  const set = <K extends keyof NativeForm>(key: K, v: NativeForm[K]) =>
    onChange({ ...value, [key]: v });

  return (
    <Card id="section-details">
      <CardHeader title="Details" description="Native Duda fields. These sync straight to the store." />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Name" htmlFor="p-name" className="sm:col-span-2 lg:col-span-3">
          <Input size="sm" id="p-name" value={value.name} onChange={(e) => set("name", e.target.value)} />
        </Field>

        <Field label="SKU" htmlFor="p-sku">
          <Input size="sm" id="p-sku" value={value.sku} onChange={(e) => set("sku", e.target.value)} />
        </Field>

        {!hideCommerce && (
        <Field label="Type" htmlFor="p-type">
          <Select size="sm" id="p-type" value={value.type} onChange={(e) => set("type", e.target.value)}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
        )}

        {!hideCommerce && (
          <>
        <Field label="Stock status" htmlFor="p-stock">
          <Select size="sm"
            id="p-stock"
            value={value.stock_status}
            onChange={(e) => set("stock_status", e.target.value)}
          >
            {STOCK.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Price" htmlFor="p-price">
          <Input size="sm"
            id="p-price"
            inputMode="decimal"
            value={value.price}
            onChange={(e) => set("price", e.target.value)}
          />
        </Field>

        <Field
          label="Compare-at price"
          htmlFor="p-compare"
          hint="Optional. Must exceed the price; shown as a strike-through."
        >
          <Input size="sm"
            id="p-compare"
            inputMode="decimal"
            value={value.compare_at_price}
            onChange={(e) => set("compare_at_price", e.target.value)}
          />
        </Field>

        <Field
          label="Quantity"
          htmlFor="p-qty"
          hint={
            value.managed_inventory
              ? "Duda accepts this but never returns it, so it won't display after saving."
              : "Enable managed inventory to set a quantity."
          }
        >
          <Input size="sm"
            id="p-qty"
            type="number"
            min={0}
            step={1}
            disabled={!value.managed_inventory}
            value={value.quantity}
            onChange={(e) => set("quantity", e.target.value)}
          />
        </Field>

        <div className="flex flex-col justify-end gap-3 pb-1">
          <Checkbox
            label="Requires shipping"
            checked={value.requires_shipping}
            onChange={(v) => set("requires_shipping", v)}
          />
          <Checkbox
            label="Managed inventory"
            checked={value.managed_inventory}
            onChange={(v) => set("managed_inventory", v)}
          />
        </div>
          </>
        )}
      </div>
    </Card>
  );
}
