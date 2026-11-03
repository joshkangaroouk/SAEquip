import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Checkbox,
  Loader,
  StatusBadge,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  SegmentedControl,
} from "../components/ui";
import { LogoActivationPanel } from "../components/LogoActivationPanel";
import { SpecTableEditor } from "../components/SpecTableEditor";
import { TextItemListEditor } from "../components/TextItemListEditor";
import { UnsavedChangesModal } from "../components/UnsavedChangesModal";
import { TranslationProgressModal } from "../components/TranslationProgressModal";
import { CategoriesSection, useCategoryList, type CategoryNode } from "../components/product/CategoriesSection";
import { AccessorySection } from "../components/product/AccessorySection";
import { CompatibleProductsSection } from "../components/product/CompatibleProductsSection";
import { DangerZoneSection } from "../components/product/DangerZoneSection";
import { DescriptionSection } from "../components/product/DescriptionSection";
import { EditorSection } from "../components/product/EditorSection";
import { ImagesSection } from "../components/product/ImagesSection";
import { Model3DSection } from "../components/product/Model3DSection";
import { DownloadsSection } from "../components/product/DownloadsSection";
import { OptionsSection } from "../components/product/OptionsSection";
import { VariationsSection } from "../components/product/VariationsSection";
import { ProductDetailsSection } from "../components/product/ProductDetailsSection";
import { SeoSection } from "../components/product/SeoSection";
import { ProductSaveArea } from "../components/product/ProductSaveArea";
import { ProductBand } from "../components/product/ProductBand";
import { useProductEditor } from "../components/product/useProductEditor";
import { useEditorTab } from "../components/product/useEditorTab";
import { EDITOR_TABS, editorTabState, tabCounts, tabForKey, type EditorTab } from "../components/product/editorTabs";
import type { SectionKey, SpecRowDraft } from "../components/product/productEditorTypes";
import { groupSpecRows } from "../components/product/normalize";
import type { ProductLogoEntry } from "../lib/types";
import { useHideCommerceFields } from "../hooks/useUserPreference";
import { useUnsavedChangesWarning } from "../hooks/useUnsavedChangesWarning";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { usePageCrumb } from "../components/TopBar";
import { productPageUrl } from "../lib/site";
import { cn } from "../lib/cn";

/** From here the side panel (Visibility, Categories) sits beside the tabs. */
const XL = "(min-width: 1280px)";

/**
 * The product editor (02a "Batch 8", 10 §2): a header band with the tabs on
 * its bottom edge and the one Save in it, the sections below, and a side
 * panel with Visibility and Categories. One draft and one Save for all of it
 * — the tabs only decide what is on screen.
 */
export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  // Saved against the account (Supabase user_metadata), so it follows the user
  // across sessions and machines rather than living in this browser.
  const { value: hideCommerce, setValue: setHideCommerce } = useHideCommerceFields();
  const editor = useProductEditor(id, { hideCommerce });
  const {
    context,
    draft,
    baseline,
    loading,
    loadError,
    loadedAt,
    saving,
    savingLabel,
    saveErrors,
    translation,
    skipTranslation,
    downloadLanguage,
    validationErrors,
    detailsInvalidField,
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
  // mid-save or during a deliberate exit. It compares pathnames, so switching
  // tabs (?tab=) never trips it.
  const blocker = useUnsavedChangesWarning({ when: isDirty && !guardSuppressed(), suppress: guardSuppressed });

  const [tab, setTab] = useEditorTab();
  // Loaded once: the side panel lists it, and the band's overline names the product type.
  const { cats, loadError: catsError } = useCategoryList();
  const wide = useMediaQuery(XL);
  // Selected categories Duda no longer has, from the Categories section.
  const [staleCategories, setStaleCategories] = useState(0);

  const product = context?.product;
  // The top bar reads "Catalogue / Products / <name>" — the SAVED name, like the header.
  usePageCrumb(product?.name);

  // Below 1280 the side panel is part of Overview, so its edits count there.
  const tabState =
    draft && baseline
      ? editorTabState({
          draft,
          baseline,
          dirty,
          saveErrors,
          validationErrors,
          detailsInvalidField,
          panelInOverview: !wide,
        })
      : null;
  const counts = draft ? tabCounts(draft) : {};

  const detailsError = saveErrors.details ?? validationErrors.details;
  /** The `details` error, at the top of each tab it belongs to (02a "Batch 8"). */
  const detailsAlert = (t: EditorTab) =>
    detailsError && tabState?.detailsErrorTabs.includes(t) ? (
      <Alert tone="danger" title={saveErrors.details ? "The details weren't saved" : undefined}>
        {detailsError}
      </Alert>
    ) : null;
  const logosError = saveErrors.logos ?? validationErrors.logos;

  /*
   * A failed-section pill (the band's save area): open the section's tab, then scroll to and focus the
   * section. In two steps because the tab is a URL change (?tab=) and the
   * section is only on screen once it has rendered, so the scroll waits for
   * the tab to match.
   */
  const [opening, setOpening] = useState<{ key: SectionKey; tab: EditorTab } | null>(null);
  function openSection(key: SectionKey) {
    if (!tabState) return;
    const target = tabForKey(key, tabState, !wide) ?? tab;
    if (target !== tab) setTab(target);
    setOpening({ key, tab: target });
  }
  useEffect(() => {
    if (!opening || opening.tab !== tab) return;
    const el = document.getElementById(sectionAnchor(opening.key, opening.tab));
    // The EditorSection around it: focusable (tabIndex -1) and named by its heading.
    const section = (el?.closest("section") ?? el) as HTMLElement | null;
    if (section) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      section.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
      section.focus({ preventScroll: true });
    }
    setOpening(null);
  }, [opening, tab]);

  return (
    <>
      <UnsavedChangesModal blocker={blocker} onSave={save} dirtyLabels={dirtyLabels} />
      <TranslationProgressModal progress={translation} onSkip={skipTranslation} onDownload={downloadLanguage} />

      {loading && <Loader label="Loading product…" />}
      {loadError && <Alert tone="danger">{loadError}</Alert>}

      {!loading && !loadError && product && draft && baseline && context && tabState && (
        // One Tabs for the band's tab row and the panels below it (context
        // reaches through the band's portal).
        <Tabs value={tab} onValueChange={(v) => setTab(v as EditorTab)}>
          {/* The band shows the SAVED product, not the draft. No back link:
              the top bar's breadcrumb covers it (02a "After stage 5"). */}
          <ProductBand
            imageUrl={product.images?.[0]?.url ?? null}
            overline={bandOverline(baseline.logos.SA_LOGO, context.logoCatalog.SA_LOGO, baseline.categoryIds, cats)}
            title={product.name}
            meta={
              <>
                <span className="text-help text-muted">
                  SKU <span className="t-code text-text">{product.sku || "—"}</span>
                </span>
                <StatusBadge status={product.status} />
                {!hideCommerce && <StatusBadge status={product.stock_status} />}
                {!hideCommerce && <Badge tone="neutral">{product.type}</Badge>}
                {staleCategories > 0 && (
                  <Badge tone="danger">
                    {staleCategories} {staleCategories === 1 ? "category" : "categories"} no longer in Duda
                  </Badge>
                )}
                {loadedAt && (
                  <span className="t-help">
                    <span title="Edits made in Duda after this time won't show until you refresh.">
                      Loaded {loadedAt.toLocaleTimeString()}
                    </span>
                    {" · "}
                    <button
                      type="button"
                      onClick={() => void reload()}
                      disabled={isDirty || saving}
                      title={isDirty || saving ? "Save or discard your changes before refreshing" : "Re-read this product from Duda"}
                      className="text-text underline underline-offset-2 disabled:cursor-not-allowed disabled:text-muted disabled:no-underline"
                    >
                      Refresh
                    </button>
                  </span>
                )}
              </>
            }
            actions={
              <ProductSaveArea
                dirtyLabels={dirtyLabels}
                isValid={isValid}
                saving={saving}
                savingLabel={savingLabel}
                saveErrors={saveErrors}
                validationErrors={validationErrors}
                onSave={() => void save()}
                onReset={reset}
                onOpenSection={openSection}
                viewOnWebsite={
                  <ViewOnWebsite
                    url={productPageUrl({ slug: product.seo?.product_url ?? null, status: product.status })}
                    status={product.status}
                  />
                }
              />
            }
            tabs={
              // -ml-3: the first tab's label lines up with the name above it.
              // No rule of its own: the band's bottom rule is the tab row's.
              <TabList aria-label="Product sections" className="-ml-3 shadow-none">
                {EDITOR_TABS.map((t) => {
                  const st = tabState.tabs[t.value];
                  return (
                    <Tab
                      key={t.value}
                      value={t.value}
                      count={counts[t.value]}
                      indicator={st.error ? "error" : st.dirty ? "dirty" : null}
                    >
                      {t.label}
                    </Tab>
                  );
                })}
              </TabList>
            }
          />

          {/*
            Panels on the left; the side panel beside them from 1280. Below
            that the panel, and Delete product after it, stack under the tabs
            and show with Overview only — rendered once either way, so the
            Categories section stays mounted.
          */}
          {/* Rows auto then 1fr: the side panel spans both and is often the
              taller, and the extra height must go below Delete product, not
              between the tabs and it. The panel is clamp(18rem, 28%, 30rem)
              of the grid (11 §3): about 305px at 1440, never under 288 or
              over 480. */}
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_clamp(18rem,28%,30rem)] xl:grid-rows-[auto_1fr] xl:items-start">
            <div className="min-w-0 xl:col-start-1 xl:row-start-1">
              <TabPanel value="overview" className="space-y-5">
                {detailsAlert("overview")}
                <EditorSection
                  title="Details"
                  description="Native Duda fields. These sync straight to the store."
                  meta="Synced with Duda on save"
                  actions={
                    <Checkbox
                      className="text-muted"
                      label="Hide pricing & stock fields"
                      checked={hideCommerce}
                      onChange={(v) => void setHideCommerce(v)}
                    />
                  }
                >
                  <ProductDetailsSection
                    value={draft.details}
                    onChange={(next) => setSection("details", next)}
                    hideCommerce={hideCommerce}
                  />
                </EditorSection>
              </TabPanel>

              <TabPanel value="content" className="space-y-5">
                {detailsAlert("content")}
                <DescriptionSection
                  value={draft.details.description}
                  onChange={(html) => setSection("details", { ...draft.details, description: html })}
                  dirty={dirty.details}
                />
                <EditorSection
                  title="Technical specs"
                  description="Shown as a table in the Technical Specs tab of the product page."
                  meta={specsMeta(draft.specs)}
                  error={saveErrors.specs ?? validationErrors.specs}
                >
                  <SpecTableEditor
                    rows={draft.specs}
                    onChange={(rows) => setSection("specs", rows)}
                    error={saveErrors.specs ?? validationErrors.specs}
                  />
                </EditorSection>
                <EditorSection
                  title="Key benefits"
                  description="Checklist on the product page."
                  error={saveErrors.benefits ?? validationErrors.benefits}
                >
                  <TextItemListEditor
                    id="section-benefits"
                    title="Key Benefits"
                    description="Rendered as a checklist on the product page. Drag to reorder."
                    items={draft.benefits}
                    onChange={(items) => setSection("benefits", items)}
                    error={saveErrors.benefits ?? validationErrors.benefits}
                    placeholder="e.g. ATEX certified for Zones 1 & 2"
                  />
                </EditorSection>
                <EditorSection
                  title="Applications"
                  description="Industries or use cases this product suits."
                  error={saveErrors.applications ?? validationErrors.applications}
                >
                  <TextItemListEditor
                    id="section-applications"
                    title="Applications"
                    description="Industries or use cases this product suits."
                    items={draft.applications}
                    onChange={(items) => setSection("applications", items)}
                    error={saveErrors.applications ?? validationErrors.applications}
                    placeholder="e.g. Refineries"
                  />
                </EditorSection>
                <EditorSection
                  title="Compatible products"
                  description="Shown as a carousel on the product page."
                  error={saveErrors.compatible ?? validationErrors.compatible}
                >
                  <CompatibleProductsSection
                    productId={product.id}
                    items={draft.compatible}
                    onChange={(next) => setSection("compatible", next)}
                    error={saveErrors.compatible ?? validationErrors.compatible}
                  />
                </EditorSection>
              </TabPanel>

              <TabPanel value="compliance" className="space-y-5">
                {/* Logos had no error home of their own (01 §5.1): here it is. */}
                {logosError && (
                  <Alert tone="danger" title={saveErrors.logos ? "The logos weren't saved" : undefined}>
                    {logosError}
                  </Alert>
                )}
                <EditorSection
                  title="SA logos"
                  description={
                    <>
                      SA range logos shown on this product. Manage the catalogue on the{" "}
                      <Link to="/logos" className="text-text underline underline-offset-2">
                        Logos
                      </Link>{" "}
                      page.
                    </>
                  }
                >
                  <LogoActivationPanel
                    id="section-logos"
                    kind="SA_LOGO"
                    title="SA Logos"
                    entries={context.logoCatalog.SA_LOGO}
                    activeIds={draft.logos.SA_LOGO}
                    onToggle={(logoId) => toggleLogo("SA_LOGO", logoId)}
                  />
                </EditorSection>
                <EditorSection title="Certification logos" description="Certification marks shown on this product.">
                  <LogoActivationPanel
                    id="section-logos-cert"
                    kind="CERT_LOGO"
                    title="Cert Logos"
                    entries={context.logoCatalog.CERT_LOGO}
                    activeIds={draft.logos.CERT_LOGO}
                    onToggle={(logoId) => toggleLogo("CERT_LOGO", logoId)}
                  />
                </EditorSection>
              </TabPanel>

              <TabPanel value="options" className="space-y-5">
                <EditorSection
                  title="Options"
                  description={
                    <>
                      Shared option catalogue, attached per product. Rename options or delete values on the{" "}
                      <Link to="/options" className="text-text underline underline-offset-2">
                        Product options
                      </Link>{" "}
                      page.
                    </>
                  }
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
                </EditorSection>
                <EditorSection
                  title="Variations"
                  description="Generated from the attached option choices."
                  error={saveErrors.variations ?? validationErrors.variations}
                >
                  <VariationsSection
                    variations={draft.variations}
                    options={draft.options}
                    lockedByOptions={dirty.options}
                    error={saveErrors.variations ?? validationErrors.variations}
                    onChange={setVariation}
                    onChangeAll={setAllVariations}
                    hideCommerce={hideCommerce}
                  />
                </EditorSection>
              </TabPanel>

              <TabPanel value="files" className="space-y-5">
                <EditorSection
                  title="Images"
                  description="Gallery for the product page; the first image is the thumbnail. Duda re-hosts each image on save."
                  error={saveErrors.images ?? validationErrors.images}
                >
                  <ImagesSection
                    images={draft.images}
                    onChange={(next) => setSection("images", next)}
                    error={saveErrors.images ?? validationErrors.images}
                  />
                </EditorSection>
                <EditorSection
                  title="3D model"
                  description="One .glb file, shown by the 3D viewer widget."
                  error={saveErrors.model3d}
                >
                  <Model3DSection
                    value={draft.model3d}
                    onChange={(next) => setSection("model3d", next)}
                    error={saveErrors.model3d}
                  />
                </EditorSection>
                <EditorSection
                  title="Downloads"
                  description="Datasheets, manuals and certificates. The type decides which resources page lists each file."
                  error={saveErrors.downloads ?? validationErrors.downloads}
                >
                  <DownloadsSection
                    value={draft.downloads}
                    onChange={(next) => setSection("downloads", next)}
                    error={saveErrors.downloads ?? validationErrors.downloads}
                  />
                </EditorSection>
              </TabPanel>

              <TabPanel value="seo" className="space-y-5">
                {detailsAlert("seo")}
                <EditorSection title="SEO" description="How the product page appears in search results.">
                  <SeoSection
                    value={draft.details}
                    onChange={(next) => setSection("details", next)}
                    productName={draft.details.name}
                  />
                </EditorSection>
              </TabPanel>
            </div>

            {/* The side panel: Visibility and Categories. */}
            <aside
              aria-label="Visibility and categories"
              className={cn(
                "min-w-0 space-y-5 xl:col-start-2 xl:row-span-2 xl:row-start-1",
                tab !== "overview" && "hidden xl:block",
              )}
            >
              <EditorSection title="Visibility" error={saveErrors.accessory ?? validationErrors.accessory}>
                <div className="space-y-5">
                  <div>
                    {/* The Status field (ACTIVE / HIDDEN), as Active / Hidden
                        (10 §3): the same field and save key as before. */}
                    <SegmentedControl
                      ariaLabel="Visibility"
                      value={draft.details.status === "ACTIVE" ? "ACTIVE" : "HIDDEN"}
                      onChange={(v) => setSection("details", (d) => ({ ...d, status: v }))}
                      options={[
                        { value: "ACTIVE", label: "Active" },
                        { value: "HIDDEN", label: "Hidden" },
                      ]}
                    />
                    <p className="t-help mt-2">Hidden products aren't shown in the store.</p>
                  </div>
                  {/* Moved here from Overview (10 §3); the same `accessory` key. */}
                  <AccessorySection checked={draft.isAccessory} onChange={(next) => setSection("isAccessory", next)} />
                </div>
              </EditorSection>
              <CategoriesSection
                cats={cats}
                loadError={catsError}
                selected={draft.categoryIds}
                onChange={(next) => setSection("categoryIds", next)}
                error={saveErrors.categories ?? validationErrors.categories}
                onStaleCount={setStaleCategories}
              />
            </aside>

            {/* Delete product: the foot of Overview, outside the save flow. */}
            <div className={cn("min-w-0 xl:col-start-1 xl:row-start-2", tab !== "overview" && "hidden")}>
              <DangerZoneSection productId={product.id} productName={product.name} onBeforeNavigate={disarmGuard} />
            </div>
          </div>
        </Tabs>
      )}
    </>
  );
}

/**
 * The element a failed-section pill scrolls to. Most keys have a `section-<key>`
 * anchor; `details` has one per tab (its fields are on three), and logos is
 * the first of its two panels.
 */
function sectionAnchor(key: SectionKey, tab: EditorTab): string {
  if (key === "details") return tab === "content" ? "section-description" : tab === "seo" ? "section-seo" : "section-details";
  return `section-${key}`;
}

/**
 * "View on website" in the band's actions: the product's live page in a new
 * tab, or disabled with the reason while there isn't one. Below 640 it is an
 * icon button, still named "View on website" (10 §2). `secondary` is the
 * design's "ghost": transparent, bordered.
 */
function ViewOnWebsite({ url, status }: { url: string | null; status: string }) {
  const icon = "max-sm:w-10 max-sm:px-0";
  return url ? (
    <ButtonLink variant="secondary" href={url} target="_blank" rel="noopener noreferrer" className={icon}>
      <ExternalLink size={16} aria-hidden="true" />
      <span className="max-sm:sr-only">View on website</span>
      <span className="sr-only">(opens in a new tab)</span>
    </ButtonLink>
  ) : (
    <Button
      variant="secondary"
      disabled
      title={status === "ACTIVE" ? "This product has no page address yet" : "Hidden products are not on the website"}
      className={icon}
    >
      <ExternalLink size={16} aria-hidden="true" />
      <span className="max-sm:sr-only">View on website</span>
    </Button>
  );
}

/** The Technical specs header's meta (10 §4): specs (label groups) and rows. */
function specsMeta(rows: SpecRowDraft[]): string {
  const specs = groupSpecRows(rows).length;
  return `${specs} ${specs === 1 ? "spec" : "specs"} · ${rows.length} ${rows.length === 1 ? "row" : "rows"}`;
}

/**
 * The band's overline (10 §2): the SA range(s) from the saved SA logos, then
 * " · ", then the product type, from data the editor has already loaded. A
 * part that is missing is left out, and with neither there is no overline.
 *
 * Rental is not a range: it sits beside one (CLAUDE.md, the resources
 * widget), so it is not named here.
 */
function bandOverline(
  saLogoIds: string[],
  saCatalog: ProductLogoEntry[],
  categoryIds: string[],
  cats: CategoryNode[] | null,
): string | null {
  const ranges = saCatalog
    .filter((l) => saLogoIds.includes(l.id) && !/rental/i.test(`${l.label ?? ""} ${l.alt ?? ""}`))
    // The alt text first, as the website's own cards read it: the label
    // carries a "Logo" suffix ("SA Flexiheat Logo"), the alt is the name.
    .map((l) => l.alt || l.label)
    .filter((x): x is string => !!x);
  const products = cats?.find((c) => c.parent_id === "ROOT" && c.title === "Products");
  const types = products
    ? (cats ?? []).filter((c) => c.parent_id === products.id && categoryIds.includes(c.id)).map((c) => c.title)
    : [];
  const parts = [ranges.join(", "), types.join(", ")].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}
