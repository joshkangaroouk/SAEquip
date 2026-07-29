import { useState } from "react";
import { Badge, Button, Card, CardHeader, EmptyState, Input, Select, Table, TBody, TD, TH, THead, TR } from "../ui";
import type { OptionRefDraft, VariationDraft } from "./productEditorTypes";

/**
 * Generated variations.
 *
 * These are Duda's cartesian product of the attached choices — they cannot be
 * added or removed here, only annotated with a SKU, price difference and
 * visibility.
 *
 * The table locks while Options are dirty, and that is a correctness measure,
 * not caution: saving an option change makes Duda regenerate every variation
 * with new ids, so anything typed here first would be written to ids that no
 * longer exist. Save the options, then annotate the regenerated rows.
 */
export function VariationsSection({
  variations,
  options,
  lockedByOptions,
  dirty,
  error,
  onChange,
  onChangeAll,
  hideCommerce = false,
}: {
  variations: VariationDraft[];
  options: OptionRefDraft[];
  lockedByOptions: boolean;
  dirty: boolean;
  error?: string;
  onChange: (id: string, patch: Partial<VariationDraft>) => void;
  onChangeAll: (patch: Partial<VariationDraft>) => void;
  /** Hides the price-difference column and its bulk-fill control. */
  hideCommerce?: boolean;
}) {
  const [bulkPrice, setBulkPrice] = useState("");

  const columns = options.length > 0 ? options : [];

  return (
    <Card id="section-variations">
      <CardHeader
        title="Variations"
        description={
          hideCommerce
            ? "Generated automatically from the option values above. Add SKUs here."
            : "Generated automatically from the option values above. Add SKUs and price differences here."
        }
        actions={
          <>
            {dirty && <Badge tone="accent">Unsaved</Badge>}
            <Badge tone="neutral">{variations.length}</Badge>
          </>
        }
      />

      {error && (
        <div className="mb-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-small text-danger">
          {error}
        </div>
      )}

      {lockedByOptions && (
        <div className="mb-4 rounded-md border border-accent/50 bg-accent/10 px-3 py-2 text-small text-text">
          <span className="font-semibold">Save your option changes first.</span> Duda rebuilds this
          list when the options change, so SKUs and prices are entered afterwards.
        </div>
      )}

      {variations.length === 0 ? (
        <EmptyState
          title="No variations"
          description={
            options.length === 0
              ? "Attach an option above to generate variations."
              : "Select at least one value on each attached option."
          }
        />
      ) : (
        <>
          {/* Bulk fill — mandatory ergonomics past a handful of rows, and this
              can reach 300. */}
          {!lockedByOptions && variations.length > 2 && (
            <div className="mb-3 flex flex-wrap items-end gap-2 rounded-md border border-border bg-surface-2 p-3">
              <span className="text-small font-semibold text-text">Set all:</span>
              {!hideCommerce && (
                <>
                  <Input
                    size="sm"
                    className="w-28"
                    inputMode="decimal"
                    value={bulkPrice}
                    onChange={(e) => setBulkPrice(e.target.value)}
                    placeholder="Price Δ"
                    aria-label="Price difference for all variations"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!/^-?\d+(\.\d+)?$/.test(bulkPrice)}
                    onClick={() => onChangeAll({ price_difference: bulkPrice })}
                  >
                    Apply price Δ
                  </Button>
                  <span className="mx-1 h-6 w-px bg-border" />
                </>
              )}
              <Button variant="ghost" size="sm" onClick={() => onChangeAll({ status: "ACTIVE" })}>
                All active
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onChangeAll({ status: "HIDDEN" })}>
                All hidden
              </Button>
            </div>
          )}

          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH className="w-px">#</TH>
                  {columns.map((o) => (
                    <TH key={o.id}>{o.name}</TH>
                  ))}
                  <TH>SKU</TH>
                  {!hideCommerce && <TH className="w-28">Price Δ</TH>}
                  <TH className="w-32">Status</TH>
                </TR>
              </THead>
              <TBody>
                {variations.map((v, idx) => {
                  const byOption = new Map(v.choices.map((c) => [c.optionId, c.value]));
                  return (
                    <TR key={v.id}>
                      <TD className="w-px text-subtle">{idx + 1}</TD>
                      {columns.map((o) => (
                        <TD key={o.id} className="whitespace-nowrap font-medium text-text">
                          {byOption.get(o.id) ?? "—"}
                        </TD>
                      ))}
                      <TD>
                        <Input
                          size="sm"
                          value={v.sku}
                          disabled={lockedByOptions}
                          onChange={(e) => onChange(v.id, { sku: e.target.value })}
                          placeholder="optional"
                          aria-label={`SKU for variation ${idx + 1}`}
                        />
                      </TD>
                      {!hideCommerce && (
                        <TD>
                          <Input
                            size="sm"
                            className={
                              /^-?\d+(\.\d+)?$/.test(v.price_difference)
                                ? undefined
                                : "border-danger focus:border-danger"
                            }
                            inputMode="decimal"
                            value={v.price_difference}
                            disabled={lockedByOptions}
                            onChange={(e) => onChange(v.id, { price_difference: e.target.value })}
                            aria-label={`Price difference for variation ${idx + 1}`}
                          />
                        </TD>
                      )}
                      <TD>
                        <Select
                          size="sm"
                          value={v.status === "HIDDEN" ? "HIDDEN" : "ACTIVE"}
                          disabled={lockedByOptions}
                          onChange={(e) => onChange(v.id, { status: e.target.value })}
                          aria-label={`Status for variation ${idx + 1}`}
                        >
                          <option value="ACTIVE">Active</option>
                          <option value="HIDDEN">Hidden</option>
                        </Select>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </div>
        </>
      )}
    </Card>
  );
}
