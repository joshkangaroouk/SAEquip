import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Button, Card, CardHeader, Field, Input, PageHeader, RichTextEditor, Select, Toggle, toast } from "../components/ui";
import { apiJson } from "../lib/api";
import type { ProductDetail } from "../lib/types";

const NUMERIC = /^\d+(\.\d+)?$/;
const TYPES = ["PHYSICAL", "DIGITAL", "SERVICE", "DONATION"];

interface NewProductForm {
  name: string;
  sku: string;
  price: string;
  compareAtPrice: string;
  type: string;
  status: string;
  requiresShipping: boolean;
  description: string;
}

const blank: NewProductForm = {
  name: "",
  sku: "",
  price: "0.00",
  compareAtPrice: "",
  type: "PHYSICAL",
  // Hidden by default so a half-filled product never goes live mid-migration.
  status: "HIDDEN",
  requiresShipping: true,
  description: "",
};

/**
 * Create a product. Optimised for repetition rather than polish — this is the
 * migration path for the ~85 products still on the legacy site, so "Create and
 * add another" keeps focus in the form and counts your progress.
 */
export default function ProductNew() {
  const navigate = useNavigate();
  const nameRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<NewProductForm>(blank);
  const [saving, setSaving] = useState(false);
  const [createdCount, setCreatedCount] = useState(0);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const set = <K extends keyof NewProductForm>(k: K, v: NewProductForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const nameOk = form.name.trim().length > 0;
  const priceOk = NUMERIC.test(form.price) && parseFloat(form.price) >= 0;
  // Duda rejects a compare-at price that is not ABOVE the price, so catch it
  // here rather than after a round trip.
  const compareOk =
    form.compareAtPrice.trim() === "" ||
    (NUMERIC.test(form.compareAtPrice) && parseFloat(form.compareAtPrice) > parseFloat(form.price || "0"));
  const valid = nameOk && priceOk && compareOk;

  async function create(then: "edit" | "another") {
    if (!valid || saving) return;
    setSaving(true);
    try {
      const created = await apiJson<ProductDetail>("/api/products", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          price: form.price,
          type: form.type,
          status: form.status,
          requires_shipping: form.requiresShipping,
          ...(form.sku.trim() ? { sku: form.sku.trim() } : {}),
          ...(form.compareAtPrice.trim() ? { compare_at_price: form.compareAtPrice.trim() } : {}),
          ...(form.description.trim() ? { description: form.description } : {}),
        }),
      });
      toast.success(`Created “${created.name}”`);
      if (then === "edit") {
        navigate(`/products/${created.id}`, { replace: true });
      } else {
        setCreatedCount((n) => n + 1);
        setForm(blank);
        nameRef.current?.focus();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the product");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="New product"
        description="Creates the product in Duda with the fields it accepts at create time. Hidden by default, so a half-filled product never goes live."
        actions={
          createdCount > 0 ? (
            <Badge tone="success">
              {createdCount} created this session
            </Badge>
          ) : undefined
        }
      />

      <Card className="mt-6">
        <CardHeader title="Details" />

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void create("edit");
          }}
        >
          <Field label="Name" htmlFor="n-name" error={!nameOk && form.name !== "" ? "Name is required" : undefined}>
            <Input
              ref={nameRef}
              id="n-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. EX Heater"
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="SKU" htmlFor="n-sku" hint="Optional.">
              <Input id="n-sku" value={form.sku} onChange={(e) => set("sku", e.target.value)} />
            </Field>

            <Field
              label="Price"
              htmlFor="n-price"
              hint="Required by Duda. Quotes replace checkout, so 0.00 is fine."
              error={!priceOk ? "Must be a number ≥ 0" : undefined}
            >
              <Input
                id="n-price"
                inputMode="decimal"
                value={form.price}
                onChange={(e) => set("price", e.target.value)}
              />
            </Field>

            <Field
              label="Compare-at price"
              htmlFor="n-compare"
              hint="Optional. Shown struck through; must be above the price."
              error={!compareOk ? "Must be a number above the price" : undefined}
            >
              <Input
                id="n-compare"
                inputMode="decimal"
                value={form.compareAtPrice}
                onChange={(e) => set("compareAtPrice", e.target.value)}
                placeholder="—"
              />
            </Field>

            <Field label="Type" htmlFor="n-type">
              <Select id="n-type" value={form.type} onChange={(e) => set("type", e.target.value)}>
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Status" htmlFor="n-status">
              <Select id="n-status" value={form.status} onChange={(e) => set("status", e.target.value)}>
                <option value="HIDDEN">HIDDEN</option>
                <option value="ACTIVE">ACTIVE</option>
              </Select>
            </Field>
          </div>

          <Field
            label="Requires shipping"
            htmlFor="n-ship"
            hint="Physical goods ship; a service or a downloadable file does not."
          >
            <Toggle
              id="n-ship"
              checked={form.requiresShipping}
              onChange={(v) => set("requiresShipping", v)}
              label={form.requiresShipping ? "Yes — this is a physical item" : "No"}
            />
          </Field>

          {/*
            The same rich editor as the product page, not a raw-HTML textarea.
            
            The editor keeps an HTML escape hatch because opening an imported
            product in a WYSIWYG would silently rewrite its legacy WordPress
            markup. A product being created has no markup to protect, so that
            trade-off does not apply here and the plain-English editor is
            simply the better tool.
          */}
          {/* No htmlFor: the rich editor is a contenteditable surface, not a
              form control with an id, so a label pointing at "n-desc" would be
              a dangling reference — worse than no association at all. */}
          <Field label="Description" hint="Optional — you can add or change this later.">
            <RichTextEditor
              value={form.description}
              onChange={(html) => set("description", html)}
            />
          </Field>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button type="submit" variant="primary" disabled={!valid} loading={saving}>
              Create and edit
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void create("another")}
              disabled={!valid || saving}
            >
              Create and add another
            </Button>
            <Button type="button" variant="ghost" onClick={() => navigate("/")} disabled={saving}>
              Cancel
            </Button>
          </div>
        </form>
      </Card>

      <NextSteps />
    </div>
  );
}

/**
 * ⚠️ Everything listed here is deliberately absent from the form above.
 *
 * These are the fields the form CANNOT collect, and saying so is the point.
 * Two different reasons, both hard:
 *
 *  - Stock, quantity, images, options, variations and SEO (including the
 *    slug) are not accepted by Duda's create endpoint at all — see
 *    DudaProductCreate. They are a PATCH after the product exists.
 *  - Every Hub-side field keys off `HubProduct.dudaProductId`, and that row is
 *    created from the response to this form. There is no product id to attach
 *    them to until the create returns.
 *
 * Without this panel the page looks like it is asking for the whole product
 * and quietly omitting half of it.
 */
function NextSteps() {
  const AFTER = [
    ["Images", "Uploaded here, then fetched and re-hosted by Duda on save."],
    ["Technical Specs", "Label/value rows, including multi-line specs and sub-headings."],
    ["Key Benefits & Applications", "Ordered checklists."],
    ["Logos", "Tick the SA range and certification marks that apply."],
    ["3D Model", "One .glb per product."],
    ["Compatible Products", "The carousel of accessories that go with it."],
    ["Stock, SEO & options", "Stock status, the page URL, and any variations."],
  ];

  return (
    <Card className="mt-6">
      <CardHeader
        title="Added after it exists"
        description="Duda only accepts the fields above when creating a product, and everything the Hub stores is keyed to the product id you get back. Create it first, then fill these in on the editor."
      />
      <ul className="space-y-2">
        {AFTER.map(([label, why]) => (
          <li key={label} className="flex gap-2 text-small">
            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent" aria-hidden="true" />
            <span>
              <span className="font-medium text-text">{label}</span>
              <span className="text-muted"> — {why}</span>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
