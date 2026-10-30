import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  DropdownMenu,
  EmptyState,
  Field,
  Input,
  Loader,
  Modal,
  PageHeader,
  RemoveButton,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  toast,
  useConfirm,
} from "../components/ui";
import { apiJson } from "../lib/api";
import { UsageDialog } from "../components/UsagePill";
import type { CatalogOption, OptionCatalog } from "../components/product/productEditorTypes";

/**
 * Store-level Product Options catalog — the manager the product page
 * deliberately doesn't offer, because renaming an option or deleting a value
 * rewrites every product using it.
 *
 * Mirrors Duda's own screen: one row per option, its values, and how many
 * products include it.
 */
/** What a store-wide delete did to the products using it. Mirrors the backend's CascadeReport. */
interface CascadeReport {
  productsUpdated: { name: string }[];
  variationDataRestored: number;
  variationDataDropped: number;
  variationDataFailed: number;
}

/**
 * ⚠️ A delete that rebuilt variations used to report only "updated N
 * products", even when combinations lost their SKU and price difference in the
 * process — a destructive outcome presented as a clean success. Said
 * separately, and as an error, because it is data that is now gone.
 */
function reportLostVariationData(c?: CascadeReport) {
  if (!c) return;
  if (c.variationDataDropped > 0) {
    toast.error(
      `${c.variationDataDropped} combination(s) no longer exist, so their SKU and price difference were lost`,
    );
  }
  if (c.variationDataFailed > 0) {
    toast.error(
      `${c.variationDataFailed} SKU/price restore(s) failed — check those products' variations`,
    );
  }
}

export default function ProductOptions() {
  const confirm = useConfirm();
  const [catalog, setCatalog] = useState<OptionCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create / rename share one modal; `editing` null means "creating".
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogOption | null>(null);
  const [name, setName] = useState("");
  const [values, setValues] = useState<string[]>([""]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCatalog(await apiJson<OptionCatalog>("/api/options"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load options");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const atCap = catalog?.remaining != null && catalog.remaining <= 0;

  function openCreate() {
    setEditing(null);
    setName("");
    setValues([""]);
    setFormOpen(true);
  }

  function openRename(option: CatalogOption) {
    setEditing(option);
    setName(option.name);
    setValues([]); // rename only — values are managed per-row
    setFormOpen(true);
  }

  async function submit() {
    const clean = values.map((v) => v.trim()).filter(Boolean);
    if (!name.trim() || busy) return;
    if (!editing && clean.length === 0) return;

    setBusy(true);
    try {
      if (editing) {
        const res = await apiJson<{ affectedProducts: number }>(`/api/options/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify({ name: name.trim(), type: editing.type === "COLOR" ? "COLOR" : "TEXT" }),
        });
        toast.success(
          res.affectedProducts > 0
            ? `Renamed — updated on ${res.affectedProducts} product(s)`
            : "Renamed",
        );
      } else {
        await apiJson("/api/options", {
          method: "POST",
          body: JSON.stringify({ name: name.trim(), type: "TEXT", choices: clean }),
        });
        toast.success(`Created “${name.trim()}”`);
      }
      setFormOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the option");
    } finally {
      setBusy(false);
    }
  }

  async function addValue(option: CatalogOption) {
    const value = window.prompt(`New value for “${option.name}”`)?.trim();
    if (!value) return;
    try {
      await apiJson(`/api/options/${option.id}/choices`, {
        method: "POST",
        body: JSON.stringify({ value }),
      });
      // Duda itself doesn't push a new value onto products already using the
      // option. Note the product page DOES auto-select it, so adding there and
      // saving will grow that product's variations.
      toast.success(`Added “${value}”`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add the value");
    }
  }

  async function deleteValue(option: CatalogOption, choice: { id: string; value: string; usage: number }) {
    // Duda won't leave an option with no values, so the last one can only go by
    // deleting the option itself.
    if (option.choices.length <= 1) {
      toast.error(
        `“${option.name}” would be left with no values. Delete the whole option instead.`,
      );
      return;
    }

    const inUse = choice.usage > 0;
    const ok = await confirm({
      title: `Delete “${choice.value}”?`,
      description: inUse ? (
        <>
          <span className="font-semibold">
            {choice.usage} product{choice.usage === 1 ? "" : "s"}
          </span>{" "}
          currently offer this value. Deleting it permanently removes the variations that use it.
          SKUs and price differences on the remaining combinations are kept.
        </>
      ) : (
        "It's removed from the shared option, so no product will be able to offer it. Nothing uses it today."
      ),
      confirmLabel: inUse ? "Delete value & variants" : "Delete value",
      danger: true,
    });
    if (!ok) return;

    try {
      // force=true does the detach-then-delete orchestration server-side, which
      // is how Duda's own UI manages it.
      const res = await apiJson<{ cascade?: CascadeReport }>(
        `/api/options/${option.id}/choices/${choice.id}${inUse ? "?force=true" : ""}`,
        { method: "DELETE" },
      );
      const touched = res.cascade?.productsUpdated.length ?? 0;
      toast.success(
        touched > 0
          ? `Deleted “${choice.value}” and updated ${touched} product${touched === 1 ? "" : "s"}`
          : `Deleted “${choice.value}”`,
      );
      reportLostVariationData(res.cascade);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete the value");
      // The usage count behind this decision came from page load, so a rejection
      // means it went stale — reload so the chip shows the real count.
      await load();
    }
  }

  async function deleteOption(option: CatalogOption) {
    const inUse = option.usage > 0;
    const ok = await confirm({
      title: `Delete “${option.name}”?`,
      description: inUse ? (
        <>
          This option is used by <span className="font-semibold">{option.usage} product(s)</span>.
          Deleting it removes it from all of them and permanently removes the variations built from
          its values.
        </>
      ) : (
        "Nothing currently uses this option."
      ),
      confirmLabel: inUse ? "Delete option & variants" : "Delete option",
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await apiJson<{ cascade?: CascadeReport }>(
        `/api/options/${option.id}${inUse ? "?confirm=true" : ""}`,
        { method: "DELETE" },
      );
      const touched = res.cascade?.productsUpdated.length ?? 0;
      toast.success(
        touched > 0
          ? `Deleted “${option.name}” and updated ${touched} product${touched === 1 ? "" : "s"}`
          : `Deleted “${option.name}”`,
      );
      reportLostVariationData(res.cascade);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete the option");
    }
  }

  return (
    <>
      <PageHeader
        title="Product options"
        description="View and manage all the product options and values you've set up in your catalog."
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={openCreate}
            disabled={atCap}
            title={
              atCap
                ? `The catalog is at its limit of ${catalog?.max_options} options. Options are shared, so reuse one and expose just the values a product needs.`
                : undefined
            }
          >
            + Add Option
          </Button>
        }
      />

      {catalog && (
        <p className="mt-1 text-help text-muted">
          {catalog.count} of {catalog.max_options ?? "?"} options used. Options are shared across every
          product — a product chooses which of their values it offers.
        </p>
      )}

      {loading && <Loader label="Loading options…" />}
      {error && (
        <Alert tone="danger" className="mt-4">
          {error}
        </Alert>
      )}

      {!loading && !error && catalog && (
        <div className="mt-4">
          {catalog.options.length === 0 ? (
            <Card>
              <EmptyState
                title="No options yet"
                description="Add one to give products selectable values like voltage or cable length."
                action={
                  <Button variant="primary" size="sm" onClick={openCreate}>
                    + Add Option
                  </Button>
                }
              />
            </Card>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH className="w-64">Options ({catalog.count})</TH>
                  <TH>Values</TH>
                  <TH className="w-32">Included in</TH>
                  <TH className="w-12" />
                </TR>
              </THead>
              <TBody>
                {catalog.options.map((o) => (
                  <TR key={o.id}>
                    <TD className="font-medium text-text">{o.name}</TD>
                    <TD>
                      <div className="flex flex-wrap items-center gap-2">
                        {o.choices.length === 0 && (
                          <span className="text-muted">No values yet</span>
                        )}
                        {o.choices.map((c) => (
                          <span
                            key={c.id}
                            // Fixed height with the remove button inset on the
                            // right. The gap matters: the button grows a filled
                            // square on hover, and at a tighter gap that square
                            // visibly collides with the value text.
                            className="inline-flex h-8 items-center gap-2 rounded-md border border-border bg-surface pl-3 pr-1 text-body"
                            title={c.usage > 0 ? `Offered by ${c.usage} product(s)` : "Not used by any product"}
                          >
                            {c.value}
                            <RemoveButton
                              onClick={() => void deleteValue(o, c)}
                              title={
                                o.choices.length <= 1
                                  ? "An option must keep at least one value — delete the option instead"
                                  : c.usage > 0
                                    ? `Delete “${c.value}” and the variations using it on ${c.usage} product(s)`
                                    : `Delete “${c.value}”`
                              }
                              size="sm"
                            />
                          </span>
                        ))}
                      </div>
                    </TD>
                    <TD>
                      <IncludedIn option={o} />
                    </TD>
                    <TD>
                      <DropdownMenu
                        label={`Actions for ${o.name}`}
                        actions={[
                          { label: "Add value", onSelect: () => void addValue(o) },
                          { label: "Rename option", onSelect: () => openRename(o) },
                          { label: "Delete option", onSelect: () => void deleteOption(o), danger: true },
                        ]}
                      />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={() => !busy && setFormOpen(false)}
        size="md"
        title={editing ? `Rename “${editing.name}”` : "Add option"}
        description={
          editing
            ? `Renaming changes this option on every product using it${editing.usage > 0 ? ` — ${editing.usage} today.` : "."}`
            : "Options are shared across the whole catalog, so every product will be able to use this one."
        }
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setFormOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => void submit()}
              loading={busy}
              disabled={!name.trim() || (!editing && values.every((v) => !v.trim()))}
            >
              {editing ? "Rename" : "Create option"}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Field label="Option name" htmlFor="opt-name">
            <Input
              id="opt-name"
              size="sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Voltage"
              autoFocus
            />
          </Field>

          {!editing && (
            <div className="space-y-2">
              <span className="block text-body font-medium text-text">Values</span>
              {values.map((v, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    size="sm"
                    value={v}
                    onChange={(e) => setValues((vs) => vs.map((x, j) => (j === i ? e.target.value : x)))}
                    placeholder={i === 0 ? "e.g. 440V 32A" : "another value"}
                  />
                  {values.length > 1 && (
                    <RemoveButton
                      onClick={() => setValues((vs) => vs.filter((_, j) => j !== i))}
                      title="Remove value"
                    />
                  )}
                </div>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setValues((vs) => [...vs, ""])}
                disabled={
                  catalog?.max_choices_per_option != null &&
                  values.length >= catalog.max_choices_per_option
                }
              >
                + Add value
              </Button>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}

/**
 * "Included in N products", which opens the list of them: picture, name and
 * SKU, each linking to that product's editor, as the Media Centre's "Used N×". The catalogue response already carries
 * the list, so nothing is fetched. At 0 it stays a plain (red) badge, since a
 * popup listing nothing is a click wasted.
 */
function IncludedIn({ option }: { option: CatalogOption }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const label = `${option.usage} ${option.usage === 1 ? "product" : "products"}`;
  if (option.usage === 0 || option.products.length === 0) {
    return <Badge tone={option.usage > 0 ? "neutral" : "danger"}>{label}</Badge>;
  }
  const products = [...option.products]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => ({ dudaProductId: p.id, name: p.name, sku: p.sku, thumbnailUrl: p.thumbnailUrl ?? null, via: [] }));
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        title="See which products use this option"
        className="group"
      >
        {/* Darker as a whole on hover, like the Media Centre's pill: the fill
            takes the border's own colour, so the badge reads as one shape. */}
        <Badge tone="neutral" className="cursor-pointer transition-colors group-hover:bg-border group-hover:text-text">
          {label}
        </Badge>
      </button>
      {open && (
        <UsageDialog
          count={option.usage}
          subject={`Option: ${option.name}`}
          verb="Included in"
          load={() => Promise.resolve({ products })}
          onClose={close}
        />
      )}
    </>
  );
}
