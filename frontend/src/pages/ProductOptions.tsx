import { useCallback, useEffect, useState } from "react";
import {
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
import type { CatalogOption, OptionCatalog } from "../components/product/productEditorTypes";

/**
 * Store-level Product Options catalog — the manager the product page
 * deliberately doesn't offer, because renaming an option or deleting a value
 * rewrites every product using it.
 *
 * Mirrors Duda's own screen: one row per option, its values, and how many
 * products include it.
 */
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
      // Adding is safe: verified that a new value does NOT propagate to products
      // already using the option — each keeps its own selection.
      toast.success(`Added “${value}”`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add the value");
    }
  }

  async function deleteValue(option: CatalogOption, choice: { id: string; value: string; usage: number }) {
    if (choice.usage > 0) {
      toast.error(
        `“${choice.value}” is still offered by ${choice.usage} product(s). Deselect it there and save first.`,
      );
      return;
    }
    const ok = await confirm({
      title: `Delete “${choice.value}”?`,
      description: "It's removed from the shared option, so no product will be able to offer it. Nothing uses it today.",
      confirmLabel: "Delete value",
      danger: true,
    });
    if (!ok) return;
    try {
      await apiJson(`/api/options/${option.id}/choices/${choice.id}`, { method: "DELETE" });
      toast.success(`Deleted “${choice.value}”`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete the value");
    }
  }

  async function deleteOption(option: CatalogOption) {
    const inUse = option.usage > 0;
    const ok = await confirm({
      title: `Delete “${option.name}”?`,
      description: inUse ? (
        <>
          This option is used by <span className="font-semibold">{option.usage} product(s)</span>.
          Deleting it removes it from all of them and regenerates their variations.
        </>
      ) : (
        "Nothing currently uses this option."
      ),
      confirmLabel: "Delete option",
      danger: true,
    });
    if (!ok) return;
    try {
      await apiJson(`/api/options/${option.id}${inUse ? "?confirm=true" : ""}`, { method: "DELETE" });
      toast.success(`Deleted “${option.name}”`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete the option");
    }
  }

  return (
    <>
      <PageHeader
        title="Product Options"
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
        <p className="mt-1 text-small text-muted">
          {catalog.count} of {catalog.max_options ?? "?"} options used. Options are shared across every
          product — a product chooses which of their values it offers.
        </p>
      )}

      {loading && <Loader label="Loading options…" />}
      {error && (
        <div className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-body text-danger">
          {error}
        </div>
      )}

      {!loading && !error && catalog && (
        <Card className="mt-4 p-0">
          {catalog.options.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="No options yet"
                description="Add one to give products selectable values like voltage or cable length."
                action={
                  <Button variant="primary" size="sm" onClick={openCreate}>
                    + Add Option
                  </Button>
                }
              />
            </div>
          ) : (
            <Table className="border-0">
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
                      <div className="flex flex-wrap items-center gap-1.5">
                        {o.choices.length === 0 && (
                          <span className="text-muted">No values yet</span>
                        )}
                        {o.choices.map((c) => (
                          <span
                            key={c.id}
                            className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-2 px-2 py-0.5 text-small"
                            title={c.usage > 0 ? `Offered by ${c.usage} product(s)` : "Not used by any product"}
                          >
                            {c.value}
                            <RemoveButton
                              onClick={() => void deleteValue(o, c)}
                              title={
                                c.usage > 0
                                  ? `${c.usage} product(s) still offer this value`
                                  : `Delete “${c.value}”`
                              }
                              className="h-4 w-4 text-sm"
                            />
                          </span>
                        ))}
                      </div>
                    </TD>
                    <TD>
                      <Badge tone={o.usage > 0 ? "neutral" : "danger"}>
                        {o.usage} {o.usage === 1 ? "product" : "products"}
                      </Badge>
                    </TD>
                    <TD>
                      <DropdownMenu
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
        </Card>
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
