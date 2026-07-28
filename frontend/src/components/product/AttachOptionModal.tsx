import { useMemo, useState } from "react";
import { Badge, Button, Field, Input, Modal, RemoveButton, toast } from "../ui";
import { apiJson } from "../../lib/api";
import type { CatalogOption, OptionCatalog } from "./productEditorTypes";

/**
 * Picks an option from the SHARED store catalog to attach, or creates a new one.
 *
 * The headroom counter is prominent on purpose: `max_options` is a per-catalog
 * cap (20) shared across every product, and it did not rise with the store plan
 * upgrade — so it's the binding constraint across the whole product range. The
 * right instinct is to reuse an option and expose a subset of its choices, not
 * to create a near-duplicate.
 */
export function AttachOptionModal({
  open,
  onClose,
  catalog,
  attachedIds,
  onAttach,
  onCatalogChanged,
}: {
  open: boolean;
  onClose: () => void;
  catalog: OptionCatalog;
  attachedIds: string[];
  onAttach: (option: CatalogOption) => void;
  onCatalogChanged: () => Promise<void> | void;
}) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newChoices, setNewChoices] = useState<string[]>([""]);
  const [busy, setBusy] = useState(false);

  const attached = new Set(attachedIds);
  const q = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      catalog.options.filter(
        (o) =>
          !q ||
          o.name.toLowerCase().includes(q) ||
          o.choices.some((c) => c.value.toLowerCase().includes(q)),
      ),
    [catalog.options, q],
  );

  const atCap = catalog.remaining != null && catalog.remaining <= 0;
  const cleanChoices = newChoices.map((c) => c.trim()).filter(Boolean);
  const canCreate = newName.trim().length > 0 && cleanChoices.length > 0 && !atCap;

  async function createOption() {
    if (!canCreate || busy) return;
    setBusy(true);
    try {
      const created = await apiJson<CatalogOption>("/api/options", {
        method: "POST",
        body: JSON.stringify({ name: newName.trim(), type: "TEXT", choices: cleanChoices }),
      });
      toast.success(`Created “${created.name}”`);
      await onCatalogChanged();
      // Attach it straight away — creating one you don't then use is never the intent.
      onAttach({ ...created, usage: 0, products: [], choices: created.choices ?? [] });
      setCreating(false);
      setNewName("");
      setNewChoices([""]);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the option");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Attach an option"
      description="Options are shared across the whole store. Attach an existing one and pick which of its choices this product offers."
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <Badge tone={atCap ? "danger" : catalog.remaining != null && catalog.remaining <= 3 ? "accent" : "neutral"}>
            {catalog.count} / {catalog.max_options ?? "?"} options used
          </Badge>
          <Button variant="ghost" onClick={onClose}>
            Done
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search options or choices…"
        />

        <div className="max-h-72 space-y-2 overflow-y-auto">
          {visible.length === 0 && (
            <p className="text-small text-subtle">
              {catalog.options.length === 0
                ? "The store has no options yet — create the first one below."
                : `No options match “${query}”.`}
            </p>
          )}

          {visible.map((o) => {
            const isAttached = attached.has(o.id);
            return (
              <div
                key={o.id}
                className="flex flex-wrap items-center gap-3 rounded-md border border-border p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-small font-semibold text-text">{o.name}</span>
                    <Badge tone="neutral">
                      used by {o.usage} {o.usage === 1 ? "product" : "products"}
                    </Badge>
                  </div>
                  <p className="mt-1 truncate text-small text-muted">
                    {o.choices.map((c) => c.value).join(" · ") || "no choices"}
                  </p>
                </div>
                <Button
                  variant={isAttached ? "ghost" : "secondary"}
                  size="sm"
                  disabled={isAttached}
                  onClick={() => onAttach(o)}
                >
                  {isAttached ? "Attached" : "Attach"}
                </Button>
              </div>
            );
          })}
        </div>

        <div className="border-t border-border pt-4">
          {!creating ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCreating(true)}
              disabled={atCap}
              title={
                atCap
                  ? `The catalog is at its limit of ${catalog.max_options} options. Reuse an existing option instead — a product can expose just the choices it needs.`
                  : undefined
              }
            >
              + Create a new option
            </Button>
          ) : (
            <div className="space-y-3">
              <p className="text-small text-muted">
                This adds to the shared catalog, so every product will be able to use it.
              </p>
              <Field label="Option name" htmlFor="new-opt-name">
                <Input
                  id="new-opt-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Voltage"
                  autoFocus
                />
              </Field>

              <div className="space-y-2">
                <span className="block text-small font-semibold text-text">Choices</span>
                {newChoices.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={c}
                      onChange={(e) =>
                        setNewChoices((cs) => cs.map((v, j) => (j === i ? e.target.value : v)))
                      }
                      placeholder={i === 0 ? "e.g. 440V 32A" : "another choice"}
                    />
                    {newChoices.length > 1 && (
                      <RemoveButton
                        onClick={() => setNewChoices((cs) => cs.filter((_, j) => j !== i))}
                        title="Remove choice"
                      />
                    )}
                  </div>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setNewChoices((cs) => [...cs, ""])}
                  disabled={
                    catalog.max_choices_per_option != null &&
                    newChoices.length >= catalog.max_choices_per_option
                  }
                >
                  + Add choice
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="primary" size="sm" onClick={() => void createOption()} disabled={!canCreate} loading={busy}>
                  Create and attach
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setCreating(false)} disabled={busy}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
