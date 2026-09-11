import { Link, useParams } from "react-router-dom";
import { AccordionCard, Badge, Card, Checkbox, Loader, StatusBadge } from "../components/ui";
import { LogoActivationPanel } from "../components/LogoActivationPanel";
import { SpecTableEditor } from "../components/SpecTableEditor";
import { TextItemListEditor } from "../components/TextItemListEditor";
import { UnsavedChangesModal } from "../components/UnsavedChangesModal";
import { CategoriesSection } from "../components/product/CategoriesSection";
import { CompatibleProductsSection } from "../components/product/CompatibleProductsSection";
import { DangerZoneSection } from "../components/product/DangerZoneSection";
import { DescriptionSection } from "../components/product/DescriptionSection";
import { ImagesSection } from "../components/product/ImagesSection";
import { Model3DSection } from "../components/product/Model3DSection";
import { OptionsSection } from "../components/product/OptionsSection";
import { VariationsSection } from "../components/product/VariationsSection";
import { ProductDetailsSection } from "../components/product/ProductDetailsSection";
import { ProductSaveBar } from "../components/product/ProductSaveBar";
import { TagsSection } from "../components/product/TagsSection";
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

            {/*
              70/30. The left column is the product itself; the right is
              classification, which you glance at and tick rather than fill in.
              Grid rather than flex so the two columns are independent — a long
              accordion opening on the left must not drag the right column's
              panels down with it.
            */}
            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-10">
              <div className="space-y-4 lg:col-span-7">
                {/*
                  Details and Description are NOT collapsible. They are what you
                  came to edit; hiding them behind a click would put a barrier in
                  front of the most common task to save space on the least
                  valuable scroll.
                */}
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

                <AccordionCard
                  title="Images"
                  description="Gallery for the product page. Duda re-hosts each image on save."
                  summary={draft.images.length || undefined}
                  dirty={dirty.images}
                  error={saveErrors.images ?? validationErrors.images}
                >
                  <ImagesSection
                    images={draft.images}
                    onChange={(next) => setSection("images", next)}
                    dirty={dirty.images}
                    error={saveErrors.images ?? validationErrors.images}
                  />
                </AccordionCard>

                <AccordionCard
                  title="Options"
                  description="Shared option catalogue, attached per product."
                  summary={draft.options.length || undefined}
                  dirty={dirty.options}
                  error={saveErrors.options ?? validationErrors.options}
                >
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
                </AccordionCard>

                <AccordionCard
                  title="Variations"
                  description="Generated from the attached option choices."
                  summary={draft.variations.length || undefined}
                  dirty={dirty.variations}
                  error={saveErrors.variations ?? validationErrors.variations}
                >
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
                </AccordionCard>

                <AccordionCard
                  title="SA Logos"
                  description="SA range logos active for this product."
                  summary={draft.logos.SA_LOGO.length || undefined}
                  dirty={dirty.logos}
                >
                  <LogoActivationPanel
                    id="section-logos"
                    kind="SA_LOGO"
                    title="SA Logos"
                    entries={context.logoCatalog.SA_LOGO}
                    activeIds={draft.logos.SA_LOGO}
                    onToggle={(logoId) => toggleLogo("SA_LOGO", logoId)}
                    dirty={dirty.logos}
                  />
                </AccordionCard>

                <AccordionCard
                  title="Cert Logos"
                  description="Certification marks active for this product."
                  summary={draft.logos.CERT_LOGO.length || undefined}
                  dirty={dirty.logos}
                >
                  <LogoActivationPanel
                    id="section-logos-cert"
                    kind="CERT_LOGO"
                    title="Cert Logos"
                    entries={context.logoCatalog.CERT_LOGO}
                    activeIds={draft.logos.CERT_LOGO}
                    onToggle={(logoId) => toggleLogo("CERT_LOGO", logoId)}
                    dirty={dirty.logos}
                  />
                </AccordionCard>

                <AccordionCard
                  title="3D Model"
                  description="One .glb, shown by the 3D viewer widget."
                  summary={draft.model3d.mediaAssetId ? "1" : undefined}
                  dirty={dirty.model3d}
                  error={saveErrors.model3d}
                >
                  <Model3DSection
                    value={draft.model3d}
                    onChange={(next) => setSection("model3d", next)}
                    dirty={dirty.model3d}
                    error={saveErrors.model3d}
                  />
                </AccordionCard>

                <AccordionCard
                  title="Compatible Products"
                  description="Shown as a carousel on the product page."
                  summary={draft.compatible.length || undefined}
                  dirty={dirty.compatible}
                  error={saveErrors.compatible ?? validationErrors.compatible}
                >
                  <CompatibleProductsSection
                    productId={product.id}
                    items={draft.compatible}
                    onChange={(next) => setSection("compatible", next)}
                    dirty={dirty.compatible}
                    error={saveErrors.compatible ?? validationErrors.compatible}
                  />
                </AccordionCard>

                <AccordionCard
                  title="Technical Specs"
                  description="Rendered as a table in the Overview accordion."
                  summary={draft.specs.length || undefined}
                  dirty={dirty.specs}
                  error={saveErrors.specs ?? validationErrors.specs}
                >
                  <SpecTableEditor
                    rows={draft.specs}
                    onChange={(rows) => setSection("specs", rows)}
                    dirty={dirty.specs}
                    error={saveErrors.specs ?? validationErrors.specs}
                  />
                </AccordionCard>

                <AccordionCard
                  title="Key Benefits"
                  description="Checklist on the product page."
                  summary={draft.benefits.length || undefined}
                  dirty={dirty.benefits}
                  error={saveErrors.benefits ?? validationErrors.benefits}
                >
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
                </AccordionCard>

                <AccordionCard
                  title="Applications"
                  description="Industries or use cases this product suits."
                  summary={draft.applications.length || undefined}
                  dirty={dirty.applications}
                  error={saveErrors.applications ?? validationErrors.applications}
                >
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
                </AccordionCard>

                <DangerZoneSection
                  productId={product.id}
                  productName={product.name}
                  onBeforeNavigate={disarmGuard}
                />
              </div>

              {/* Classification — stored in the Hub, not in Duda. */}
              <div className="space-y-4 lg:col-span-3">
                <CategoriesSection
                  selected={draft.categoryIds}
                  onChange={(next) => setSection("categoryIds", next)}
                  dirty={dirty.categories}
                  error={saveErrors.categories ?? validationErrors.categories}
                />

                <TagsSection
                  selected={draft.tagIds}
                  onChange={(next) => setSection("tagIds", next)}
                  dirty={dirty.tags}
                  error={saveErrors.tags ?? validationErrors.tags}
                />
              </div>
            </div>

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
