import { Link, useParams } from "react-router-dom";
import { Badge, Card, CardHeader, Loader, StatusBadge } from "../components/ui";
import { LogoActivationPanel } from "../components/LogoActivationPanel";
import { SpecTableEditor } from "../components/SpecTableEditor";
import { TextItemListEditor } from "../components/TextItemListEditor";
import { UnsavedChangesModal } from "../components/UnsavedChangesModal";
import { DangerZoneSection } from "../components/product/DangerZoneSection";
import { DescriptionSection } from "../components/product/DescriptionSection";
import { ImagesSection } from "../components/product/ImagesSection";
import { ProductDetailsSection } from "../components/product/ProductDetailsSection";
import { ProductSaveBar } from "../components/product/ProductSaveBar";
import { useProductEditor } from "../components/product/useProductEditor";
import { useUnsavedChangesWarning } from "../hooks/useUnsavedChangesWarning";

/** Read-only pill for sections that aren't editable yet. */
const readOnlyNote = <Badge tone="neutral">Read only for now</Badge>;

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const editor = useProductEditor(id);
  const {
    context,
    draft,
    loading,
    loadError,
    loadedAt,
    saving,
    savingLabel,
    saveErrors,
    validationErrors,
    dirty,
    isDirty,
    isValid,
    dirtyLabels,
    setSection,
    toggleLogo,
    reset,
    save,
    reload,
    guardSuppressed,
    disarmGuard,
  } = editor;

  // Arm the navigate-away guard only while there's something to lose, and never
  // mid-save or during a deliberate exit.
  const blocker = useUnsavedChangesWarning({ when: isDirty && !guardSuppressed() });

  const product = context?.product;

  return (
    <>
      <UnsavedChangesModal blocker={blocker} onSave={save} dirtyLabels={dirtyLabels} />

      <div className="mx-auto max-w-4xl pb-4">
        <Link to="/" className="text-sm text-muted hover:text-text">
          ← Back to products
        </Link>

        {loading && <Loader label="Loading product…" />}
        {loadError && (
          <div className="mt-6 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {loadError}
          </div>
        )}

        {!loading && !loadError && product && draft && context && (
          <div className="mt-4 space-y-6">
            {/* Header — live summary of the saved product, not the draft. */}
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="truncate text-2xl font-semibold text-text">{product.name}</h1>
                  <p className="mt-1 text-sm text-muted">
                    SKU: {product.sku || "—"}
                    {loadedAt && (
                      <>
                        {" · "}
                        <span title="Edits made in Duda after this time won't be reflected until you refresh.">
                          loaded {loadedAt.toLocaleTimeString()}
                        </span>{" "}
                        <button
                          type="button"
                          onClick={() => void reload()}
                          disabled={isDirty || saving}
                          title={
                            isDirty
                              ? "Save or reset your changes before refreshing"
                              : "Re-read this product from Duda"
                          }
                          className="underline underline-offset-2 hover:text-text disabled:cursor-not-allowed disabled:no-underline disabled:opacity-40"
                        >
                          refresh
                        </button>
                      </>
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <StatusBadge status={product.status} />
                  <StatusBadge status={product.stock_status} />
                  <Badge tone="neutral">{product.type}</Badge>
                </div>
              </div>
            </Card>

            <ProductDetailsSection
              value={draft.details}
              onChange={(next) => setSection("details", next)}
              dirty={dirty.details}
              error={saveErrors.details ?? validationErrors.details}
            />

            <DescriptionSection
              value={draft.details.description}
              onChange={(html) => setSection("details", { ...draft.details, description: html })}
              dirty={dirty.details}
            />

            <ImagesSection
              images={draft.images}
              onChange={(next) => setSection("images", next)}
              dirty={dirty.images}
              error={saveErrors.images ?? validationErrors.images}
            />

            {/* Options & Variations — editable in a later stage. */}
            <Card>
              <CardHeader
                title="Options & Variations"
                description="Options are shared across the whole store catalog; variations are generated from the selected choices."
                actions={readOnlyNote}
              />

              {product.options.length === 0 ? (
                <p className="text-small text-subtle">No options on this product.</p>
              ) : (
                <>
                  <ul className="mb-4 space-y-1 text-sm text-text">
                    {product.options.map((o) => (
                      <li key={o.id}>
                        <span className="font-semibold">{o.name}:</span>{" "}
                        {o.choices.map((c) => c.value).join(", ")}
                      </li>
                    ))}
                  </ul>

                  {product.variations.length > 0 && (
                    <div className="overflow-x-auto rounded-lg border border-border">
                      <table className="min-w-full divide-y divide-border text-sm">
                        <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
                          <tr>
                            <th className="px-3 py-2 font-semibold">#</th>
                            {product.options.map((o) => (
                              <th key={o.id} className="px-3 py-2 font-semibold">
                                {o.name}
                              </th>
                            ))}
                            <th className="px-3 py-2 font-semibold">SKU</th>
                            <th className="px-3 py-2 font-semibold">Price Δ</th>
                            <th className="px-3 py-2 font-semibold">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {product.variations.map((v, idx) => (
                            <tr key={v.id}>
                              <td className="px-3 py-2 font-medium text-subtle">{idx + 1}</td>
                              {product.options.map((o) => {
                                const vo = v.options.find((x) => x.option_id === o.id);
                                return (
                                  <td key={o.id} className="px-3 py-2 font-medium text-text">
                                    {vo?.choice_value ?? "—"}
                                  </td>
                                );
                              })}
                              <td className="px-3 py-2 font-medium text-muted">{v.sku || "—"}</td>
                              <td className="px-3 py-2 font-medium text-muted">
                                {v.price_difference}
                              </td>
                              <td className="px-3 py-2">
                                <StatusBadge status={v.status} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </Card>

            {/* Hub content — source of truth is the Supabase DB. */}
            <div className="flex items-center gap-2 pt-2">
              <h2 className="text-lg font-semibold text-text">Hub Content</h2>
              <Badge tone="neutral">Stored outside Duda</Badge>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <LogoActivationPanel
                id="section-logos"
                kind="SA_LOGO"
                title="SA Logos"
                entries={context.logoCatalog.SA_LOGO}
                activeIds={draft.logos.SA_LOGO}
                onToggle={(logoId) => toggleLogo("SA_LOGO", logoId)}
                dirty={dirty.logos}
              />
              <LogoActivationPanel
                id="section-logos-cert"
                kind="CERT_LOGO"
                title="Cert Logos"
                entries={context.logoCatalog.CERT_LOGO}
                activeIds={draft.logos.CERT_LOGO}
                onToggle={(logoId) => toggleLogo("CERT_LOGO", logoId)}
                dirty={dirty.logos}
              />
            </div>

            <SpecTableEditor
              rows={draft.specs}
              onChange={(rows) => setSection("specs", rows)}
              dirty={dirty.specs}
              error={saveErrors.specs ?? validationErrors.specs}
            />

            <TextItemListEditor
              id="section-benefits"
              title="Key Benefits"
              description="Rendered as a checklist on the product page. Drag to reorder."
              items={draft.benefits}
              onChange={(items) => setSection("benefits", items)}
              dirty={dirty.benefits}
              error={saveErrors.benefits ?? validationErrors.benefits}
              placeholder="e.g. ATEX certified for Zones 1 & 2"
            />

            <TextItemListEditor
              id="section-applications"
              title="Applications"
              description="Industries or use cases this product suits."
              items={draft.applications}
              onChange={(items) => setSection("applications", items)}
              dirty={dirty.applications}
              error={saveErrors.applications ?? validationErrors.applications}
              placeholder="e.g. Refineries"
            />

            <DangerZoneSection
              productId={product.id}
              productName={product.name}
              onBeforeNavigate={disarmGuard}
            />

            <ProductSaveBar
              dirtyLabels={dirtyLabels}
              isValid={isValid}
              saving={saving}
              savingLabel={savingLabel}
              saveErrors={saveErrors}
              validationErrors={validationErrors}
              onSave={() => void save()}
              onReset={reset}
            />
          </div>
        )}
      </div>
    </>
  );
}
