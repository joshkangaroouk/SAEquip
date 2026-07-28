import { useState } from "react";
import { API_BASE } from "../lib/api";
import { Badge, Card, Toggle, toast } from "../components/ui";

/**
 * The embeddable widget's own production CSS (verbatim from
 * backend/src/public-widget/widget.js → injectStyles), reused here so every
 * preview below is a byte-accurate match for what actually renders on Duda.
 */
const WIDGET_CSS = `
.saeh-root{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;line-height:1.5;box-sizing:border-box}
.saeh-root *{box-sizing:border-box}
.saeh-section{margin:22px 0}
.saeh-section:first-child{margin-top:0}
.saeh-section:last-child{margin-bottom:0}
.saeh-h{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#111;margin:0 0 12px;border-left:4px solid #ffd200;padding-left:10px}
.saeh-logos{display:flex;flex-wrap:wrap;gap:18px;align-items:center}
.saeh-logos img{max-height:56px;max-width:150px;object-fit:contain;display:block}
.saeh-table{width:100%;border-collapse:collapse;font-size:14px}
.saeh-table td{padding:9px 12px;border-bottom:1px solid #ececec;vertical-align:top}
.saeh-table tr:nth-child(even){background:#fafafa}
.saeh-table td.saeh-label{font-weight:600;width:40%;color:#333}
.saeh-list{list-style:none;padding:0;margin:0}
.saeh-list li{position:relative;padding:5px 0 5px 26px;font-size:14px}
.saeh-check li:before{content:'\\2713';position:absolute;left:0;top:6px;color:#111;background:#ffd200;border-radius:50%;width:17px;height:17px;font-size:11px;line-height:17px;text-align:center;font-weight:700}
.saeh-apps li:before{content:'';position:absolute;left:7px;top:12px;width:6px;height:6px;background:#111;border-radius:50%}
.saeh-dl{display:flex;flex-wrap:wrap;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #ececec}
.saeh-dl:last-child{border-bottom:0}
.saeh-dl-title{flex:1 1 auto;font-size:14px;font-weight:500;min-width:140px}
.saeh-btn{display:inline-block;background:#111;color:#fff;border:none;border-radius:5px;padding:9px 18px;font-size:13px;font-weight:600;cursor:pointer;text-decoration:none;line-height:1.2}
.saeh-btn:hover{background:#333}
.saeh-form{flex-basis:100%;display:none;flex-wrap:wrap;gap:8px;margin-top:10px;padding:14px;background:#f7f7f7;border-radius:8px}
.saeh-form.saeh-open{display:flex}
.saeh-in{flex:1 1 180px;padding:9px;border:1px solid #ccc;border-radius:5px;font-size:14px}
.saeh-msg{flex-basis:100%;font-size:13px;margin-top:2px}
.saeh-ok{color:#137333}
.saeh-err{color:#c5221f}
`;

/** Small labelled-rectangle data-URI so logo previews render without real image assets. */
function placeholderLogo(label: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="56"><rect width="150" height="56" fill="#f4f4f5" stroke="#d4d4d8"/><text x="75" y="32" font-family="sans-serif" font-size="11" fill="#52525b" text-anchor="middle">${label}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// ---- example dummy data — mirrors the shape of GET /public/products/content ----
const DUMMY = {
  saLogos: ["SA Rental", "SA Lumin", "SA Flexiheat", "SA Endure"],
  certLogos: ["ISO 9001", "CE Mark"],
  specs: [
    { label: "Power Rating", value: "2.4 kW" },
    { label: "Voltage", value: "220–240V AC" },
    { label: "IP Rating", value: "IP66" },
    { label: "Weight", value: "18.5 kg" },
    { label: "Certification", value: "ATEX Zone 1" },
  ],
  benefits: [
    "Explosion-proof housing rated for hazardous zones",
    "Low power consumption with high heat output",
    "Corrosion-resistant stainless steel enclosure",
  ],
  applications: [
    "Oil & gas processing facilities",
    "Mining and underground operations",
    "Chemical manufacturing plants",
  ],
  downloads: [
    { id: "d1", title: "Installation Guide (PDF)", gated: false },
    { id: "d2", title: "Full Datasheet (PDF)", gated: true },
  ],
};

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy — select and copy manually");
    }
  }

  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-md bg-[#0A0A0A] p-4 pr-16 text-xs leading-relaxed text-[#E4E4E7]">
        <code>{code}</code>
      </pre>
      <button
        type="button"
        onClick={copy}
        className="absolute right-2 top-2 rounded-md border border-white/20 px-2 py-1 text-xs font-semibold text-white transition-colors hover:bg-white/10"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}

function LogoPreview({ title, labels }: { title?: string; labels: string[] }) {
  return (
    <div className="saeh-section">
      {title && <div className="saeh-h">{title}</div>}
      <div className="saeh-logos">
        {labels.map((label) => (
          <img key={label} src={placeholderLogo(label)} alt={label} />
        ))}
      </div>
    </div>
  );
}

function SpecsPreview() {
  return (
    <div className="saeh-section">
      <div className="saeh-h">Technical Specifications</div>
      <table className="saeh-table">
        <tbody>
          {DUMMY.specs.map((s) => (
            <tr key={s.label}>
              <td className="saeh-label">{s.label}</td>
              <td>{s.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ListPreview({ title, items, checklist }: { title: string; items: string[]; checklist: boolean }) {
  return (
    <div className="saeh-section">
      <div className="saeh-h">{title}</div>
      <ul className={`saeh-list ${checklist ? "saeh-check" : "saeh-apps"}`}>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function DownloadsPreview() {
  const [openId, setOpenId] = useState<string | null>(null);
  const [sentId, setSentId] = useState<string | null>(null);

  return (
    <div className="saeh-section">
      <div className="saeh-h">Downloads</div>
      {DUMMY.downloads.map((d) => (
        <div key={d.id} className="saeh-dl">
          <span className="saeh-dl-title">{d.title}</span>
          {!d.gated ? (
            <a className="saeh-btn" href="#" onClick={(e) => e.preventDefault()}>
              Download
            </a>
          ) : (
            <button type="button" className="saeh-btn" onClick={() => setOpenId(openId === d.id ? null : d.id)}>
              Download
            </button>
          )}
          {d.gated && (
            <form
              className={`saeh-form ${openId === d.id ? "saeh-open" : ""}`}
              onSubmit={(e) => {
                e.preventDefault();
                setSentId(d.id);
              }}
            >
              <input className="saeh-in" placeholder="Name" required />
              <input className="saeh-in" placeholder="Email" type="email" required />
              <input className="saeh-in" placeholder="Company (optional)" />
              <button type="submit" className="saeh-btn">
                Get download
              </button>
              {sentId === d.id && <div className="saeh-msg saeh-ok">Thanks — your download is starting.</div>}
            </form>
          )}
        </div>
      ))}
    </div>
  );
}

interface WidgetDef {
  key: string;
  name: string;
  description: string;
  section: string | null; // null = legacy full embed (no data-section)
  preview: React.ReactNode;
  /** Default true. When false the embed snippet is withheld entirely. */
  enabled?: boolean;
  /** Why it's off. Shown in place of the snippet. */
  disabledReason?: string;
}

export default function Widgets() {
  const scriptTag = `<script src="${API_BASE}/public/widget.js" defer></script>`;

  const widgets: WidgetDef[] = [
    {
      key: "sa-logos",
      name: "SA Logos",
      description: "Local/SA compliance logos active for this product.",
      section: "sa-logos",
      preview: <LogoPreview labels={DUMMY.saLogos} />,
    },
    {
      key: "cert-logos",
      name: "Certifications",
      description: "Certification logos active for this product.",
      section: "cert-logos",
      preview: <LogoPreview labels={DUMMY.certLogos} />,
    },
    {
      key: "specs",
      name: "Technical Specs",
      description: "The product's spec table (label/value rows).",
      section: "specs",
      preview: <SpecsPreview />,
    },
    {
      key: "benefits",
      name: "Key Benefits",
      description: "Checklist-style list of benefits.",
      section: "benefits",
      preview: <ListPreview title="Key Benefits" items={DUMMY.benefits} checklist />,
    },
    {
      key: "applications",
      name: "Applications",
      description: "Checklist-style list of typical applications.",
      section: "applications",
      preview: <ListPreview title="Applications" items={DUMMY.applications} checklist />,
    },
    {
      key: "downloads",
      name: "Downloads",
      description: "Download rows. Gated files show a lead-capture form first.",
      section: "downloads",
      preview: <DownloadsPreview />,
      enabled: false,
      disabledReason:
        "Parked — the per-product downloads editor has been removed, so there is nothing to render yet. The backend, captured leads and the widget's downloads section are all still in place, so re-enabling this is a UI change only.",
    },
    {
      key: "all",
      name: "Full Embed (legacy)",
      description: "Renders every non-empty section together in one mount — the original, pre section-scoped behavior.",
      section: null,
      preview: (
        <>
          <LogoPreview labels={DUMMY.certLogos} />
          <LogoPreview labels={DUMMY.saLogos} />
          <SpecsPreview />
          <ListPreview title="Key Benefits" items={DUMMY.benefits} checklist />
          <ListPreview title="Applications" items={DUMMY.applications} checklist />
          <DownloadsPreview />
        </>
      ),
    },
  ];

  return (
    <>
      <style>{WIDGET_CSS}</style>

      <h1 className="text-xl font-semibold text-text">Widgets</h1>
      <p className="mt-1 text-sm text-muted">
        Embeddable, section-scoped widgets that pull this product's Hub content onto its live Duda page.
        Paste the code below into a Duda embed/code element.
      </p>

      <Card className="mt-6">
        <h2 className="text-body font-semibold text-text">How it works</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
          <li>One <code className="rounded bg-surface-2 px-1 py-0.5 text-xs text-text">{"<script>"}</code> tag per page — it's safe to include it multiple times (Duda embeds each ship their own copy).</li>
          <li>One mount <code className="rounded bg-surface-2 px-1 py-0.5 text-xs text-text">{"<div>"}</code> per section, placed anywhere on the page.</li>
          <li>
            No <code className="rounded bg-surface-2 px-1 py-0.5 text-xs text-text">data-slug</code> needed — this
            runs on Duda's dynamic product page template, so the widget reads the product straight from the page
            URL (anything matching <code className="rounded bg-surface-2 px-1 py-0.5 text-xs text-text">/product/&lt;slug&gt;</code>).
            The same embed code works unchanged across every product page.
          </li>
          <li>A section renders nothing if that content is empty on the product — it never leaves a broken-looking gap.</li>
        </ul>
      </Card>

      <div className="mt-6 space-y-6">
        {widgets.map((w) => {
          const div = w.section
            ? `<div class="saequip-hub" data-section="${w.section}"></div>`
            : `<div id="saequip-product-hub"></div>`;
          const code = `${div}\n${scriptTag}`;

          const enabled = w.enabled !== false;

          return (
            <Card key={w.key} className={enabled ? undefined : "opacity-70"}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-body font-semibold text-text">{w.name}</h2>
                  {!enabled && <Badge tone="neutral">Disabled</Badge>}
                </div>
                <div className="flex items-center gap-2">
                  {w.section && (
                    <code className="rounded bg-surface-2 px-1.5 py-0.5 text-xs text-muted">
                      data-section="{w.section}"
                    </code>
                  )}
                  {/* Genuinely inert, not a toggle that pretends to control the
                      live site — the widget renders downloads from
                      /public/products/content regardless of anything here. */}
                  {!enabled && (
                    <Toggle
                      checked={false}
                      disabled
                      onChange={() => {}}
                      label="Enabled"
                      id={`toggle-${w.key}`}
                    />
                  )}
                </div>
              </div>
              <p className="mt-1 text-sm text-muted">{w.description}</p>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">
                    Embed in Duda
                  </p>
                  {enabled ? (
                    <CodeBlock code={code} />
                  ) : (
                    <p className="rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-muted">
                      {w.disabledReason}
                    </p>
                  )}
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">
                    Preview (example data)
                  </p>
                  <div className="rounded-md border border-border bg-white p-4">
                    <div className="saeh-root">{w.preview}</div>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
