import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  Checkbox,
  Loader,
  StatusBadge,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Toggle,
} from "../components/ui";
import { LogoActivationPanel } from "../components/LogoActivationPanel";
import { SpecTableEditor } from "../components/SpecTableEditor";
import { TextItemListEditor } from "../components/TextItemListEditor";
import { UnsavedChangesModal } from "../components/UnsavedChangesModal";
import { TranslationProgressModal } from "../components/TranslationProgressModal";
import { CategoriesSection } from "../components/product/CategoriesSection";
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
import { ProductSaveBar } from "../components/product/ProductSaveBar";
import { useProductEditor } from "../components/product/useProductEditor";
import { useEditorTab } from "../components/product/useEditorTab";
import { EDITOR_TABS, editorTabState, tabCounts, tabForKey, type EditorTab } from "../components/product/editorTabs";
import type { SectionKey } from "../components/product/productEditorTypes";
import { useHideCommerceFields } from "../hooks/useUserPreference";
import { useUnsavedChangesWarning } from "../hooks/useUnsavedChangesWarning";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { usePageCrumb } from "../components/TopBar";
import { productPageUrl } from "../lib/site";
import { cn } from "../lib/cn";

/** From here the side panel (Visibility, Categories) sits beside the tabs. */
const XL = "(min-width: 1280px)";

/**
 * The product editor (02a "Batch 8"): a header card, the sections in six
 * tabs, and a side panel with Visibility and Categories. One draft and one
 * save bar for all of it — the tabs only decide what is on screen.
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
  const wide = useMediaQuery(XL);
  // Selected categories Duda no longer has, from the Categories section.
  const [staleCategories, setStaleCategories] = useState(0);

  const product = context?.product;
  // The top bar reads "Catalogue / Products / <name>" — the SAVED name, like the header.
  usePageCrumb(product?.name);

  // ProductSaveBar is position:fixed, so it no longer reserves its own space.
  // Reserve it here — but only while the bar is actually on screen (same
  // condition the bar itself renders on), so a clean page has no dead gap.
  const saveBarVisible = isDirty || Object.keys(saveErrors).length > 0;

  // Below 1280 the side panel is part of Overview, so its edits count there.
  const tabState =
    draft && baseline
      ? editorTabState({ draft, baseline, dirty, saveErrors, validationErrors, panelInOverview: !wide })
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
   * A save-bar pill: open the section's tab, then scroll to and focus the
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

      <div className={saveBarVisible ? "pb-28" : "pb-4"}>
        {loading && <Loader label="Loading product…" />}
        {loadError && <Alert tone="danger">{loadError}</Alert>}

        {!loading && !loadError && product && draft && context && tabState && (
          <div className="space-y-5">
            {/* Header — the SAVED product, not the draft. No back link: the top
                bar's breadcrumb covers it (02a "After stage 5"). */}
            <ProductHeader
              name={product.name}
              sku={product.sku}
              status={product.status}
              stockStatus={hideCommerce ? null : product.stock_status}
              type={hideCommerce ? null : product.type}
              liveUrl={productPageUrl({ slug: product.seo?.product_url ?? null, status: product.status })}
              staleCategories={staleCategories}
              loadedAt={loadedAt}
              refreshDisabled={isDirty || saving}
              onRefresh={() => void reload()}
            />

            {/*
              Tabs on the left; the side panel beside them from 1280. Below
              that the panel, and Delete product after it, stack under the tabs
              and show with Overview only — rendered once either way, so the
              Categories section stays mounted.
            */}
            {/* Rows auto then 1fr: the side panel spans both and is often the
                taller, and the extra height must go below Delete product, not
                between the tabs and it. */}
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_18rem] xl:grid-rows-[auto_1fr] xl:items-start">
              <div className="min-w-0 xl:col-start-1 xl:row-start-1">
                <Tabs value={tab} onValueChange={(v) => setTab(v as EditorTab)}>
                  <TabList aria-label="Product sections" className="mb-5">
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

                  <TabPanel value="overview" className="space-y-5">
                    {detailsAlert("overview")}
                    <EditorSection
                      title="Details"
                      description="Native Duda fields. These sync straight to the store."
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
                    <AccessorySection
                      checked={draft.isAccessory}
                      onChange={(next) => setSection("isAccessory", next)}
                      error={saveErrors.accessory ?? validationErrors.accessory}
                    />
                  </TabPanel>

                  <TabPanel value="content" className="space-y-5">
                    {detailsAlert("content")}
                    <EditorSection title="Description" description="Shown in the Overview tab of the product page.">
                      <DescriptionSection
                        value={draft.details.description}
                        onChange={(html) => setSection("details", { ...draft.details, description: html })}
                        dirty={dirty.details}
                      />
                    </EditorSection>
                    <EditorSection
                      title="Technical specs"
                      description="Shown as a table in the Technical Specs tab of the product page."
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
                </Tabs>
              </div>

              {/* The side panel: Visibility and Categories. */}
              <aside
                aria-label="Visibility and categories"
                className={cn(
                  "min-w-0 space-y-5 xl:col-start-2 xl:row-span-2 xl:row-start-1",
                  tab !== "overview" && "hidden xl:block",
                )}
              >
                <EditorSection title="Visibility">
                  {/* The Status field (ACTIVE / HIDDEN) as a toggle: same field,
                      same save key (02a Q28). */}
                  <Toggle
                    id="p-live"
                    checked={draft.details.status === "ACTIVE"}
                    onChange={(on) => setSection("details", (d) => ({ ...d, status: on ? "ACTIVE" : "HIDDEN" }))}
                    label="Live on the website"
                  />
                  <p className="t-help mt-2">Hidden products aren't shown in the store.</p>
                </EditorSection>
                <CategoriesSection
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

            <ProductSaveBar
              dirtyLabels={dirtyLabels}
              isValid={isValid}
              saving={saving}
              savingLabel={savingLabel}
              saveErrors={saveErrors}
              validationErrors={validationErrors}
              onSave={() => void save()}
              onReset={reset}
              onOpenSection={openSection}
            />
          </div>
        )}
      </div>
    </>
  );
}

/**
 * The element a save-bar pill scrolls to. Most keys have a `section-<key>`
 * anchor; `details` has one per tab (its fields are on three), and logos is
 * the first of its two panels.
 */
function sectionAnchor(key: SectionKey, tab: EditorTab): string {
  if (key === "details") return tab === "content" ? "section-description" : tab === "seo" ? "section-seo" : "section-details";
  return `section-${key}`;
}

/**
 * The editor's header card (02a "Batch 8"): the saved name, SKU, the Live /
 * Hidden chip (with stock and type when commerce fields are shown), the "No
 * longer in Duda" fault chip, when the product was loaded with Refresh, and
 * View on website. No Save here: the save bar is the one Save (02a Q28).
 */
function ProductHeader({
  name,
  sku,
  status,
  stockStatus,
  type,
  liveUrl,
  staleCategories,
  loadedAt,
  refreshDisabled,
  onRefresh,
}: {
  name: string;
  sku: string | null;
  status: string;
  stockStatus: string | null;
  type: string | null;
  liveUrl: string | null;
  staleCategories: number;
  loadedAt: Date | null;
  refreshDisabled: boolean;
  onRefresh: () => void;
}) {
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="t-editor-title text-text [overflow-wrap:anywhere]">{name}</h1>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-help text-muted">
              SKU <span className="t-code text-text">{sku || "—"}</span>
            </span>
            <StatusBadge status={status} />
            {stockStatus && <StatusBadge status={stockStatus} />}
            {type && <Badge tone="neutral">{type}</Badge>}
            {staleCategories > 0 && (
              <Badge tone="danger">
                {staleCategories} {staleCategories === 1 ? "category" : "categories"} no longer in Duda
              </Badge>
            )}
          </div>
          {loadedAt && (
            <p className="t-help mt-2">
              <span title="Edits made in Duda after this time won't show until you refresh.">
                Loaded {loadedAt.toLocaleTimeString()}
              </span>
              {" · "}
              <button
                type="button"
                onClick={onRefresh}
                disabled={refreshDisabled}
                title={refreshDisabled ? "Save or reset your changes before refreshing" : "Re-read this product from Duda"}
                className="text-text underline underline-offset-2 disabled:cursor-not-allowed disabled:text-muted disabled:no-underline"
              >
                Refresh
              </button>
            </p>
          )}
        </div>
        {liveUrl ? (
          <ButtonLink href={liveUrl} target="_blank" rel="noopener noreferrer" size="sm">
            <ExternalLink size={16} aria-hidden="true" />
            View on website
            <span className="sr-only">(opens in a new tab)</span>
          </ButtonLink>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            disabled
            title={status === "ACTIVE" ? "This product has no page address yet" : "Hidden products are not on the website"}
          >
            <ExternalLink size={16} aria-hidden="true" />
            View on website
          </Button>
        )}
      </div>
    </Card>
  );
}
