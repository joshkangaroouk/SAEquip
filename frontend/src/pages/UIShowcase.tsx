import { useEffect, useState } from "react";
import { ExternalLink, Image, Moon, Plus, Sun, Trash2 } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  Checkbox,
  DragHandle,
  DropdownMenu,
  EmptyState,
  Field,
  FileDropzone,
  FileInput,
  FilePreview,
  Highlight,
  ImageWell,
  Input,
  Loader,
  Modal,
  PageHeader,
  Pagination,
  RemoveButton,
  RichTextEditor,
  SegmentedControl,
  Select,
  SelectMenu,
  Skeleton,
  SkeletonField,
  SkeletonLine,
  SortableList,
  SplitDetailHeader,
  SplitListItem,
  SplitView,
  Spinner,
  StatusBadge,
  Tab,
  TabList,
  TabPanel,
  Table,
  Tabs,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Textarea,
  Thumb,
  Toggle,
  ToggleTrack,
  toast,
  useConfirm,
  usePagedList,
  useSelection,
} from "../components/ui";
import { EditorSection } from "../components/product/EditorSection";
import { ProductBand } from "../components/product/ProductBand";
import { ImagesSection } from "../components/product/ImagesSection";
import { VisibilitySection } from "../components/product/VisibilitySection";
import { DeleteProductLink } from "../components/product/DeleteProductButton";
import { ProductEditorSkeleton } from "../components/product/EditorSkeleton";
import type { ImageDraft } from "../components/product/productEditorTypes";
import type { EnquiryState } from "../lib/types";
import { ProductSaveArea } from "../components/product/ProductSaveArea";
import { CategoriesSection, type CategoryNode } from "../components/product/CategoriesSection";
import { EDITOR_TABS, type EditorTab } from "../components/product/editorTabs";
import logo from "../assets/saequip-logo-unframed.svg";
import {
  EnquiryActions,
  EnquiryNotes,
  EnquiryToolbar,
  ReadStatus,
  StarButton,
  filterEnquiries,
  isStarred,
  isUnread,
  type EnquiryFilter,
} from "../components/enquiries";

/**
 * The living UI kit — every ui/ primitive, every variant and state, plus the
 * shared pieces pages build from them (the editor's EditorSection and tabs,
 * the logo, the enquiry list), in the light and the dark theme side by side. Development only: routed at /ui
 * when `import.meta.env.DEV` (see App.tsx), never in a production build.
 *
 * The two panels each set their own `data-theme`, which the token blocks in
 * index.css support when nested. Dialogs, menus and toasts are portalled to
 * <body> and follow <html data-theme> instead — "Overlays in" switches that.
 *
 * ⚠️ Nothing here talks to the API: the FileDropzone is given a local
 * stand-in upload, so dropping a file here uploads nothing.
 *
 * `data-kit` attributes name each specimen for the contrast checks.
 */
export default function UIShowcase() {
  const [overlayTheme, setOverlayTheme] = useState<"light" | "dark">(() =>
    document.documentElement.dataset.theme === "dark" ? "dark" : "light",
  );
  const setOverlays = (t: "light" | "dark") => {
    // Attribute only — the stored preference is left alone.
    document.documentElement.dataset.theme = t;
    setOverlayTheme(t);
  };
  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-6 py-4">
        <div>
          <p className="t-overline">Development only</p>
          <h1 className="t-h1">UI kit</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="t-label">Overlays in</span>
          <Button size="sm" variant={overlayTheme === "light" ? "primary" : "secondary"} onClick={() => setOverlays("light")}>
            Light
          </Button>
          <Button size="sm" variant={overlayTheme === "dark" ? "primary" : "secondary"} onClick={() => setOverlays("dark")}>
            Dark
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2">
        <Panel theme="light" />
        <Panel theme="dark" />
      </div>
    </div>
  );
}

function Panel({ theme }: { theme: "light" | "dark" }) {
  return (
    <section data-theme={theme} data-kit-panel={theme} className="min-w-0 space-y-8 bg-bg p-6 text-text">
      <p className="t-overline">{theme} theme</p>
      <Typography />
      <Buttons />
      <Fields />
      <Choices />
      <Segments />
      <TabsDemo theme={theme} />
      <EditorDemo theme={theme} />
      <Chips />
      <Alerts />
      <Surfaces />
      <Brand />
      <Tables />
      <Overlays />
      <Pages />
      <Split theme={theme} />
      <Thumbs />
      <Files />
      <Editing />
    </section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="t-section border-b border-border pb-2">{title}</h2>
      {children}
    </div>
  );
}

function Row({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {label && <span className="t-label w-24 shrink-0">{label}</span>}
      {children}
    </div>
  );
}

function Typography() {
  return (
    <Section title="Type roles">
      {/* Casing (12.11). */}
      <p className="t-help" data-kit="type:casing">
        Page names in Title Case (the sidebar, the breadcrumb and each page's title: "Quote Requests", "Product
        Options"); product and category names as entered; everything else in sentence case (buttons, tabs, card
        headings, labels, help text, modal titles, empty states).
      </p>
      <p className="t-help" data-kit="type:fonts">
        Barlow for headings, Inter for everything else: codes, SKUs and slugs too, and counts with tabular figures
        so numbers line up (12.16). The system monospace is for the HTML code editors only.
      </p>
      <p className="t-h1" data-kit="type:h1">Page title 36</p>
      <p className="t-editor-title">Editor title 28</p>
      <p className="t-detail-title">Detail title 24</p>
      <p className="t-modal-title">Modal title 22</p>
      <p className="t-section">Section heading 14</p>
      <p className="t-overline">Overline 12</p>
      <p className="t-empty-title">Empty-state title 16</p>
      <p className="t-body" data-kit="type:body">Body 14 — the quick brown fox. <a href="#kit" className="underline underline-offset-2">Inline link</a>.</p>
      <p className="t-label" data-kit="type:label">Field label 12</p>
      <p className="t-help" data-kit="type:help">Help text 13, muted.</p>
      <p className="t-th">Table head 12</p>
      <p>
        <span className="t-code">SAPH18440</span> <span className="t-code-sm text-muted">ex-heater · 12</span>{" "}
        <span className="t-help">Code 13 / 12: Inter; numbers that line up add tabular figures</span>
      </p>
      <p className="font-mono text-help text-muted" data-kit="type:html-editor">
        {"<p>HTML code editors only: the system monospace.</p>"}
      </p>
      <p className="text-body">
        Search highlight: <Highlight text="EX Heater on a trolley" query="heater" />
      </p>
    </Section>
  );
}

function Buttons() {
  const variants = ["primary", "secondary", "ghost", "danger", "danger-solid"] as const;
  return (
    <Section title="Buttons">
      {variants.map((v) => (
        <Row key={v} label={v}>
          <Button variant={v} data-kit={`btn:${v}`}>
            {v === "danger-solid" ? "Delete permanently" : "Button"}
          </Button>
          <Button variant={v} size="sm" data-kit={`btn:${v}:sm`}>
            Small
          </Button>
          <Button variant={v} disabled data-kit={`btn:${v}:disabled`}>
            Disabled
          </Button>
          <Button variant={v} loading>
            Saving
          </Button>
        </Row>
      ))}
      <Row label="icon">
        <Button variant="secondary" icon aria-label="Add" data-kit="btn:icon">
          <Plus size={16} />
        </Button>
        <Button variant="ghost" icon aria-label="Delete" data-kit="btn:icon-ghost">
          <Trash2 size={16} />
        </Button>
        <Button variant="secondary" icon aria-label="Add (disabled)" disabled>
          <Plus size={16} />
        </Button>
      </Row>
      <Row label="link">
        {/* ButtonLink: a real <a> styled as a button, for mailto and external links. */}
        <ButtonLink href="#kit-link" data-kit="btnlink:secondary">
          Open in Duda
        </ButtonLink>
        <ButtonLink href="#kit-link" variant="primary" size="sm" data-kit="btnlink:primary">
          Reply by email
        </ButtonLink>
        <ButtonLink href="#kit-link" variant="ghost" size="sm" data-kit="btnlink:ghost">
          View on website <ExternalLink size={14} aria-hidden="true" />
        </ButtonLink>
      </Row>
      <Row label="remove">
        <RemoveButton onClick={() => {}} title="Remove row" />
        <RemoveButton onClick={() => {}} title="Remove (disabled)" disabled />
        <Badge>
          In a chip
          <RemoveButton size="sm" onClick={() => {}} title="Remove chip" />
        </Badge>
      </Row>
    </Section>
  );
}

function Fields() {
  const [text, setText] = useState("EX Heater");
  const [select, setSelect] = useState("ACTIVE");
  const [menu, setMenu] = useState("recent");
  return (
    <Section title="Fields">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" hint="Shown on the product page.">
          <Input value={text} onChange={(e) => setText(e.target.value)} data-kit="input" />
        </Field>
        <Field label="Placeholder">
          <Input placeholder="e.g. EX Heater" data-kit="input:placeholder" />
        </Field>
        <Field label="With an error" error="Enter a name.">
          <Input defaultValue="" data-kit="input:error" />
        </Field>
        <Field label="Disabled">
          <Input defaultValue="Locked" disabled data-kit="input:disabled" />
        </Field>
        <Field label="Dense (34px)">
          <Input size="sm" defaultValue="Toolbar field" />
        </Field>
        <Field label="Select">
          <Select value={select} onChange={(e) => setSelect(e.target.value)}>
            <option value="ACTIVE">Live</option>
            <option value="HIDDEN">Hidden</option>
          </Select>
        </Field>
        <Field label="Textarea" hint="Grows with its content.">
          <Textarea rows={3} defaultValue="Multi-line text." />
        </Field>
        <div className="space-y-1.5 sm:col-span-2">
          <span className="t-label block">Chip size (28px), in a row of 26px chips</span>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge>Hire</Badge>
            <Badge>Purchase</Badge>
            <Input size="chip" placeholder="New value…" aria-label="New value for Hire/Purchase" className="w-36" data-kit="input:chip" />
          </div>
        </div>
        <div className="space-y-1.5">
          <span className="t-label block">SelectMenu</span>
          <SelectMenu
            ariaLabel="Sort"
            value={menu}
            onChange={setMenu}
            options={[
              { value: "recent", label: "Recently added" },
              { value: "name", label: "Name A–Z" },
              { value: "sites", label: "Site Challenges", depth: 0 },
              { value: "hot", label: "Hot work", depth: 1 },
            ]}
          />
        </div>
      </div>
    </Section>
  );
}

function Choices() {
  const [a, setA] = useState(true);
  const [b, setB] = useState(false);
  const [t1, setT1] = useState(true);
  const [t2, setT2] = useState(false);
  return (
    <Section title="Checkbox and toggle">
      <Row label="checkbox">
        <Checkbox checked={a} onChange={setA} label="Checked" />
        <Checkbox checked={b} onChange={setB} label="Unchecked" />
        <Checkbox checked onChange={() => {}} disabled label="Disabled on" />
        <Checkbox checked={false} onChange={() => {}} disabled label="Disabled off" />
      </Row>
      <Row label="toggle">
        <Toggle checked={t1} onChange={setT1} label="On" />
        <Toggle checked={t2} onChange={setT2} label="Off" />
        <Toggle checked onChange={() => {}} disabled label="Disabled on" />
        <Toggle checked={false} onChange={() => {}} disabled label="Disabled off" />
      </Row>
      <Row label="track only">
        <span data-kit="toggle-track:off">
          <ToggleTrack checked={false} />
        </span>
        <span data-kit="toggle-track:on">
          <ToggleTrack checked />
        </span>
      </Row>
    </Section>
  );
}

function Segments() {
  const [status, setStatus] = useState<"all" | "live" | "hidden">("live");
  const [rows, setRows] = useState<"20" | "50" | "all">("20");
  const [mode, setMode] = useState<"rich" | "html">("rich");
  const [colour, setColour] = useState<"light" | "dark">("light");
  return (
    <Section title="Segmented control">
      <Row label="counts">
        <span data-kit="segments">
          <SegmentedControl
            ariaLabel="Status"
            value={status}
            onChange={setStatus}
            options={[
              { value: "all", label: "All", count: 91 },
              { value: "live", label: "Live", count: 88 },
              { value: "hidden", label: "Hidden", count: 3 },
            ]}
          />
        </span>
      </Row>
      <Row label="plain">
        <SegmentedControl
          ariaLabel="Rows per page"
          value={rows}
          onChange={setRows}
          options={[
            { value: "20", label: "20" },
            { value: "50", label: "50" },
            { value: "all", label: "All" },
          ]}
        />
      </Row>
      <Row label="icons (the top bar's theme switch)">
        {/* Kit only: this one changes nothing. The top bar's own switch sets the theme. */}
        <span data-kit="segments:icons">
          <SegmentedControl
            ariaLabel="Colour theme (kit)"
            value={colour}
            onChange={setColour}
            options={[
              { value: "light", label: "Light theme", icon: <Sun aria-hidden="true" /> },
              { value: "dark", label: "Dark theme", icon: <Moon aria-hidden="true" /> },
            ]}
          />
        </span>
        <span className="t-help">32×32 segments, a 16px icon; the name is the tooltip on hover and focus.</span>
      </Row>
      <Row label="disabled">
        <span data-kit="segments:disabled">
          <SegmentedControl
            ariaLabel="Editor mode"
            value={mode}
            onChange={setMode}
            options={[
              { value: "rich", label: "Rich text" },
              { value: "html", label: "HTML", disabled: true },
            ]}
          />
        </span>
      </Row>
    </Section>
  );
}

/** Counts how often a panel's content has mounted, to show what `keepMounted` does. */
const mounts: Record<string, number> = {};
function MountCount({ id }: { id: string }) {
  // StrictMode runs the initializer twice per mount in development, hence the halving.
  const [n] = useState(() => (mounts[id] = (mounts[id] ?? 0) + 1));
  return <span className="t-help ml-2">Mounted {Math.ceil(n / 2)}×</span>;
}

function TabsDemo({ theme }: { theme: string }) {
  const [tab, setTab] = useState("content");
  return (
    <Section title="Tabs">
      <div data-kit="tabs">
        <Tabs defaultValue="overview">
          <TabList aria-label="Product sections (kit)">
            <Tab value="overview">Overview</Tab>
            <Tab value="content" count={12} indicator="dirty">
              Content
            </Tab>
            <Tab value="compliance" indicator="error">
              Compliance
            </Tab>
            <Tab value="files" count={4}>
              Files & media
            </Tab>
          </TabList>
          <TabPanel value="overview" className="py-4 text-body">
            Overview panel. <MountCount id={`${theme}-ov`} />
          </TabPanel>
          <TabPanel value="content" className="py-4 text-body">
            Content panel (unsaved dot). <MountCount id={`${theme}-co`} />
          </TabPanel>
          <TabPanel value="compliance" className="py-4 text-body">
            Compliance panel (error dot). <MountCount id={`${theme}-cp`} />
          </TabPanel>
          <TabPanel value="files" className="py-4 text-body">
            Files panel. <MountCount id={`${theme}-fi`} />
          </TabPanel>
        </Tabs>
      </div>
      <p className="t-help">
        Controlled, unmounting hidden panels (<span className="t-code-sm">keepMounted=false</span>) — active: {tab}
      </p>
      <Tabs value={tab} onValueChange={setTab} keepMounted={false}>
        <TabList aria-label="Translations view (kit)">
          <Tab value="content">Product content</Tab>
          <Tab value="names">Names from Duda</Tab>
        </TabList>
        <TabPanel value="content" className="py-4 text-body">
          Product content. <MountCount id={`${theme}-c2`} />
        </TabPanel>
        <TabPanel value="names" className="py-4 text-body">
          Names from Duda. <MountCount id={`${theme}-n2`} />
        </TabPanel>
      </Tabs>
    </Section>
  );
}

/** The editor's six tabs, as the product editor shows them: counts, and a dot for unsaved or failed. */
const KIT_TAB_STATE: Partial<Record<EditorTab, { count?: number; indicator?: "dirty" | "error" }>> = {
  extra: { count: 23, indicator: "dirty" },
  compliance: { indicator: "error" },
  options: { count: 1 },
  files: { count: 12 },
  seo: { indicator: "dirty" },
};

function EditorDemo({ theme }: { theme: string }) {
  return (
    <Section title="Product editor: band, tabs and EditorSection">
      <p className="t-help">
        The band (10 §2): picture, overline, name and meta; the save area (unsaved count, failed pills, View on
        website, Discard, Save changes); the tabs on its bottom rule, with counts and dots. In the app it sits under the
        top bar and sticks from 1280 (11 §4), and shrinks as the page scrolls (12 §4); here it is in place, held in one
        state. Each tab's spoken name carries its count and state, e.g.
        "Extra details, 23, unsaved changes".
      </p>
      <div data-kit="editor-tabs" className="border border-border bg-bg">
        <Tabs defaultValue="compliance">
          <KitBand theme={theme} compact={false} />
          {EDITOR_TABS.map((t) => (
            <TabPanel key={t.value} value={t.value} className="space-y-5 p-5">
              {t.value === "compliance" ? (
                <>
                  <EditorSection
                    title="SA logos"
                    description="The SA range logos shown on this product."
                    error="Duda refused the save. Try again."
                  >
                    {/* A section's own Card, CardHeader and SectionError stay silent in here. */}
                    <Card>
                      <CardHeader title="Never shown" actions={<Button size="sm" variant="secondary">Header action</Button>} />
                      <p className="text-body">The section's body. Its error prints once, above.</p>
                    </Card>
                  </EditorSection>
                  <EditorSection title="Certification logos" description="Certification marks shown on this product.">
                    <p className="text-body">A clean section: heading, description, body.</p>
                  </EditorSection>
                </>
              ) : (
                <EditorSection
                  title={`${t.label} section`}
                  description="A short description under the card heading."
                  meta="14 specs · 14 rows"
                  actions={<Button size="sm" variant="secondary">Action</Button>}
                >
                  <p className="text-body">Section body, with meta in the header (10 §4).</p>
                </EditorSection>
              )}
            </TabPanel>
          ))}
        </Tabs>
      </div>
      <p className="t-help">
        Compact (12 §4): from 1280, once the page has scrolled past 120px (and until it is back under 24), the overline
        and the meta row fold away (inert and hidden), the picture is 40px and the name 20px. The save area and the
        tabs stay. 200ms ease-out; instant under reduced motion.
      </p>
      <div data-kit="editor-band-compact" className="border border-border bg-bg">
        <Tabs defaultValue="extra">
          <KitBand theme={theme} compact />
          {EDITOR_TABS.map((t) => (
            <TabPanel key={t.value} value={t.value} className="p-5">
              <p className="text-body">The page under the band.</p>
            </TabPanel>
          ))}
        </Tabs>
      </div>
      <p className="t-help">New product: the same band, with no tabs and no "Loaded", and its create buttons.</p>
      <div className="border border-border">
        <ProductBand
          compact={false}
          imageUrl={null}
          overline="New Product"
          title="ZZ Harness Heater"
          meta={
            <>
              <span className="text-help text-muted">
                SKU <span className="t-code text-text">ZZH-1</span>
              </span>
              <StatusBadge status="HIDDEN" />
            </>
          }
          actions={
            <div className="flex flex-wrap items-center gap-3 lg:justify-end">
              <Button variant="ghost">Cancel</Button>
              <Button variant="secondary">Create and add another</Button>
              <Button className="max-lg:order-first">Create and edit</Button>
            </div>
          }
        />
      </div>
      <KitImages />
      <KitSidePanel />
      <p className="t-help">
        While the product loads (11 §1): the editor skeleton, the band and the cards in blocks on the editor's own
        grid, announced once as "Loading product". The grid and the side panel follow the window, not this panel.
      </p>
      <div data-kit="editor-skeleton" className="border border-border bg-bg p-4">
        <ProductEditorSkeleton tab="overview" />
      </div>
    </Section>
  );
}

/** The kit's editor band, expanded or compact (12 §4: held in one state here, since it is in place on a long page). */
function KitBand({ theme, compact }: { theme: string; compact: boolean }) {
  return (
    <ProductBand
      compact={compact}
      imageUrl="/sa-favicon.jpg"
      overline="SA Flexiheat · Climate Control and Heating"
      title="EX Heater"
      meta={
        <>
          <span className="text-help text-muted">
            SKU <span className="t-code text-text">SAPH18440</span>
          </span>
          <StatusBadge status="ACTIVE" />
          <span className="t-help">Loaded 10:00 · Refresh</span>
        </>
      }
      actions={
        <ProductSaveArea
          dirtyLabels={["Details", "Logos"]}
          isValid
          saving={false}
          savingLabel={null}
          saveErrors={{ logos: "Duda refused the save. Try again." }}
          validationErrors={{}}
          onSave={() => toast.success("Kit only — nothing saved")}
          onReset={() => {}}
          onOpenSection={() => {}}
          viewOnWebsite={
            <Button variant="secondary">
              <ExternalLink size={16} aria-hidden="true" />
              View on website
            </Button>
          }
        />
      }
      tabs={
        <TabList aria-label={`Product sections (kit, ${theme}${compact ? ", compact" : ""})`} className="-ml-3 shadow-none">
          {EDITOR_TABS.map((t) => (
            <Tab key={t.value} value={t.value} count={KIT_TAB_STATE[t.value]?.count} indicator={KIT_TAB_STATE[t.value]?.indicator}>
              {t.label}
            </Tab>
          ))}
        </TabList>
      }
    />
  );
}

/**
 * The kit's gallery. Local images; the query on two of them only makes the
 * pending-upload test (a Duda CDN host) read them as already on Duda.
 */
const KIT_IMAGES: ImageDraft[] = [
  { key: "k1", url: "/sa-favicon.jpg?irp.cdn-website.com", alt: "SA Equip mark" },
  { key: "k2", url: "/saequip-no-image.jpg?irp.cdn-website.com", alt: "" },
  { key: "k3", url: "/saequip-no-image.jpg", alt: "Just added" },
];

/** The Images section (12 §1: the first section of Files & media), with a gallery and empty. */
function KitImages() {
  const [images, setImages] = useState(KIT_IMAGES);
  const [none, setNone] = useState<ImageDraft[]>([]);
  return (
    <div className="space-y-3">
      <p className="t-help">
        Images, the first section of Files &amp; media (12 §1): the featured image (the first) beside the gallery from
        1024, under it below. A thumbnail opens the Image dialog; drag by the handle. Local state only: uploads and
        drops are faked, and Add from Media only reads the library.
      </p>
      <div data-kit="images-card">
        <ImagesSection images={images} onChange={setImages} upload={kitImageUpload} />
      </div>
      <div data-kit="images-card-empty">
        <ImagesSection images={none} onChange={setNone} upload={kitImageUpload} />
      </div>
    </div>
  );
}

/** The side panel at its narrowest (18rem): Visibility, with Delete product at its foot (12 §2), and Categories. */
function KitSidePanel() {
  const [status, setStatus] = useState("ACTIVE");
  const [accessory, setAccessory] = useState(false);
  return (
    <div className="space-y-3">
      <p className="t-help">
        The side panel at its narrowest (18rem; from 1280 it is clamp(18rem, 28%, 30rem)). Delete product opens the
        typed confirmation in the editor; here it does nothing.
      </p>
      <div data-kit="side-panel" className="w-[18rem] max-w-full space-y-5">
        <VisibilitySection
          status={status}
          onStatusChange={setStatus}
          isAccessory={accessory}
          onAccessoryChange={setAccessory}
          deleteControl={<DeleteProductLink onClick={() => toast("Kit only — nothing is deleted")} />}
        />
        <KitCategories />
      </div>
    </div>
  );
}

/** A small category tree for the side panel's summary card. */
const KIT_CATS: CategoryNode[] = [
  { id: "p", title: "Products", depth: 0, parent_id: "ROOT" },
  { id: "p1", title: "Lighting and Power", depth: 1, parent_id: "p" },
  { id: "p2", title: "Climate Control and Heating", depth: 1, parent_id: "p" },
  { id: "s", title: "Site Challenges", depth: 0, parent_id: "ROOT" },
  { id: "s1", title: "Welding Fume Control", depth: 1, parent_id: "s" },
  { id: "s2", title: "Shutdown and Turnaround Packages", depth: 1, parent_id: "s" },
  { id: "s3", title: "Hazardous-Area Lighting", depth: 1, parent_id: "s" },
  { id: "i", title: "Industries", depth: 0, parent_id: "ROOT" },
  { id: "i1", title: "Oil & Gas", depth: 1, parent_id: "i" },
  { id: "i2", title: "Aviation & Aerospace", depth: 1, parent_id: "i" },
  { id: "i3", title: "Nuclear", depth: 1, parent_id: "i" },
];

function KitCategories() {
  const [selected, setSelected] = useState(["p", "p2", "s", "s1", "s2", "i", "i1", "i2", "i3"]);
  return <CategoriesSection cats={KIT_CATS} loadError={null} selected={selected} onChange={setSelected} />;
}

function Chips() {
  return (
    <Section title="Chips">
      <Row>
        <span data-kit="chip:neutral"><Badge>Neutral</Badge></span>
        <span data-kit="chip:ok"><Badge tone="ok">Live</Badge></span>
        <span data-kit="chip:solid"><Badge tone="solid">Primary</Badge></span>
        <span data-kit="chip:new"><Badge tone="new">New</Badge></span>
        <span data-kit="chip:warning"><Badge tone="warning">3 left</Badge></span>
        <span data-kit="chip:danger"><Badge tone="danger">File missing</Badge></span>
      </Row>
      <Row>
        <Badge dot="unsaved">Unsaved</Badge>
        <Badge tone="danger" dot="error">Error</Badge>
        <StatusBadge status="ACTIVE" />
        <StatusBadge status="HIDDEN" />
        <StatusBadge status="IN_STOCK" />
      </Row>
    </Section>
  );
}

function Alerts() {
  return (
    <Section title="Alert">
      <span data-kit="alert:danger" className="block">
        <Alert tone="danger">Couldn't save the images: the network dropped.</Alert>
      </span>
      <span data-kit="alert:warning" className="block">
        <Alert tone="warning" title="Saving regenerates the variations">
          SKUs carry across for combinations that still exist; any that disappear lose theirs.
        </Alert>
      </span>
      <span data-kit="alert:info" className="block">
        <Alert tone="info" live="off" title="Save your option changes first.">
          Duda rebuilds this list when the options change.
        </Alert>
      </span>
      <span data-kit="alert:ok" className="block">
        <Alert tone="ok" title="Published">The site was republished a moment ago.</Alert>
      </span>
      <Alert
        tone="danger"
        action={
          <Button size="sm" variant="secondary">
            Remove
          </Button>
        }
      >
        2 selected items no longer exist (deleted in Duda).
      </Alert>
    </Section>
  );
}

function Surfaces() {
  return (
    <Section title="Surfaces">
      <PageHeader
        overline="Catalogue"
        title="Page header"
        description="One line of muted description."
        actions={
          <>
            <Button variant="secondary">Export CSV</Button>
            <Button>New product</Button>
          </>
        }
      />
      <p className="t-help">
        <span className="t-code-sm">actionsBeside="xl"</span>: several actions sit under the title until 1280px wide.
      </p>
      <PageHeader
        title="Translations"
        description="Product content in the website's other languages."
        actionsBeside="xl"
        actions={
          <>
            <Button variant="secondary" size="sm">
              Export CSV
            </Button>
            <Button variant="secondary" size="sm">
              Import CSV
            </Button>
            <Button size="sm">Translate missing (12)</Button>
          </>
        }
      />
      <Card data-kit="card">
        <CardHeader title="Card heading" description="Optional description." actions={<Button size="sm" variant="secondary">Action</Button>} />
        <p className="text-body">Card body on --surface with a 1px border.</p>
      </Card>
      <EmptyState title="Nothing here yet" description="Add one below." icon={<Image />} action={<Button size="sm">Add</Button>} />
      {/* On a card, where skeletons sit in the app. */}
      <Card className="flex items-center gap-4">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-4 w-64" />
        <Spinner className="text-muted" />
      </Card>
      {/* SkeletonLine sits on a type role's line box; SkeletonField shows real copy when it is given. */}
      <Card data-kit="skeleton-parts" className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <SkeletonLine text="t-section" className="h-[0.8em] w-28" />
          <SkeletonLine text="t-help" className="h-[0.7em] w-56 max-w-full" />
        </div>
        <SkeletonField label="Page URL" hint="Real label and hint, block for the value." />
      </Card>
      <Loader label="Loading products…" />
    </Section>
  );
}

function Brand() {
  return (
    <Section title="Logo">
      <p className="t-help">
        The real SA Equip logo (assets/saequip-logo-unframed.svg: the original's white frame removed, the viewBox
        cropped to the artwork). In the sidebar at 56px with "SA Equip" over "Product Hub" (12.13); above the sign-in
        card at 44px with "Product Hub".
      </p>
      <div className="flex flex-wrap gap-3">
        {/* The sidebar is always dark, so its words sit on the fixed sidebar tokens in both themes. */}
        <div className="flex items-center gap-3 bg-sidebar p-4" data-kit="logo:sidebar">
          <img src={logo} alt="" width={140} height={141} className="h-14 w-auto shrink-0" />
          <span className="min-w-0">
            <span className="t-lockup-name block text-sidebar-fg">SA Equip</span>
            <span className="block text-help text-sidebar-text">Product Hub</span>
          </span>
        </div>
        {/* The sign-in pages are light only. */}
        <div className="flex items-center gap-3 border border-border bg-surface p-4" data-theme="light" data-kit="logo:light">
          <img src={logo} alt="SA Equip" width={140} height={141} className="h-11 w-auto shrink-0" />
          <span className="text-label text-muted">Product Hub</span>
        </div>
      </div>
    </Section>
  );
}

function Tables() {
  const [rows, setRows] = useState(["Air Mover", "EX Heater", "Trolley for EX Heater"]);
  return (
    <Section title="Table and sortable list">
      <Table>
        <THead>
          <TR>
            <TH>Product</TH>
            <TH>SKU</TH>
          </TR>
        </THead>
        <TBody>
          <TR hover data-kit="row:hover">
            <TD primary>Hover row</TD>
            <TD className="t-code">SAPH18440</TD>
          </TR>
          <TR hover selected data-kit="row:selected">
            <TD primary>Selected row</TD>
            <TD className="t-code">SA4000</TD>
          </TR>
          <TR hover>
            <TD primary>Another row</TD>
            <TD className="t-code">SA4007</TD>
          </TR>
        </TBody>
      </Table>
      {/* The list form the editor sections use (as="div"). */}
      <Card padded={false}>
        <SortableList
          items={rows}
          getId={(r) => r}
          onReorder={setRows}
          className="divide-y divide-border"
          renderItem={(r, handle, i) => (
            <div className="flex items-center gap-3 px-3 py-2">
              <DragHandle handle={handle} label={`Drag ${r} to reorder`} />
              <span className="flex-1 text-body">{r}</span>
              <StatusBadge status={i === 0 ? "HIDDEN" : "ACTIVE"} />
            </div>
          )}
        />
      </Card>
    </Section>
  );
}

function Overlays() {
  const [open, setOpen] = useState(false);
  const confirm = useConfirm();
  return (
    <Section title="Dialogs, menus, toasts (portalled — follow “Overlays in”)">
      <Row>
        <Button variant="secondary" onClick={() => setOpen(true)}>
          Open dialog
        </Button>
        <Button
          variant="danger"
          onClick={() =>
            void confirm({ title: "Delete this logo?", description: "It is on 12 products.", confirmLabel: "Delete", danger: true })
          }
        >
          Delete…
        </Button>
        <DropdownMenu
          label="Actions for the kit row"
          actions={[
            { label: "Edit", onSelect: () => {} },
            { label: "Add value", onSelect: () => {} },
            { label: "Disabled", onSelect: () => {}, disabled: true, title: "Why it is disabled" },
            { label: "Delete", onSelect: () => {}, danger: true },
          ]}
        />
      </Row>
      <Row>
        <Button size="sm" variant="secondary" onClick={() => toast.success("Saved")}>Success</Button>
        <Button size="sm" variant="secondary" onClick={() => toast.error("Couldn't save")}>Error</Button>
        <Button size="sm" variant="secondary" onClick={() => toast.warning("1 translation was kept in English", { description: "The translator changed a number." })}>Warning</Button>
        <Button size="sm" variant="secondary" onClick={() => toast.info("Copied")}>Info</Button>
        <Button size="sm" variant="secondary" onClick={() => toast.loading("Uploading…")}>Loading</Button>
      </Row>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Rename option"
        description="Renaming keeps every product's choice."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => setOpen(false)}>Save</Button>
          </>
        }
      >
        <Field label="Name">
          <Input defaultValue="Hire/Purchase" />
        </Field>
      </Modal>
    </Section>
  );
}

const blank = { starredAt: null, starredBy: null, notes: null, notesUpdatedAt: null, notesUpdatedBy: null };
const read = { ...blank, readAt: "2026-10-30T10:00:00Z", readBy: "kit@saequip.com" };
const unread = { ...blank, readAt: null, readBy: null };
const starred = { starredAt: "2026-10-31T09:00:00Z", starredBy: "kit@saequip.com" };
type KitRequest = EnquiryState & { name: string; company: string | null; email: string; date: string };
const KIT_REQUESTS: KitRequest[] = [
  { id: "q1", name: "Alex Example", company: "Example Refining Ltd", email: "alex@example.com", date: "29 Oct", ...unread },
  { id: "q2", name: "Sam Sample", company: "Sample Shipyards", email: "sam@example.org", date: "27 Oct", ...unread, ...starred },
  { id: "q3", name: "Jo Tester", company: "Tester Rail", email: "jo@example.com", date: "21 Oct", ...read, ...starred },
  // No company: the list shows the email instead, as Quotes does.
  { id: "q4", name: "Pat Placeholder", company: null, email: "pat@example.net", date: "18 Oct", ...read },
  { id: "q5", name: "Lee Longname-Hyphenated", company: "A company with a long enough name to truncate", email: "lee@example.org", date: "2 Oct", ...read },
];

function Split({ theme }: { theme: string }) {
  // One URL param per panel, so the two demos don't select each other's rows.
  const { selectedId, select, hrefFor } = useSelection(`${theme}-id`);
  // State is local: opening, starring and notes here change nothing anywhere else.
  const [requests, setRequests] = useState(KIT_REQUESTS);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<EnquiryFilter>("all");
  const shown = filterEnquiries(requests, filter, query, (r) => [r.name, r.company, r.email]);
  const item = requests.find((r) => r.id === selectedId);
  const patch = (id: string, values: Partial<EnquiryState>) =>
    setRequests((rs) => rs.map((r) => (r.id === id ? { ...r, ...values } : r)));
  const toggleStar = (r: KitRequest) =>
    patch(r.id, isStarred(r) ? { starredAt: null, starredBy: null } : { starredAt: "2026-11-09T10:00:00Z", starredBy: "kit@saequip.com" });
  // Opening marks read, as the pages do (useAutoRead), without the network.
  useEffect(() => {
    if (item && isUnread(item)) patch(item.id, { readAt: "2026-11-09T10:00:00Z", readBy: "kit@saequip.com" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);
  return (
    <Section title="Split view">
      <p className="t-help">
        Selection is in the URL (<span className="t-code-sm">?{theme}-id=</span>); focus moves to the heading. Below lg:
        list only, then the detail with "Back to list". Unread rows are bold with a yellow square; opening one marks it
        read. The star shows on hover (always when starred, and on touch).{" "}
        <a href={hrefFor("missing")} className="underline underline-offset-2">
          Open an id that isn't in the list
        </a>
      </p>
      <div data-kit="split">
        <SplitView
          className="h-[520px]"
          listLabel="Quote requests (kit)"
          selectedId={selectedId}
          onBack={() => select(null)}
          list={
            <>
              <EnquiryToolbar
                all={requests}
                query={query}
                onQuery={setQuery}
                filter={filter}
                onFilter={setFilter}
                searchLabel={`Search quote requests (kit, ${theme})`}
              />
              {shown.length === 0 ? (
                <p className="px-5 py-6 text-body text-muted">No quote requests match.</p>
              ) : (
                <ul>
                  {shown.map((r) => (
                    <li key={r.id}>
                      <SplitListItem
                        to={hrefFor(r.id)}
                        selected={r.id === selectedId}
                        unread={isUnread(r)}
                        title={r.name}
                        subtitle={r.company ?? r.email}
                        meta={r.date}
                        aside={<StarButton inList enquiry={r} name={r.name} onToggle={() => toggleStar(r)} />}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </>
          }
          detail={
            selectedId === null ? null : item ? (
              <>
                <SplitDetailHeader
                  title={item.name}
                  titleAside={<StarButton enquiry={item} name={item.name} onToggle={() => toggleStar(item)} />}
                  subtitle={item.company ?? undefined}
                  actions={
                    <EnquiryActions
                      kind="quote"
                      enquiry={item}
                      onMarkUnread={() => patch(item.id, { readAt: null, readBy: null })}
                      onDelete={() => toast.success("Kit only — nothing deleted")}
                      onExport={() => toast.success("Kit only — nothing exported")}
                    />
                  }
                />
                <div className="space-y-6 px-6 py-5">
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
                    {(
                      [
                        ["Opened", <ReadStatus key="s" enquiry={item} />],
                        ["Email", item.email],
                        ["When needed", "Within the next month"],
                        ["Submitted", `${item.date} 2026, 10:00`],
                      ] as const
                    ).map(([k, v]) => (
                      <div key={k}>
                        <dt className="t-label">{k}</dt>
                        <dd className="mt-0.5 text-body text-text">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <EnquiryNotes
                    key={item.id}
                    enquiry={item}
                    onSave={async (notes) => {
                      patch(item.id, { notes, notesUpdatedAt: "2026-11-09T10:00:00Z", notesUpdatedBy: "kit@saequip.com" });
                      return true;
                    }}
                  />
                </div>
              </>
            ) : (
              <>
                <SplitDetailHeader title="Not found" />
                <p className="px-6 py-5 text-body text-muted">Nothing in this list has that id.</p>
              </>
            )
          }
          emptyDetail={<EmptyState className="m-6" title="Select a request" description="Its details show here." />}
        />
      </div>
    </Section>
  );
}

const KIT_ROWS = Array.from({ length: 91 }, (_, i) => `Product ${i + 1}`);

function Pages() {
  const paged = usePagedList(KIT_ROWS);
  const [serverPage, setServerPage] = useState(7);
  return (
    <Section title="Pagination">
      <p className="t-help">
        Client-side, 91 rows, rows per page — this page: {paged.pageItems[0]} … {paged.pageItems[paged.pageItems.length - 1]}
      </p>
      <div data-kit="pagination">
        <Pagination
          page={paged.page}
          total={paged.total}
          pageSize={paged.pageSize}
          onPageChange={paged.setPage}
          onPageSizeChange={paged.setPageSize}
          label="products"
        />
      </div>
      <p className="t-help">Server-paged (fixed 24), 485 assets</p>
      <Pagination page={serverPage} total={485} pageSize={24} onPageChange={setServerPage} label="assets" />
      <p className="t-help">One page</p>
      <Pagination page={1} total={7} pageSize={24} onPageChange={() => {}} label="assets" />
    </Section>
  );
}

/** A tall drawing, so `contain` (letterboxed on paper) and `cover` (cropped) look different. */
const TALL_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="60" height="120"><rect width="60" height="120" fill="#4a4a48"/><rect x="10" y="10" width="40" height="40" fill="#fed217"/><circle cx="30" cy="85" r="18" fill="#c9c9c5"/></svg>',
  );

function Thumbs() {
  return (
    <Section title="Thumb and ImageWell">
      <Row label="40 / 56 / 100">
        <span data-kit="thumb:image">
          <Thumb src="/sa-favicon.jpg" size={40} />
        </span>
        <Thumb src="/sa-favicon.jpg" size={56} />
        <Thumb src="/sa-favicon.jpg" size={100} />
      </Row>
      <Row label="contain / cover">
        <Thumb src={TALL_IMAGE} size={56} />
        <Thumb src={TALL_IMAGE} size={56} fit="cover" />
      </Row>
      <Row label="fallbacks">
        <span data-kit="thumb:none">
          <Thumb src={null} size={40} />
        </span>
        <Thumb src={null} size={56} fallback="box" />
        {/* A URL that fails, so onError swaps in the fallback. */}
        <Thumb src="/kit-missing-image.png" size={56} />
        <Thumb src={null} size={100} fallback="box" />
      </Row>
      <div className="grid max-w-md grid-cols-3 gap-3">
        <ImageWell src="/saequip-no-image.jpg" className="h-24" />
        <ImageWell src={TALL_IMAGE} aspect="square" />
        <ImageWell src={null} aspect="square" />
      </div>
    </Section>
  );
}

/** fakeUpload with a picture to show, for the Images card. */
const kitImageUpload: typeof fakeUpload = async (file, opts) => ({
  ...(await fakeUpload(file, opts)),
  kind: "image",
  url: "/saequip-no-image.jpg",
  alt: null,
});

/** A stand-in for the real upload: fakes progress locally and never calls the API. */
const fakeUpload: NonNullable<React.ComponentProps<typeof FileDropzone>["upload"]> = (file, opts) =>
  new Promise((resolve) => {
    let p = 0;
    const tick = setInterval(() => {
      p = Math.min(100, p + 25);
      opts?.onProgress?.(p);
      if (p >= 100) {
        clearInterval(tick);
        resolve({ id: "kit", filename: file.name } as never);
      }
    }, 150);
  });

function Files() {
  // Holds the chosen file locally; nothing is uploaded.
  const [file, setFile] = useState<File | null>(null);
  return (
    <Section title="Files">
      <FileDropzone upload={fakeUpload} hint="Kit only — nothing is uploaded." />
      <Row label="file input">
        <span data-kit="fileinput">
          <FileInput file={file} onChange={setFile} />
        </span>
        <FileInput file={null} onChange={() => {}} disabled label="Choose file (disabled)" />
      </Row>
      <Row>
        <FilePreview filename="datasheet.pdf" className="h-24 w-20 border border-border" />
        <FilePreview filename="manual.docx" className="h-24 w-20 border border-border" />
        <FilePreview filename="model.glb" className="h-24 w-20 border border-border" />
      </Row>
    </Section>
  );
}

function Editing() {
  const [html, setHtml] = useState("<p>First paragraph.</p><p>Second paragraph, 12px below.</p>");
  return (
    <Section title="Rich text">
      <RichTextEditor ariaLabel="Rich text (kit)" value={html} onChange={setHtml} />
    </Section>
  );
}
