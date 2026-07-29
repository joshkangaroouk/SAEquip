import { Badge, Card, CardHeader, Checkbox, Field, Input, Select } from "../ui";
import type { NativeForm } from "./productEditorTypes";

const TYPES = ["PHYSICAL", "DIGITAL", "SERVICE", "DONATION"];
const STATUSES = ["ACTIVE", "HIDDEN"];
const STOCK = ["IN_STOCK", "OUT_OF_STOCK"];

/**
 * Native Duda product fields. Controlled — the parent owns the draft and the
 * unified save bar commits it.
 */
export function ProductDetailsSection({
  value,
  onChange,
  dirty,
  error,
  hideCommerce = false,
}: {
  value: NativeForm;
  onChange: (next: NativeForm) => void;
  dirty: boolean;
  error?: string;
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
      <CardHeader
        title="Details"
        description="Native Duda fields. These sync straight to the store."
        actions={dirty ? <Badge tone="accent">Unsaved</Badge> : undefined}
      />

      {error && (
        <div className="mb-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-small text-danger">
          {error}
        </div>
      )}

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

        <Field label="Status" htmlFor="p-status" hint="Hidden products aren't shown in the store.">
          <Select size="sm" id="p-status" value={value.status} onChange={(e) => set("status", e.target.value)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>

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

      <fieldset className="mt-4 rounded-lg border border-border p-3">
        <legend className="px-1.5 text-small font-medium text-muted">
          SEO
        </legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Title" htmlFor="p-seo-title">
            <Input size="sm"
              id="p-seo-title"
              value={value.seo_title}
              onChange={(e) => set("seo_title", e.target.value)}
            />
          </Field>
          <Field
            label="Product URL slug"
            htmlFor="p-seo-url"
            hint="The public widget finds this product by its slug — changing it changes the live URL."
          >
            <Input size="sm"
              id="p-seo-url"
              value={value.seo_product_url}
              onChange={(e) => set("seo_product_url", e.target.value)}
            />
          </Field>
          <Field label="Meta description" htmlFor="p-seo-desc" className="sm:col-span-3">
            <Input size="sm"
              id="p-seo-desc"
              value={value.seo_description}
              onChange={(e) => set("seo_description", e.target.value)}
            />
          </Field>
        </div>
      </fieldset>
    </Card>
  );
}
