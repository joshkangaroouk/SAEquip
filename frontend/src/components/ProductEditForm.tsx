import { useMemo, useState, type FormEvent } from "react";
import { apiFetch } from "../lib/api";
import type { ProductDetail as Product } from "../lib/types";

type EditForm = {
  name: string;
  sku: string;
  type: string;
  status: string;
  stock_status: string;
  requires_shipping: boolean;
  managed_inventory: boolean;
  quantity: string;
  price: string;
  compare_at_price: string;
  description: string;
  seo_title: string;
  seo_description: string;
  seo_product_url: string;
};

function formFromProduct(p: Product): EditForm {
  const price0 = p.prices?.[0];
  return {
    name: p.name ?? "",
    sku: p.sku ?? "",
    type: p.type ?? "PHYSICAL",
    status: p.status ?? "ACTIVE",
    stock_status: p.stock_status ?? "IN_STOCK",
    requires_shipping: !!p.requires_shipping,
    managed_inventory: !!p.managed_inventory,
    quantity: p.quantity != null ? String(p.quantity) : "",
    price: price0?.price ?? "",
    compare_at_price: price0?.compare_at_price ?? "",
    description: p.description ?? "",
    seo_title: p.seo?.title ?? "",
    seo_description: p.seo?.description ?? "",
    seo_product_url: p.seo?.product_url ?? "",
  };
}

const NUMERIC = /^\d+(\.\d+)?$/;
const inputCls =
  "mt-1 block w-full rounded-md bg-surface border border-border px-3 py-2 text-sm text-text placeholder:text-subtle focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none disabled:bg-surface-2 disabled:text-subtle";
const labelCls = "block text-sm font-semibold text-text";

export function ProductEditForm({
  product,
  onSaved,
  onCancel,
}: {
  product: Product;
  onSaved: (updated: Product) => void;
  onCancel: () => void;
}) {
  const initial = useMemo(() => formFromProduct(product), [product]);
  const [form, setForm] = useState<EditForm>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof EditForm>(key: K, value: EditForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Client-side mirror of the backend zod rules.
  const nameOk = form.name.trim().length > 0;
  const priceOk = NUMERIC.test(form.price) && parseFloat(form.price) >= 0;
  const compareOk =
    form.compare_at_price === "" ||
    (NUMERIC.test(form.compare_at_price) &&
      priceOk &&
      parseFloat(form.compare_at_price) > parseFloat(form.price));
  const quantityOk =
    !form.managed_inventory ||
    form.quantity === "" ||
    (/^\d+$/.test(form.quantity) && parseInt(form.quantity, 10) >= 0);
  const valid = nameOk && priceOk && compareOk && quantityOk;

  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  function buildPayload(): Record<string, unknown> {
    const p: Record<string, unknown> = {};
    if (form.name !== initial.name) p.name = form.name;
    if (form.sku !== initial.sku) p.sku = form.sku;
    if (form.type !== initial.type) p.type = form.type;
    if (form.status !== initial.status) p.status = form.status;
    if (form.stock_status !== initial.stock_status) p.stock_status = form.stock_status;
    if (form.requires_shipping !== initial.requires_shipping)
      p.requires_shipping = form.requires_shipping;
    if (form.managed_inventory !== initial.managed_inventory)
      p.managed_inventory = form.managed_inventory;
    if (form.managed_inventory && form.quantity !== initial.quantity && form.quantity !== "")
      p.quantity = parseInt(form.quantity, 10);
    if (form.description !== initial.description) p.description = form.description;
    if (form.price !== initial.price || form.compare_at_price !== initial.compare_at_price) {
      p.prices = [
        { price: form.price, compare_at_price: form.compare_at_price === "" ? null : form.compare_at_price },
      ];
    }
    // Send the FULL seo object if any sub-field changed, so unchanged fields
    // (e.g. product_url) are preserved rather than wiped.
    if (
      form.seo_title !== initial.seo_title ||
      form.seo_description !== initial.seo_description ||
      form.seo_product_url !== initial.seo_product_url
    ) {
      p.seo = {
        title: form.seo_title,
        description: form.seo_description,
        product_url: form.seo_product_url,
      };
    }
    return p;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!dirty || !valid || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = json?.details
          ? `Validation error: ${JSON.stringify(json.details.fieldErrors ?? json.details)}`
          : json?.detail
            ? `Duda error ${json.upstream_status ?? ""}: ${json.detail}`
            : json?.error || `Request failed (${res.status})`;
        throw new Error(msg);
      }
      onSaved(json as Product);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-border bg-surface p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text">Edit native fields</h2>
        <span className="text-xs text-subtle">{dirty ? "Unsaved changes" : "No changes"}</span>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className={labelCls}>
          Name
          <input className={inputCls} value={form.name} onChange={(e) => set("name", e.target.value)} />
          {!nameOk && <span className="text-xs text-danger">Name is required</span>}
        </label>

        <label className={labelCls}>
          SKU
          <input className={inputCls} value={form.sku} onChange={(e) => set("sku", e.target.value)} />
        </label>

        <label className={labelCls}>
          Type
          <select className={inputCls} value={form.type} onChange={(e) => set("type", e.target.value)}>
            {["PHYSICAL", "DIGITAL", "SERVICE", "DONATION"].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>

        <label className={labelCls}>
          Status
          <select className={inputCls} value={form.status} onChange={(e) => set("status", e.target.value)}>
            {["ACTIVE", "HIDDEN"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>

        <label className={labelCls}>
          Stock status
          <select
            className={inputCls}
            value={form.stock_status}
            onChange={(e) => set("stock_status", e.target.value)}
          >
            {["IN_STOCK", "OUT_OF_STOCK"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>

        <label className={labelCls}>
          Price
          <input
            className={inputCls}
            inputMode="decimal"
            value={form.price}
            onChange={(e) => set("price", e.target.value)}
          />
          {!priceOk && <span className="text-xs text-danger">Must be a number ≥ 0</span>}
        </label>

        <label className={labelCls}>
          Compare-at price (optional)
          <input
            className={inputCls}
            inputMode="decimal"
            value={form.compare_at_price}
            onChange={(e) => set("compare_at_price", e.target.value)}
          />
          {!compareOk && (
            <span className="text-xs text-danger">Must be a number greater than price</span>
          )}
        </label>

        <label className={labelCls}>
          Quantity {form.managed_inventory ? "" : "(enable managed inventory)"}
          <input
            className={inputCls}
            type="number"
            min={0}
            step={1}
            disabled={!form.managed_inventory}
            value={form.quantity}
            onChange={(e) => set("quantity", e.target.value)}
          />
          {!quantityOk && <span className="text-xs text-danger">Must be a whole number ≥ 0</span>}
        </label>

        <label className="flex items-center gap-2 text-sm font-semibold text-text">
          <input
            type="checkbox"
            checked={form.requires_shipping}
            onChange={(e) => set("requires_shipping", e.target.checked)}
          />
          Requires shipping
        </label>

        <label className="flex items-center gap-2 text-sm font-semibold text-text">
          <input
            type="checkbox"
            checked={form.managed_inventory}
            onChange={(e) => set("managed_inventory", e.target.checked)}
          />
          Managed inventory
        </label>
      </div>

      <label className={`${labelCls} mt-4`}>
        Description (HTML)
        <textarea
          className={`${inputCls} h-40 font-mono text-xs`}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </label>

      <fieldset className="mt-4 rounded-lg border border-border p-4">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">SEO</legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className={labelCls}>
            Title
            <input
              className={inputCls}
              value={form.seo_title}
              onChange={(e) => set("seo_title", e.target.value)}
            />
          </label>
          <label className={labelCls}>
            Product URL slug
            <input
              className={inputCls}
              value={form.seo_product_url}
              onChange={(e) => set("seo_product_url", e.target.value)}
            />
          </label>
          <label className={`${labelCls} sm:col-span-2`}>
            Description
            <input
              className={inputCls}
              value={form.seo_description}
              onChange={(e) => set("seo_description", e.target.value)}
            />
          </label>
        </div>
      </fieldset>

      <div className="mt-6 flex items-center gap-3">
        <button
          type="submit"
          disabled={!dirty || !valid || saving}
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent-hover disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={() => setForm(initial)}
          disabled={!dirty || saving}
          className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-text hover:bg-surface-2 disabled:opacity-40"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-md px-4 py-2 text-sm font-semibold text-muted hover:text-text"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
