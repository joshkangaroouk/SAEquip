import { useState } from "react";
import { API_BASE } from "../lib/api";
import { Badge, Card, Toggle, toast } from "../components/ui";

/**
 * The embeddable widget's own production CSS (verbatim from
 * backend/src/public-widget/widget.js → injectStyles), reused here so every
 * preview below is a byte-accurate match for what actually renders on Duda.
 */
const WIDGET_CSS = `
.saeh-root{font-family:inherit;color:#1a1a1a;max-width:920px;margin:0;line-height:1.5;box-sizing:border-box}
.saeh-root *{box-sizing:border-box}
.saeh-section{margin:0}
.saeh-section + .saeh-section{margin-top:22px}
.saeh-h{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#111;margin:0 0 12px;border-left:4px solid #ffd200;padding-left:10px}
.saeh-logos{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.saeh-logos img{height:35px;width:auto;flex:0 0 auto;display:block}
.saeh-tabs{border:1px solid #ececec;border-radius:10px;overflow:hidden}
.saeh-tab-h{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;box-sizing:border-box;margin:0;font-family:inherit;text-align:left;background:#fafafa;border:0;border-top:1px solid #ececec;padding:14px 16px;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#111;cursor:pointer}
.saeh-tab-h:first-child{border-top:0}
.saeh-tab-h:hover{background:#f2f2f2}
.saeh-tab-h[aria-expanded='true']{background:#fff}
.saeh-tab-h:after{content:'';flex:0 0 auto;width:8px;height:8px;border-right:2px solid #111;border-bottom:2px solid #111;transform:rotate(45deg);margin-top:-4px;transition:transform .15s ease}
.saeh-tab-h[aria-expanded='true']:after{transform:rotate(225deg);margin-top:2px}
.saeh-tab-h:focus-visible{outline:2px solid #111;outline-offset:-2px}
.saeh-tab-p{padding:18px 16px;background:#fff;border-top:1px solid #ececec}
.saeh-prose{font-size:18px;font-weight:400}
.saeh-prose p{margin:0}
.saeh-prose p + p{margin-top:12px}
.saeh-prose ul,.saeh-prose ol{margin:12px 0;padding-left:22px}
.saeh-prose h4,.saeh-prose h5,.saeh-prose h6{margin:14px 0 6px;font-size:16px;font-weight:700}
.saeh-prose a{color:inherit;text-decoration:underline}
.saeh-prose hr{border:0;border-top:1px solid #ececec;margin:16px 0}
.saeh-prose > *:first-child{margin-top:0}
.saeh-prose > *:last-child{margin-bottom:0}
.saeh-table{width:100%;border-collapse:collapse;font-size:18px;font-weight:400;font-style:normal}
.saeh-table td{padding:9px 12px;border-bottom:1px solid #ececec;vertical-align:top}
.saeh-table tr:nth-child(even){background:#fafafa}
.saeh-table td.saeh-label{font-weight:600;width:40%;color:#333}
.saeh-list{list-style:none;padding:0;margin:0}
.saeh-list li{position:relative;padding:5px 0 5px 26px;font-size:18px;font-weight:400;font-style:normal}
.saeh-check li:before{content:'';position:absolute;left:0;top:6px;width:17px;height:17px;border-radius:50%;background:#ffd200 url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23111' stroke-width='3.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 6 9 17l-5-5'/%3E%3C/svg%3E") center/11px 11px no-repeat}
.saeh-apps li:before{content:'';position:absolute;left:7px;top:12px;width:6px;height:6px;background:#111;border-radius:50%}
.saeh-dl{display:flex;flex-wrap:wrap;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #ececec}
.saeh-dl:last-child{border-bottom:0}
.saeh-dl-title{flex:1 1 auto;font-size:18px;font-weight:400;font-style:normal;min-width:140px}
.saeh-btn{display:inline-block;font-family:inherit;background:#111;color:#fff;border:none;border-radius:5px;padding:9px 18px;font-size:15px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;cursor:pointer;text-decoration:none;line-height:1.2}
.saeh-btn:hover{background:#333}
.saeh-btn:disabled{opacity:.6;cursor:default}
.saeh-form{flex-basis:100%;display:none;flex-wrap:wrap;gap:8px;margin-top:10px;padding:14px;background:#f7f7f7;border-radius:8px}
.saeh-form.saeh-open{display:flex}
.saeh-in{flex:1 1 180px;font-family:inherit;padding:9px;border:1px solid #ccc;border-radius:5px;font-size:18px;font-weight:400;font-style:normal}
.saeh-hp{position:absolute!important;left:-9999px!important;width:1px;height:1px;opacity:0}
.saeh-msg{flex-basis:100%;font-size:18px;font-weight:400;font-style:normal;margin-top:2px}
.saeh-ok{color:#137333}
.saeh-err{color:#c5221f}
.saeh-3d-cta{border:1px solid #ececec;border-radius:10px;padding:32px 20px;text-align:center;background:linear-gradient(180deg,#fafafa,#f4f4f5)}
.saeh-3d-icon{width:32px;height:32px;color:#111;display:block;margin:0 auto 12px}
.saeh-3d-cta-title{font-size:16px;font-weight:700;color:#111;margin:0 0 16px}
.saeh-3d-overlay{position:fixed;inset:0;z-index:999999;background:rgba(17,17,17,.72);display:flex;font-family:inherit}
.saeh-3d-sheet{position:relative;margin:40px;flex:1;min-width:0;background:#fff;border-radius:10px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.4)}
.saeh-3d-close{position:absolute;top:14px;right:14px;z-index:2;width:36px;height:36px;border-radius:50%;border:none;background:rgba(17,17,17,.06);color:#111;font-family:inherit;font-size:15px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0}
.saeh-3d-close:hover{background:rgba(17,17,17,.12)}
.saeh-3d-stage{flex:1;min-height:0;background:#f4f4f5}
.saeh-3d-mv{width:100%;height:100%;display:block;--poster-color:transparent;outline:none}
.saeh-3d-bar{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;padding:14px;border-top:1px solid #ececec;flex-shrink:0}
@media(max-width:520px){.saeh-table td.saeh-label{width:auto}
.saeh-dl{align-items:flex-start}
.saeh-3d-sheet{margin:16px}
}
@media(min-width:721px){.saeh-tabs{display:flex;flex-wrap:wrap;border:0;border-radius:0;overflow:visible}
.saeh-tab-h{order:1;width:auto;flex:0 0 auto;border:0;border-bottom:3px solid transparent;background:none;padding:12px 20px 10px;font-size:13px}
.saeh-tab-h:hover{background:none;color:#000}
.saeh-tab-h[aria-expanded='true']{background:none;border-bottom-color:#ffd200}
.saeh-tab-h:after{display:none}
.saeh-tab-h:first-child{padding-left:0}
.saeh-tab-p{order:2;flex-basis:100%;padding:22px 0 0;background:none}
}
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

/**
 * Static mock of the CTA — clicking "View 3D Mode" on the live page opens a
 * full-screen modal (40px margin, click-off or ✕ to close, spin/reset
 * controls at the bottom). Not worth wiring a real modal + model-viewer +
 * .glb into a docs preview, so this just shows what visitors see before they
 * click. Renders nothing at all on the live page if no model is uploaded.
 */
function Model3DPreview() {
  return (
    <div className="saeh-section saeh-3d-cta">
      <svg className="saeh-3d-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2.5 21 7v10l-9 4.5L3 17V7z" />
        <path d="M3 7l9 4.5L21 7M12 11.5V21" />
      </svg>
      <div className="saeh-3d-cta-title">View the product in 3D view!</div>
      <span className="saeh-btn">View 3D Mode</span>
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
      key: "3d-viewer",
      name: "3D Model Viewer",
      description: "A CTA card that opens a full-screen 3D viewer modal (rotate/zoom, AR, spin toggle, reset). Renders nothing if the product has no model uploaded.",
      section: "3d-viewer",
      preview: <Model3DPreview />,
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
          <Model3DPreview />
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
