import { useState } from "react";
import { Image, Plus, Trash2 } from "lucide-react";
import {
  AccordionCard,
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
  DragHandle,
  DropdownMenu,
  EmptyState,
  Field,
  FileDropzone,
  FilePreview,
  Highlight,
  Input,
  Loader,
  Modal,
  PageHeader,
  RemoveButton,
  RichTextEditor,
  SegmentedControl,
  Select,
  SelectMenu,
  Skeleton,
  SortableList,
  Spinner,
  StatusBadge,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Textarea,
  Toggle,
  ToggleTrack,
  toast,
  useConfirm,
} from "../components/ui";
import { ErrorBox } from "../components/ui/Card";

/**
 * The living UI kit — every ui/ primitive, every variant and state, in the
 * light and the dark theme side by side. Development only: routed at /ui
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
      <Chips />
      <Surfaces />
      <Tables />
      <Overlays />
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
        <span className="t-code">SAPH18440</span> <span className="t-code-sm text-muted">ex-heater · 12</span>
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
      <Card data-kit="card">
        <CardHeader title="Card heading" description="Optional description." actions={<Button size="sm" variant="secondary">Action</Button>} />
        <p className="text-body">Card body on --surface with a 1px border.</p>
      </Card>
      <ErrorBox message="Couldn't save the images: the network dropped." />
      <AccordionCard title="Accordion (until tabs)" description="Collapsible section" summary="3" dirty>
        <p className="text-body">Body</p>
      </AccordionCard>
      <EmptyState title="Nothing here yet" description="Add one below." icon={<Image />} action={<Button size="sm">Add</Button>} />
      {/* On a card, where skeletons sit in the app. */}
      <Card className="flex items-center gap-4">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-4 w-64" />
        <Spinner className="text-muted" />
      </Card>
      <Loader label="Loading products…" />
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
  return (
    <Section title="Files">
      <FileDropzone upload={fakeUpload} hint="Kit only — nothing is uploaded." />
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
      <RichTextEditor value={html} onChange={setHtml} />
    </Section>
  );
}
