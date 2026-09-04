import { Link, useParams } from "react-router-dom";
import { Badge, Card, Checkbox, Loader, StatusBadge } from "../components/ui";
import { LogoActivationPanel } from "../components/LogoActivationPanel";
import { SpecTableEditor } from "../components/SpecTableEditor";
import { TextItemListEditor } from "../components/TextItemListEditor";
import { UnsavedChangesModal } from "../components/UnsavedChangesModal";
import { DangerZoneSection } from "../components/product/DangerZoneSection";
import { DescriptionSection } from "../components/product/DescriptionSection";
import { ImagesSection } from "../components/product/ImagesSection";
import { Model3DSection } from "../components/product/Model3DSection";
import { OptionsSection } from "../components/product/OptionsSection";
import { VariationsSection } from "../components/product/VariationsSection";
import { ProductDetailsSection } from "../components/product/ProductDetailsSection";
import { ProductSaveBar } from "../components/product/ProductSaveBar";
import { useProductEditor } from "../components/product/useProductEditor";
import { useHideCommerceFields } from "../hooks/useUserPreference";
import { useUnsavedChangesWarning } from "../hooks/useUnsavedChangesWarning";

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  // Saved against the account (Supabase user_metadata), so it follows the user
  // across sessions and machines rather than living in this browser.
  const { value: hideCommerce, setValue: setHideCommerce } = useHideCommerceFields();
  const editor = useProductEditor(id, { hideCommerce });
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
    attachOption,
    detachOption,
    toggleOptionChoice,
    setVariation,
    setAllVariations,
    reloadOptionCatalog,
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

  // ProductSaveBar is position:fixed, so it no longer reserves its own space.
  // Reserve it here — but only while the bar is actually on screen (same
  // condition the bar itself renders on), so a clean page has no dead gap.
  const saveBarVisible = isDirty || Object.keys(saveErrors).length > 0;

  return (
    <>
      <UnsavedChangesModal blocker={blocker} onSave={save} dirtyLabels={dirtyLabels} />

      <div className={saveBarVisible ? "pb-28" : "pb-4"}>
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
          <div className="mt-4 space-y-4">
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
                <div className="flex flex-col items-end gap-2">
                  <div className="flex flex-wrap justify-end gap-2">
                    <StatusBadge status={product.status} />
                    {!hideCommerce && <StatusBadge status={product.stock_status} />}
                    {!hideCommerce && <Badge tone="neutral">{product.type}</Badge>}
                  </div>
                  <Checkbox
                    className="text-muted"
                    label="Hide pricing & stock fields"
                    checked={hideCommerce}
                    onChange={(v) => void setHideCommerce(v)}
                  />
                </div>
              </div>
            </Card>

            <ProductDetailsSection
              value={draft.details}
              onChange={(next) => setSection("details", next)}
              dirty={dirty.details}
              error={saveErrors.details ?? validationErrors.details}
              hideCommerce={hideCommerce}
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

            <OptionsSection
              options={draft.options}
              catalog={context.optionCatalog}
              currentVariationCount={context.product.variations.length}
              maxVariations={context.maxVariations}
              dirty={dirty.options}
              error={saveErrors.options ?? validationErrors.options}
              onAttach={attachOption}
              onDetach={detachOption}
              onToggleChoice={toggleOptionChoice}
              onCatalogChanged={reloadOptionCatalog}
            />

            <VariationsSection
              variations={draft.variations}
              options={draft.options}
              lockedByOptions={dirty.options}
              dirty={dirty.variations}
              error={saveErrors.variations ?? validationErrors.variations}
              onChange={setVariation}
              onChangeAll={setAllVariations}
              hideCommerce={hideCommerce}
            />

            {/* Hub content — source of truth is the Supabase DB. */}
            <div className="flex items-center gap-2 pt-2">
              <h2 className="text-lg font-semibold text-text">Hub Content</h2>
              <Badge tone="neutral">Stored outside Duda</Badge>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

            <Model3DSection
              value={draft.model3d}
              onChange={(next) => setSection("model3d", next)}
              dirty={dirty.model3d}
              error={saveErrors.model3d}
            />

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
