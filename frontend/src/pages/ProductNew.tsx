import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Button, Card, CardHeader, Field, Input, PageHeader, Select, Textarea, toast } from "../components/ui";
import { apiJson } from "../lib/api";
import type { ProductDetail } from "../lib/types";

const NUMERIC = /^\d+(\.\d+)?$/;
const TYPES = ["PHYSICAL", "DIGITAL", "SERVICE", "DONATION"];

interface NewProductForm {
  name: string;
  sku: string;
  price: string;
  type: string;
  status: string;
  description: string;
}

const blank: NewProductForm = {
  name: "",
  sku: "",
  price: "0.00",
  type: "PHYSICAL",
  // Hidden by default so a half-filled product never goes live mid-migration.
  status: "HIDDEN",
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
  const valid = nameOk && priceOk;

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
          ...(form.sku.trim() ? { sku: form.sku.trim() } : {}),
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
        description="Creates the product in Duda. Hidden by default — make it active once its content is filled in."
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

          <Field label="Description (HTML)" htmlFor="n-desc" hint="Optional — you can add this later.">
            <Textarea
              id="n-desc"
              className="h-28 font-mono text-small"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="<p>…</p>"
              spellCheck={false}
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
    </div>
  );
}
