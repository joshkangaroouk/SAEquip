import { useState } from "react";
import { Badge, Button, Card, CardHeader, EmptyState, RemoveButton, toast, useConfirm } from "../ui";
import { apiJson } from "../../lib/api";
import { cartesianSize } from "./normalize";
import { AttachOptionModal } from "./AttachOptionModal";
import { VariationCountMeter } from "./VariationCountMeter";
import type { CatalogOption, OptionCatalog, OptionRefDraft } from "./productEditorTypes";

/**
 * Per-product option attachment.
 *
 * Two distinct surfaces, deliberately separated by how much damage they can do:
 *
 *  - SAFE (default): attach/detach options and pick which of their choices this
 *    product exposes. Scoped to this product; cannot affect any other.
 *  - SHARED (behind a confirm): adding a choice to the catalog option itself.
 *    Verified safe — a new catalog choice does NOT propagate to products
 *    already using the option — but it is still a catalog-wide edit.
 *
 * Renaming and deleting catalog options/choices are intentionally NOT offered
 * here: those rewrite every product using them, and doing that from inside one
 * product's page invites accidents. They belong in a dedicated catalog manager.
 */
export function OptionsSection({
  options,
  catalog,
  currentVariationCount,
  maxVariations,
  dirty,
  error,
  onAttach,
  onDetach,
  onToggleChoice,
  onCatalogChanged,
}: {
  options: OptionRefDraft[];
  catalog: OptionCatalog;
  currentVariationCount: number;
  maxVariations: number | null;
  dirty: boolean;
  error?: string;
  onAttach: (option: CatalogOption) => void;
  onDetach: (optionId: string) => void;
  onToggleChoice: (optionId: string, choiceId: string) => void;
  onCatalogChanged: () => Promise<void> | void;
}) {
  const confirm = useConfirm();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [newChoice, setNewChoice] = useState("");
  const [busy, setBusy] = useState(false);

  const projected = cartesianSize(options);
  const byId = new Map(catalog.options.map((o) => [o.id, o]));

  async function detach(ref: OptionRefDraft) {
    const lost = options.length > 1 ? projected / Math.max(ref.choiceIds.length, 1) : 0;
    const ok = await confirm({
      title: `Remove “${ref.name}” from this product?`,
      description: (
        <>
          The option stays in the shared catalog and on other products — this only removes it here.
          Variations will regenerate{" "}
          <span className="font-semibold">
            ({projected} → {options.length > 1 ? lost : 0})
          </span>
          , and any SKU or price difference for combinations that no longer exist will be lost.
        </>
      ),
      confirmLabel: "Remove",
      danger: true,
    });
    if (ok) onDetach(ref.id);
  }

  async function addCatalogChoice(optionId: string, optionName: string) {
    const value = newChoice.trim();
    if (!value || busy) return;
    setBusy(true);
    try {
      // The response is { choice, option } — Duda's own body is the whole
      // option, whose `id` is the OPTION's, so the backend resolves the real
      // new choice for us rather than letting that id leak in here.
      const { choice } = await apiJson<{ choice: { id: string; value: string } }>(
        `/api/options/${optionId}/choices`,
        { method: "POST", body: JSON.stringify({ value }) },
      );
      toast.success(`Added “${choice.value}” to ${optionName}`);
      // Refresh the catalog FIRST so the new choice exists locally before this
      // product opts into it — otherwise the chip has nothing to render from.
      await onCatalogChanged();
      onToggleChoice(optionId, choice.id);
      setNewChoice("");
      setAddingTo(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add the choice");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Card id="section-options">
        <CardHeader
          title="Options"
          description="Options are shared across the whole store; each product chooses which of their values it offers."
          actions={
            <>
              {dirty && <Badge tone="accent">Unsaved</Badge>}
              <VariationCountMeter
                current={currentVariationCount}
                projected={projected}
                max={maxVariations}
              />
              <Button variant="secondary" size="sm" onClick={() => setPickerOpen(true)}>
                Attach option
              </Button>
            </>
          }
        />

        {error && (
          <div className="mb-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-small text-danger">
            {error}
          </div>
        )}

        {dirty && (
          <div className="mb-4 rounded-md border border-accent/50 bg-accent/10 px-3 py-2 text-small text-text">
            Saving this regenerates the variation list. SKUs and price differences are carried across
            for combinations that still exist; any that disappear lose theirs.
          </div>
        )}

        {options.length === 0 ? (
          <EmptyState
            title="No options on this product"
            description="Attach one to generate purchasable variations, or leave it as a single-variant product."
          />
        ) : (
          <div className="space-y-3">
            {options.map((ref) => {
              const cat = byId.get(ref.id);
              const selected = new Set(ref.choiceIds);
              return (
                <div key={ref.id} className="rounded-md border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-small font-semibold text-text">{ref.name}</span>
                      {cat && (
                        <Badge tone="neutral">
                          shared with {Math.max(cat.usage - 1, 0)} other{" "}
                          {Math.max(cat.usage - 1, 0) === 1 ? "product" : "products"}
                        </Badge>
                      )}
                      <span className="text-small text-muted">
                        {ref.choiceIds.length} of {cat?.choices.length ?? ref.choiceIds.length} values
                      </span>
                    </div>
                    <RemoveButton onClick={() => void detach(ref)} title="Remove from this product" />
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {(cat?.choices ?? []).map((c) => {
                      const on = selected.has(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => onToggleChoice(ref.id, c.id)}
                          aria-pressed={on}
                          className={`rounded-full border px-3 py-1 text-small font-medium transition ${
                            on
                              ? "border-accent bg-accent/15 text-text"
                              : "border-border text-muted hover:border-subtle"
                          }`}
                          title={on ? "Offered on this product" : "Not offered on this product"}
                        >
                          {c.value}
                        </button>
                      );
                    })}

                    {addingTo === ref.id ? (
                      <span className="flex items-center gap-1">
                        <input
                          value={newChoice}
                          onChange={(e) => setNewChoice(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void addCatalogChoice(ref.id, ref.name);
                            if (e.key === "Escape") setAddingTo(null);
                          }}
                          placeholder="New value…"
                          autoFocus
                          className="w-32 rounded-full border border-border bg-surface px-3 py-1 text-small focus:border-accent focus:outline-none"
                        />
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => void addCatalogChoice(ref.id, ref.name)}
                          disabled={!newChoice.trim()}
                          loading={busy}
                        >
                          Add
                        </Button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setAddingTo(ref.id);
                          setNewChoice("");
                        }}
                        className="rounded-full border border-dashed border-border px-3 py-1 text-small text-muted hover:border-subtle hover:text-text"
                        title="Adds a value to the shared option. Existing products keep their own selection."
                      >
                        + value
                      </button>
                    )}
                  </div>

                  {ref.choiceIds.length === 0 && (
                    <p className="mt-2 text-small text-danger">
                      Select at least one value, or remove this option.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <AttachOptionModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        catalog={catalog}
        attachedIds={options.map((o) => o.id)}
        onAttach={(o) => {
          onAttach(o);
          setPickerOpen(false);
        }}
        onCatalogChanged={onCatalogChanged}
      />
    </>
  );
}
