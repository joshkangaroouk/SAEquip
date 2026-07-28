import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
  DragHandle,
  EmptyState,
  Field,
  FileDropzone,
  Input,
  Loader,
  Modal,
  PageHeader,
  Select,
  SortableList,
  Spinner,
  StatusBadge,
  Table,
  TD,
  TH,
  THead,
  Textarea,
  toast,
  Toggle,
  TR,
  useConfirm,
} from "../components/ui";

/**
 * TEMPORARY component-kit showcase (route: /ui). Exercises every primitive for
 * visual verification of the dark/sharp/yellow system. Remove before shipping
 * the feature-page rewrites.
 */
export default function UIShowcase() {
  const confirm = useConfirm();
  const [modalOpen, setModalOpen] = useState(false);
  const [toggleOn, setToggleOn] = useState(true);
  const [checkOn, setCheckOn] = useState(false);
  const [rows, setRows] = useState([
    { id: "a", name: "First item" },
    { id: "b", name: "Second item" },
    { id: "c", name: "Third item" },
  ]);
  const [tableRows, setTableRows] = useState([
    { id: "r1", product: "EX Heater", status: "ACTIVE", sku: "EXH-100" },
    { id: "r2", product: "Sample Widget", status: "HIDDEN", sku: "SMP-200" },
    { id: "r3", product: "Demo Gadget", status: "ACTIVE", sku: "DMO-300" },
  ]);

  return (
    <div className="space-y-12">
      <PageHeader
        title="Component Kit"
        description="Temporary showcase of the brand design system — dark, sharp, yellow."
        actions={<Button onClick={() => toast.success("Hello from the kit")}>Fire a toast</Button>}
      />

      {/* Typography */}
      <section className="space-y-4">
        <h2 className="text-h2">Typography</h2>
        <Card className="space-y-3">
          <p className="text-display">Display</p>
          <h1 className="text-h1">Heading 1</h1>
          <h2 className="text-h2">Heading 2</h2>
          <h3 className="text-h3">Heading 3</h3>
          <p className="text-body">
            Body text at 14px, weight 400 (Regular). IBM Plex Sans is the only typeface — only
            Regular (400) and Semibold (600) are loaded — <span className="font-semibold">this span is semibold (600)</span>.
          </p>
          <p className="text-small text-muted">Small / muted text at 15px.</p>
        </Card>
      </section>

      {/* Buttons */}
      <section className="space-y-4">
        <h2 className="text-h2">Buttons</h2>
        <Card className="flex flex-wrap items-center gap-3">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="primary" size="sm">Small</Button>
          <Button variant="primary" loading>Loading</Button>
          <Button variant="primary" disabled>Disabled</Button>
        </Card>
      </section>

      {/* Form controls */}
      <section className="space-y-4">
        <h2 className="text-h2">Form controls</h2>
        <Card className="grid gap-5 sm:grid-cols-2">
          <Field label="Text input" hint="A short helper hint.">
            <Input placeholder="Type something…" />
          </Field>
          <Field label="With error" error="This field is required.">
            <Input placeholder="Invalid" />
          </Field>
          <Field label="Select" className="sm:col-span-1">
            <Select defaultValue="">
              <option value="" disabled>Choose an option…</option>
              <option value="1">Option one</option>
              <option value="2">Option two</option>
              <option value="3">Option three</option>
            </Select>
          </Field>
          <Field label="Textarea" className="sm:col-span-1">
            <Textarea placeholder="Multiple lines…" />
          </Field>
          <div className="flex items-center gap-8 sm:col-span-2">
            <Toggle checked={toggleOn} onChange={setToggleOn} label="Toggle switch" />
            <Checkbox checked={checkOn} onChange={setCheckOn} label="Checkbox" />
          </div>
        </Card>
      </section>

      {/* Badges */}
      <section className="space-y-4">
        <h2 className="text-h2">Badges</h2>
        <Card className="flex flex-wrap items-center gap-3">
          <Badge tone="neutral">Neutral</Badge>
          <Badge tone="accent">Accent</Badge>
          <Badge tone="success">Success</Badge>
          <Badge tone="danger">Danger</Badge>
          <StatusBadge status="ACTIVE" />
          <StatusBadge status="HIDDEN" />
        </Card>
      </section>

      {/* Card with header */}
      <section className="space-y-4">
        <h2 className="text-h2">Card / Panel</h2>
        <Card>
          <CardHeader
            title="Panel title"
            description="A surface panel with a hairline border and rounded corners."
            actions={<Button size="sm" variant="secondary">Action</Button>}
          />
          <p className="text-body text-muted">Panel body content goes here.</p>
        </Card>
      </section>

      {/* Table (with sortable rows) */}
      <section className="space-y-4">
        <h2 className="text-h2">Table (drag to reorder)</h2>
        <Table>
          <THead sticky>
            <TR>
              <TH className="w-10"></TH>
              <TH>Product</TH>
              <TH>SKU</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <SortableList
            as="tbody"
            items={tableRows}
            getId={(r) => r.id}
            onReorder={setTableRows}
            renderItem={(r, handle) => (
              <>
                <TD className="w-10"><DragHandle handle={handle} /></TD>
                <TD className="font-semibold">{r.product}</TD>
                <TD className="text-muted">{r.sku}</TD>
                <TD><StatusBadge status={r.status} /></TD>
              </>
            )}
          />
        </Table>
      </section>

      {/* Sortable list */}
      <section className="space-y-4">
        <h2 className="text-h2">Sortable list (dnd-kit)</h2>
        <SortableList
          items={rows}
          getId={(r) => r.id}
          onReorder={setRows}
          renderItem={(r, handle) => (
            <div className="flex items-center gap-3 border border-border bg-surface px-4 py-3">
              <DragHandle handle={handle} />
              <span className="text-body">{r.name}</span>
            </div>
          )}
        />
      </section>

      {/* Modal + confirm */}
      <section className="space-y-4">
        <h2 className="text-h2">Modal &amp; confirm</h2>
        <Card className="flex flex-wrap gap-3">
          <Button onClick={() => setModalOpen(true)}>Open modal</Button>
          <Button
            variant="danger"
            onClick={async () => {
              const ok = await confirm({
                title: "Delete this item?",
                description: "This action cannot be undone.",
                confirmLabel: "Delete",
                danger: true,
              });
              toast[ok ? "success" : "error"](ok ? "Confirmed" : "Cancelled");
            }}
          >
            Confirm dialog
          </Button>
        </Card>
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Example modal"
          description="Rounded dialog rendered in a portal."
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={() => setModalOpen(false)}>Save</Button>
            </>
          }
        >
          <p className="text-muted">Modal body content — anything can go here.</p>
        </Modal>
      </section>

      {/* Toasts */}
      <section className="space-y-4">
        <h2 className="text-h2">Toasts</h2>
        <Card className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => toast.success("Saved successfully")}>
            Success
          </Button>
          <Button variant="secondary" onClick={() => toast.error("Something went wrong")}>
            Error
          </Button>
          <Button variant="secondary" onClick={() => toast.loading("Working…")}>
            Loading
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              toast.promise(new Promise((res) => setTimeout(res, 1200)), {
                loading: "Uploading…",
                success: "Uploaded!",
                error: "Failed",
              })
            }
          >
            Promise
          </Button>
        </Card>
      </section>

      {/* File dropzone */}
      <section className="space-y-4">
        <h2 className="text-h2">File dropzone</h2>
        <p className="text-small text-muted">
          Uploads each file to <code>POST /api/media</code> with a progress bar. (Use throwaway
          files — real uploads create Media assets.)
        </p>
        <FileDropzone
          uploadUrl="/api/media"
          hint="Images or files up to 25MB"
          onUploaded={(asset) => toast.success(`Asset ${asset.id ?? ""} ready`)}
        />
      </section>

      {/* Empty / loading states */}
      <section className="space-y-4">
        <h2 className="text-h2">States</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <EmptyState
            title="Nothing here yet"
            description="An empty-state block with a call to action."
            action={<Button size="sm">Create one</Button>}
          />
          <Card className="flex items-center justify-center">
            <Loader label="Loading data…" />
          </Card>
        </div>
        <div className="flex items-center gap-3 text-muted">
          <Spinner /> <span className="text-small">Inline spinner</span>
        </div>
      </section>
    </div>
  );
}
