import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import {
  Alert,
  Button,
  Card,
  CardHeader,
  DropdownMenu,
  EmptyState,
  Field,
  Input,
  Skeleton,
  SkeletonLine,
  Modal,
  PageHeader,
  RemoveButton,
  toast,
  useConfirm,
} from "../components/ui";
import { apiJson } from "../lib/api";
import { cn } from "../lib/cn";
import { UsagePill } from "../components/UsagePill";
import type { CatalogOption, OptionCatalog } from "../components/product/productEditorTypes";

/**
 * Store-level Product Options catalog — the manager the product page
 * deliberately doesn't offer, because renaming an option or deleting a value
 * rewrites every product using it.
 *
 * One card per option (00): its values as chips, how many products include
 * it, and its actions, under a meter of the store's option limit.
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

  // The "Add value" dialog (the menu's way in, replacing window.prompt).
  const [adding, setAdding] = useState<CatalogOption | null>(null);
  const [newValue, setNewValue] = useState("");
  const [addBusy, setAddBusy] = useState(false);

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

  /**
   * Add a value to an option: the card's inline "New value…" field and the
   * menu's "Add value" dialog both come here. True when it was added.
   */
  async function addChoice(option: CatalogOption, raw: string): Promise<boolean> {
    const value = raw.trim();
    if (!value) return false;
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
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add the value");
      return false;
    }
  }

  function openAddValue(option: CatalogOption) {
    setNewValue("");
    setAdding(option);
  }

  async function submitAddValue(e?: FormEvent) {
    e?.preventDefault();
    if (!adding || !newValue.trim() || addBusy) return;
    setAddBusy(true);
    const ok = await addChoice(adding, newValue);
    setAddBusy(false);
    if (ok) setAdding(null);
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

  const maxChoices = catalog?.max_choices_per_option ?? null;

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
            <Plus size={16} aria-hidden="true" />
            Add option
          </Button>
        }
      />

      {catalog && <OptionsMeter count={catalog.count} max={catalog.max_options} />}

      {/* The skeleton is for the FIRST load only. Every change reloads the
          catalogue, and the cards stay while it does, dimmed and inert, rather
          than vanishing behind a placeholder each time. */}
      {loading && !catalog && <OptionsSkeleton />}
      {error && <Alert tone="danger">{error}</Alert>}

      {!error && catalog && (
        <div aria-busy={loading || undefined} className={cn(loading && "pointer-events-none opacity-50")}>
          {catalog.options.length === 0 ? (
            <EmptyState
              title="No options yet"
              description="Add one to give products selectable values like voltage or cable length."
              action={
                <Button variant="primary" size="sm" onClick={openCreate}>
                  <Plus size={16} aria-hidden="true" />
                  Add option
                </Button>
              }
            />
          ) : (
            <div className="grid gap-5 xl:grid-cols-2">
              {catalog.options.map((o) => {
                const full = maxChoices != null && o.choices.length >= maxChoices;
                return (
                  <Card key={o.id} aria-label={`Option: ${o.name}`} role="group">
                    <CardHeader
                      title={o.name}
                      // Centred: the 34px menu button would otherwise sit the
                      // chip below the title's line.
                      className="items-center"
                      actions={
                        <>
                          <IncludedIn option={o} />
                          <DropdownMenu
                            label={`Actions for ${o.name}`}
                            actions={[
                              { label: "Add value…", onSelect: () => openAddValue(o), disabled: full },
                              { label: "Rename option", onSelect: () => openRename(o) },
                              { label: "Delete option", onSelect: () => void deleteOption(o), danger: true },
                            ]}
                          />
                        </>
                      }
                    />
                    <ul className="flex flex-wrap items-center gap-2" aria-label={`Values of ${o.name}`}>
                      {o.choices.length === 0 && <li className="text-help text-muted">No values yet</li>}
                      {o.choices.map((c, i) => (
                        <li key={c.id}>
                          <ValueChip
                            value={c.value}
                            usage={c.usage}
                            preselected={i === 0}
                            onRemove={() => void deleteValue(o, c)}
                            removeTitle={
                              o.choices.length <= 1
                                ? "An option must keep at least one value — delete the option instead"
                                : c.usage > 0
                                  ? `Delete “${c.value}” and the variations using it on ${c.usage} product(s)`
                                  : `Delete “${c.value}”`
                            }
                          />
                        </li>
                      ))}
                      <li>
                        <NewValueField
                          optionName={o.name}
                          disabled={full}
                          onAdd={(v) => addChoice(o, v)}
                        />
                      </li>
                    </ul>
                  </Card>
                );
              })}
            </div>
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
        <div className="space-y-4">
          <Field label="Option name" htmlFor="opt-name">
            <Input
              id="opt-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Voltage"
              autoFocus
            />
          </Field>

          {!editing && (
            <fieldset className="space-y-2">
              <legend className="t-label mb-1.5">Values</legend>
              {values.map((v, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={v}
                    onChange={(e) => setValues((vs) => vs.map((x, j) => (j === i ? e.target.value : x)))}
                    placeholder={i === 0 ? "e.g. 440V 32A" : "Another value"}
                    aria-label={`Value ${i + 1}`}
                  />
                  {values.length > 1 && (
                    <RemoveButton
                      onClick={() => setValues((vs) => vs.filter((_, j) => j !== i))}
                      title={`Remove value ${i + 1}`}
                    />
                  )}
                </div>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setValues((vs) => [...vs, ""])}
                disabled={maxChoices != null && values.length >= maxChoices}
              >
                <Plus size={16} aria-hidden="true" />
                Add value
              </Button>
            </fieldset>
          )}
        </div>
      </Modal>

      {/* "Add value…" from a card's menu: the dialog that replaced window.prompt. */}
      <Modal
        open={adding !== null}
        onClose={() => !addBusy && setAdding(null)}
        size="md"
        title={adding ? `Add a value to “${adding.name}”` : "Add a value"}
        description="Products already using this option don't offer it until they're edited."
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setAdding(null)} disabled={addBusy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="add-value-form"
              loading={addBusy}
              disabled={!newValue.trim()}
            >
              Add value
            </Button>
          </div>
        }
      >
        <form id="add-value-form" onSubmit={(e) => void submitAddValue(e)}>
          <Field label="Value" htmlFor="add-value-input">
            <Input
              id="add-value-input"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="New value…"
              autoFocus
            />
          </Field>
        </form>
      </Modal>
    </>
  );
}

/**
 * Options used against the store's limit (00 "variation meter", "2 of 20").
 * In tones and never yellow (02a Q25): --text normally, --warning above 80%,
 * --danger at the cap — where "Add option" is disabled too (KEEP-F).
 */
function OptionsMeter({ count, max }: { count: number; max: number | null }) {
  const pct = max ? Math.min(100, (count / max) * 100) : 0;
  const atCap = max != null && count >= max;
  const near = max != null && !atCap && count / max > 0.8;
  const tone = atCap ? "danger" : near ? "warning" : null;
  return (
    <section aria-label="Options used" className="mb-5 border border-border bg-surface px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="t-label">Options used</span>
        <span className={cn("text-body", tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "text-text")}>
          <span className="font-mono">
            {count} of {max ?? "?"}
          </span>
          {atCap && <span className="font-medium"> · at the limit</span>}
          {near && max != null && <span className="font-medium"> · {max - count} left</span>}
        </span>
      </div>
      {max != null && (
        <div
          role="meter"
          aria-label="Options used"
          aria-valuemin={0}
          aria-valuemax={max}
          aria-valuenow={count}
          aria-valuetext={`${count} of ${max} options used`}
          // The track's edge is --border-input (3:1): on --surface-2 alone the
          // empty part was 1.07:1, so the meter's full length could not be seen.
          className="mt-2 h-2.5 border border-border-input bg-surface-2"
        >
          <div
            className={cn("h-full", tone === "danger" ? "bg-danger" : tone === "warning" ? "bg-warning" : "bg-text")}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      <p className="t-help mt-2">
        Options are shared across every product — a product chooses which of their values it offers.
      </p>
    </section>
  );
}

/**
 * The page while the catalogue first loads (11 §1): the meter and two option
 * cards, with the static copy as itself and blocks where the data goes. One
 * polite announcement; the blocks are aria-hidden.
 */
function OptionsSkeleton() {
  return (
    <div aria-busy="true">
      <p role="status" className="sr-only">
        Loading options
      </p>
      <div aria-hidden="true">
        <div className="mb-5 border border-border bg-surface px-5 py-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="t-label">Options used</span>
            {/* Inter round a mono run, as the count is: the two fonts' line boxes together. */}
            <span className="text-body">
              {"\u200b"}
              <span className="font-mono">
                {"\u200b"}
                <Skeleton className="inline-block h-[0.8em] w-14 align-middle" />
              </span>
            </span>
          </div>
          <Skeleton className="mt-2 h-2.5 w-full" />
          <p className="t-help mt-2">
            Options are shared across every product — a product chooses which of their values it offers.
          </p>
        </div>
        <div className="grid gap-5 xl:grid-cols-2">
          {/* Chips about as wide as real values (with "Pre-selected" and a
              count), so they wrap where the real ones do. */}
          {[["w-[150px]", "w-[110px]", "w-[90px]"], ["w-[240px]", "w-[70px]"]].map((chips, i) => (
            <Card key={i}>
              {/* CardHeader's row in a padded card, centred as the option cards' is. */}
              <div className="-mx-5 -mt-5 mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
                <SkeletonLine text="t-section" className="h-[0.8em] w-32" />
                <div className="flex shrink-0 items-center gap-2">
                  <Skeleton className="h-6.5 w-24" />
                  <Skeleton className="h-8.5 w-8.5" />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {chips.map((w) => (
                  <Skeleton key={w} className={`h-6.5 ${w}`} />
                ))}
                <Skeleton className="h-7 w-36" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * A value: a 26px chip with its 20px remove button (02a Q11). The first value
 * carries "Pre-selected": Duda pre-selects a product's first offered value, in
 * the option's order.
 */
function ValueChip({
  value,
  usage,
  preselected,
  onRemove,
  removeTitle,
}: {
  value: string;
  usage: number;
  preselected: boolean;
  onRemove: () => void;
  removeTitle: string;
}) {
  return (
    <span
      className="inline-flex h-6.5 items-center gap-1.5 border border-border bg-chip pl-2.5 pr-0.5 text-help text-text"
      title={usage > 0 ? `Offered by ${usage} product(s)` : "Not used by any product"}
    >
      {value}
      {preselected && (
        <span
          className="inline-flex h-4.5 items-center bg-text px-1.5 font-heading text-micro font-semibold uppercase text-surface"
          title="Duda pre-selects this value on product pages that offer it"
        >
          Pre-selected
        </span>
      )}
      <RemoveButton onClick={onRemove} title={removeTitle} size="sm" />
    </span>
  );
}

/**
 * The card's inline "New value…" field (28px, so it sits in the row of
 * chips). Enter adds it, through the same call as the dialog.
 */
function NewValueField({
  optionName,
  disabled,
  onAdd,
}: {
  optionName: string;
  disabled: boolean;
  onAdd: (value: string) => Promise<boolean>;
}) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim() || saving) return;
    setSaving(true);
    const ok = await onAdd(text);
    setSaving(false);
    if (ok) setText("");
  }
  return (
    <form onSubmit={(e) => void submit(e)} className="flex items-center">
      <Input
        size="chip"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="New value…"
        aria-label={`New value for ${optionName}`}
        disabled={disabled || saving}
        title={disabled ? "This option has as many values as the store allows" : "Type a value and press Enter"}
        className="w-36"
      />
    </form>
  );
}

/**
 * "N products", which opens the list of them: picture, name and SKU, each
 * linking to that product's editor — the shared UsagePill, as on Media and
 * Logos. The catalogue response already carries the list, so nothing is
 * fetched. At 0 (or with no list) it is a plain neutral chip: an unused option
 * is not a fault (02 §6), and a popup listing nothing is a click wasted.
 */
function IncludedIn({ option }: { option: CatalogOption }) {
  const label = `${option.usage} ${option.usage === 1 ? "product" : "products"}`;
  const products = [...option.products]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => ({ dudaProductId: p.id, name: p.name, sku: p.sku, thumbnailUrl: p.thumbnailUrl ?? null, via: [] }));
  return (
    <UsagePill
      count={products.length > 0 ? option.usage : 0}
      label={label}
      subject={`Option: ${option.name}`}
      verb="Included in"
      load={() => Promise.resolve({ products })}
    />
  );
}
