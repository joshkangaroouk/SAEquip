import { Fragment, useState } from "react";
import { Badge, Card } from "../components/ui";

/**
 * The embeddable widget's own production CSS (verbatim from
 * backend/src/public-widget/widget.js → injectStyles), reused here so every
 * preview below is a byte-accurate match for what actually renders on Duda.
 */
const WIDGET_CSS = `
.saeh-root,.saeh-3d-overlay{--saeh-head:'Barlow','Barlow Fallback',system-ui,sans-serif;--saeh-body:'Inter','Inter Fallback',system-ui,sans-serif}
.saeh-root{font-family:var(--saeh-body);font-size:16px;color:#1a1a1a;max-width:920px;margin:0;line-height:1.5;box-sizing:border-box}
.saeh-root *{box-sizing:border-box}
.saeh-root.saeh-wide{max-width:none}
.saeh-section{margin:0}
.saeh-section + .saeh-section{margin-top:22px}
.saeh-h{font-family:var(--saeh-head);font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#111;margin:0 0 12px;border-left:4px solid #ffd200;padding-left:10px}
.saeh-logos{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.saeh-logos img{height:35px;width:auto;flex:0 0 auto;display:block}
.saeh-tabs{border:1px solid #ececec;border-radius:10px;overflow:hidden}
.saeh-tab-h{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;box-sizing:border-box;margin:0;font-family:var(--saeh-head);text-align:left;background:#fafafa;border:0;border-top:1px solid #ececec;padding:14px 16px;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#111;cursor:pointer}
.saeh-tab-h:first-child{border-top:0}
.saeh-tab-h:hover{background:#f2f2f2}
.saeh-tab-h[aria-expanded='true']{background:#fff}
.saeh-tab-h:after{content:'';flex:0 0 auto;width:8px;height:8px;border-right:2px solid #111;border-bottom:2px solid #111;transform:rotate(45deg);margin-top:-4px;transition:transform .15s ease}
.saeh-tab-h[aria-expanded='true']:after{transform:rotate(225deg);margin-top:2px}
.saeh-tab-h:focus-visible{outline:2px solid #111;outline-offset:-2px}
.saeh-tab-p{padding:18px 16px;background:#fff;border-top:1px solid #ececec}
.saeh-prose{font-size:15px;font-weight:400;color:#878787}
.saeh-prose p{margin:0}
.saeh-prose p + p{margin-top:12px}
.saeh-prose ul,.saeh-prose ol{margin:12px 0;padding-left:22px}
.saeh-prose h4,.saeh-prose h5,.saeh-prose h6{font-family:var(--saeh-head);margin:14px 0 6px;font-size:16px;font-weight:700}
.saeh-prose a{color:inherit;text-decoration:underline}
.saeh-prose hr{border:0;border-top:1px solid #ececec;margin:16px 0}
.saeh-prose > *:first-child{margin-top:0}
.saeh-prose > *:last-child{margin-bottom:0}
.saeh-table{width:100%;border-collapse:collapse;font-size:15px;font-weight:400;font-style:normal;color:#878787}
.saeh-table td{padding:9px 12px;border-bottom:1px solid #ececec;vertical-align:top}
.saeh-table tr.saeh-alt{background:#fafafa}
.saeh-table td.saeh-label{font-weight:600;width:40%;color:#111}
.saeh-table tr.saeh-sub td.saeh-label{width:auto;color:#111;font-weight:700;letter-spacing:.02em}
.saeh-list{list-style:none;padding:0;margin:0}
.saeh-list li{position:relative;padding:5px 0 5px 26px;font-size:15px;font-weight:400;font-style:normal;color:#878787}
.saeh-check li:before{content:'';position:absolute;left:0;top:6px;width:17px;height:17px;border-radius:50%;background:#ffd200 url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23111' stroke-width='3.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 6 9 17l-5-5'/%3E%3C/svg%3E") center/11px 11px no-repeat}
.saeh-dl{display:flex;flex-wrap:wrap;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #ececec}
.saeh-dl:last-child{border-bottom:0}
.saeh-dl-title{flex:1 1 auto;font-size:16px;font-weight:400;font-style:normal;min-width:140px}
.saeh-btn{display:inline-block;font-family:var(--saeh-head);background:#111;color:#fff;border:none;border-radius:5px;padding:9px 18px;font-size:15px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;cursor:pointer;text-decoration:none;line-height:1.2}
.saeh-btn:hover{background:#333}
.saeh-btn:disabled{opacity:.6;cursor:default}
.saeh-form{flex-basis:100%;display:none;flex-wrap:wrap;gap:8px;margin-top:10px;padding:14px;background:#f7f7f7;border-radius:8px}
.saeh-form.saeh-open{display:flex}
.saeh-in{flex:1 1 180px;font-family:var(--saeh-body);padding:9px;border:1px solid #ccc;border-radius:5px;font-size:16px;font-weight:400;font-style:normal}
.saeh-hp{position:absolute!important;left:-9999px!important;width:1px;height:1px;opacity:0}
.saeh-msg{flex-basis:100%;font-size:16px;font-weight:400;font-style:normal;margin-top:2px}
.saeh-ok{color:#137333}
.saeh-err{color:#c5221f}
.saeh-3d-cta{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:18px 24px;background:#eceef1;padding:24px 26px}
.saeh-3d-cta-main{display:flex;align-items:center;gap:16px;flex:1 1 260px;min-width:0}
.saeh-3d-icon{width:34px;height:34px;color:#111;display:block;flex:0 0 auto}
.saeh-3d-cta-title{font-family:var(--saeh-head);font-size:20px;font-weight:500;line-height:1.25;color:#111;margin:0;min-width:0;overflow-wrap:break-word}
.saeh-3d-btn{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;gap:10px;font-family:var(--saeh-body);background:#fed217;color:#000;border:0;border-radius:0;padding:12px 22px;min-height:44px;font-size:16px;font-weight:500;text-transform:none;letter-spacing:normal;line-height:1.25;cursor:pointer}
.saeh-3d-btn-icon{width:20px;height:20px;flex:0 0 auto;display:block}
.saeh-3d-btn:hover{background:#f0c400}
.saeh-3d-btn:focus-visible{outline:2px solid #111;outline-offset:2px}
.saeh-cp-sec{padding:8% 0}
@media(min-width:561px){.saeh-cp-sec{padding:6% 0}
}
@media(min-width:881px){.saeh-cp-sec{padding:3% 0}
}
.saeh-cp-h{font-family:var(--saeh-head);font-size:20px;font-weight:600;color:#111;text-align:center;margin:0 0 20px;line-height:1.25}
.saeh-cp{display:flex;align-items:center;gap:14px}
.saeh-cp-track{flex:1;min-width:0;display:flex;gap:16px;overflow-x:auto;scroll-snap-type:x mandatory;scroll-behavior:smooth;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding:2px}
.saeh-cp-track{justify-content:safe center}
.saeh-cp-track::-webkit-scrollbar{display:none}
.saeh-cp-card{flex:0 0 100%;scroll-snap-align:start;display:flex;flex-direction:column;background:#fff;border:1px solid #ececec;text-decoration:none;color:inherit}
.saeh-cp-shot{aspect-ratio:1/1;display:flex;align-items:center;justify-content:center;background:#fff;overflow:hidden}
.saeh-cp-shot img{max-width:100%;max-height:100%;width:auto;height:auto;display:block}
.saeh-cp-body{padding:14px;display:flex;flex-direction:column;gap:12px;align-items:center;text-align:center;flex:1}
.saeh-cp-name{font-family:var(--saeh-head);font-size:14px;font-weight:600;text-transform:uppercase;letter-spacing:.03em;color:#111;line-height:1.3}
.saeh-cp-btn{margin-top:auto;font-family:var(--saeh-body);background:#fed217;color:#000;border:0;padding:10px 18px;min-height:40px;font-size:14px;font-weight:500;line-height:1.2;display:inline-flex;align-items:center;gap:8px}
.saeh-cp-btn img{width:16px;height:16px;display:block;flex:0 0 auto}
.saeh-cp-card:hover .saeh-cp-btn{background:#f0c400}
.saeh-cp-nav{flex:0 0 auto;width:40px;height:40px;border-radius:50%;border:1px solid #111;background:#fff;color:#111;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;transition:background .15s ease,border-color .15s ease,color .15s ease}
.saeh-cp-nav:hover:not([disabled]){background:#fed217;border-color:#fed217;color:#000}
.saeh-cp-nav:focus-visible{outline:2px solid #111;outline-offset:2px}
.saeh-cp-nav[disabled]{border-color:#d8d8d8;color:#bdbdbd;cursor:default}
.saeh-cp-nav svg{width:15px;height:15px}
@media(max-width:560px){.saeh-cp{flex-wrap:wrap;justify-content:center;gap:14px 12px}
.saeh-cp-track{order:1;flex:0 0 100%}
.saeh-cp-prev{order:2}
.saeh-cp-next{order:3}
}
@media(min-width:561px){.saeh-cp-card{flex-basis:calc((100% - 32px) / 3)}
}
@media(min-width:881px){.saeh-cp-card{flex-basis:calc((100% - 48px) / 4)}
}
.saeh-3d-overlay{position:fixed;inset:0;z-index:999999;background:rgba(17,17,17,.72);display:flex;font-family:var(--saeh-body)}
.saeh-3d-sheet{position:relative;margin:40px;flex:1;min-width:0;background:#fff;border-radius:10px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.4)}
.saeh-3d-close{position:absolute;top:14px;right:14px;z-index:2;width:36px;height:36px;border-radius:50%;border:none;background:rgba(17,17,17,.06);color:#111;font-family:var(--saeh-head);font-size:15px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0}
.saeh-3d-close:hover{background:rgba(17,17,17,.12)}
.saeh-3d-stage{flex:1;min-height:0;background:#f4f4f5}
.saeh-3d-mv{width:100%;height:100%;display:block;--poster-color:transparent;outline:none}
.saeh-3d-bar{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;padding:14px;border-top:1px solid #ececec;flex-shrink:0}
@media(max-width:520px){.saeh-table td.saeh-label{width:auto}
.saeh-dl{align-items:flex-start}
.saeh-3d-sheet{margin:16px}
.saeh-3d-cta{padding:20px 18px;gap:16px}
.saeh-3d-cta-main{flex-basis:100%}
.saeh-3d-btn{flex:1 1 100%;width:100%}
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

// ---- example content — mirrors the shape of GET /public/products/content ----
const DUMMY = {
  saLogos: ["SA Rental", "SA Lumin", "SA Flexiheat", "SA Endure"],
  certLogos: ["ATEX", "UKEX", "IECEx"],
  // All three spec row kinds, so the preview shows what a real imported table
  // looks like rather than only the simple case.
  specs: [
    { label: "Certification", value: "Ex II 2 G D" },
    { label: "", value: "Ex db eb ib mb pb IIB T4 Gb" },
    { label: "", value: "db ib mb tb pb IIIC T135°C Db" },
    { label: "Free Airflow", value: "690m³/h (406cfm) @ 50Hz" },
    { label: "Operating Temperature", value: "-20°C to +50°C" },
    { label: "Ingress Protection", value: "IP65" },
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
  compatible: [
    { name: "Trolley for EX Heater", image: placeholderLogo("trolley") },
    { name: "Antistatic Reinforced Ducting", image: placeholderLogo("ducting") },
    { name: "Duct Couplers", image: placeholderLogo("couplers") },
    { name: "EX Air Mover", image: placeholderLogo("air mover") },
    { name: "Manway Adaptor", image: placeholderLogo("adaptor") },
  ],
  description:
    "<p>A highly capable portable air heater suitable for use in the harshest conditions, offering robust and powerful performance.</p><p>Fully certified for Hazardous Area Zones 1 and 2, and exceptionally simple to operate.</p>",
};

function LogoPreview({ labels }: { labels: string[] }) {
  return (
    <div className="saeh-section">
      <div className="saeh-logos">
        {labels.map((l) => (
          <img key={l} src={placeholderLogo(l)} alt={l} />
        ))}
      </div>
    </div>
  );
}

/**
 * Mirrors specsTable() in widget.js, including the three row kinds — a plain
 * spec, a sub-heading (label, no value) and continuation lines (blank label).
 * Striping is per GROUP, set here as it is there, which is why the widget's
 * CSS uses `.saeh-alt` and not `tr:nth-child(even)`.
 */
function SpecsTablePreview() {
  let group = -1;
  return (
    <table className="saeh-table">
      <tbody>
        {DUMMY.specs.map((s, i) => {
          const cont = !s.label;
          if (!cont) group += 1;
          const alt = group % 2 === 1 ? " saeh-alt" : "";
          const sub = !cont && !s.value;
          const cls = `${sub ? "saeh-sub" : cont ? "saeh-cont" : ""}${alt}`.trim();
          return (
            <tr key={i} className={cls || undefined}>
              <td className="saeh-label">{s.label}</td>
              <td>{s.value}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/**
 * Mirrors compatibleSection() in widget.js. Static here — the live arrows
 * appear only when the track actually overflows, which is measured from
 * rendered width, so a preview can't meaningfully show that.
 */
function CompatiblePreview() {
  return (
    <div className="saeh-section saeh-cp-sec">
      <h3 className="saeh-cp-h">Compatible Products &amp; Accessories</h3>
      <div className="saeh-cp">
        {/* Static: the live arrows appear only while the track overflows,
            which is measured from rendered width. Shown here in both states
            so the styling is visible. */}
        <button type="button" className="saeh-cp-nav" disabled aria-label="Previous products">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5 8 12l7 7" />
          </svg>
        </button>
        <div className="saeh-cp-track">
          {DUMMY.compatible.map((c) => (
            <span key={c.name} className="saeh-cp-card">
              <span className="saeh-cp-shot">
                <img src={c.image} alt={c.name} />
              </span>
              <span className="saeh-cp-body">
                <span className="saeh-cp-name">{c.name}</span>
                <span className="saeh-cp-btn">
                  <span>VIEW PRODUCT</span>
                </span>
              </span>
            </span>
          ))}
        </div>
        <button type="button" className="saeh-cp-nav" aria-label="Next products">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function ListPreview({ items }: { items: string[] }) {
  return (
    <ul className="saeh-list saeh-check">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

/**
 * The tabbed accordion, live — clicking a tab really switches panels, so the
 * preview behaves as the product page does.
 *
 * Mirrors tabsSection() in widget.js: one set of buttons serves both layouts,
 * with the disclosure pattern (aria-expanded + aria-controls) rather than tab
 * roles, and `hidden` rather than a class on the closed panels.
 */
function TabsPreview() {
  const [open, setOpen] = useState(0);
  const panels = [
    {
      id: "overview",
      label: "Overview",
      body: <div className="saeh-prose" dangerouslySetInnerHTML={{ __html: DUMMY.description }} />,
    },
    { id: "specs", label: "Technical Specs", body: <SpecsTablePreview /> },
    { id: "benefits", label: "Key Benefits", body: <ListPreview items={DUMMY.benefits} /> },
    { id: "applications", label: "Applications", body: <ListPreview items={DUMMY.applications} /> },
  ];

  return (
    <div className="saeh-section">
      <div className="saeh-tabs">
        {panels.map((p, i) => (
          <Fragment key={p.id}>
            <button
              type="button"
              className="saeh-tab-h"
              id={`prev-${p.id}-h`}
              aria-expanded={i === open}
              aria-controls={`prev-${p.id}`}
              onClick={() => setOpen(i)}
            >
              <span>{p.label}</span>
            </button>
            <div
              className="saeh-tab-p"
              id={`prev-${p.id}`}
              role="region"
              aria-labelledby={`prev-${p.id}-h`}
              hidden={i !== open}
            >
              {p.body}
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

/**
 * Mirrors model3dSection() in widget.js. The cube path is a hand-maintained
 * duplicate of CUBE_ICON_PATH — `widget:test` compares the two strings and
 * fails on drift, since unlike the CSS there is no generator for it.
 */
function Model3DPreview() {
  return (
    <div className="saeh-section saeh-3d-cta">
      <div className="saeh-3d-cta-main">
        <svg
          className="saeh-3d-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 2.75L20.5 7.375V16.625L12 21.25L3.5 16.625V7.375ZM3.5 7.375L12 12L20.5 7.375M12 12V21.25" />
        </svg>
        <div className="saeh-3d-cta-title">View the product in 3D Mode!</div>
      </div>
      <span className="saeh-3d-btn">
        <span>View 3D Mode</span>
        <img
          className="saeh-3d-btn-icon"
          src="https://irp.cdn-website.com/8a8f03b5/icon/chevron+right_8187511.svg"
          alt=""
          aria-hidden="true"
          width={20}
          height={20}
        />
      </span>
    </div>
  );
}

/**
 * The four Duda widgets, in the order they appear down a product page.
 *
 * `section` is the string in each widget's JS inside Duda — the one value that
 * decides what a widget renders. It is shown because a widget displaying
 * another widget's content means that string is wrong, and this is the
 * reference for checking it.
 */
const WIDGETS = [
  {
    section: "sa-logos",
    name: "SA Logos",
    what: "The SA range logos ticked on this product.",
    source: "Logos page → SA logos, then ticked per product in the product editor.",
    preview: <LogoPreview labels={DUMMY.saLogos} />,
  },
  {
    section: "cert-logos",
    name: "SA Cert Logos",
    what: "The certification logos ticked on this product.",
    source: "Logos page → certification logos, then ticked per product.",
    preview: <LogoPreview labels={DUMMY.certLogos} />,
  },
  {
    section: "tabs",
    name: "SA Tabbed Accordion",
    what: "The main product widget: Overview, Technical Specs, Key Benefits and Applications. Tabs on desktop, an accordion on mobile.",
    source: "Description, Technical Specs, Key Benefits and Applications in the product editor.",
    preview: <TabsPreview />,
  },
  {
    section: "compatible",
    name: "SA Compatible Products",
    what: "A carousel of products and accessories that go with this one — 4 across on desktop, 3 on tablet, 2 on mobile. Arrows appear only when there is more than fits.",
    source: "Compatible Products in the product editor.",
    preview: <CompatiblePreview />,
  },
  {
    section: "3d-viewer",
    name: "SA 3D Model",
    what: "A banner that opens a full-screen 3D viewer — rotate, zoom, AR and a spin toggle.",
    source: "3D Model in the product editor (one .glb per product).",
    preview: <Model3DPreview />,
  },
];

export default function Widgets() {
  return (
    <>
      <style>{WIDGET_CSS}</style>

      <h1 className="text-xl font-semibold text-text">Widgets</h1>
      <p className="mt-1 text-sm text-muted">
        The five widgets on the live product page. Each one shows content you enter here in the Hub.
      </p>

      <Card className="mt-6">
        <h2 className="text-body font-semibold text-text">How it works</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-muted">
          <li>
            All five are already built and placed on the Duda product template. Nothing needs pasting or
            configuring here — edit a product and the widgets follow.
          </li>
          <li>
            They each know which product to show because they read it from the page they are on, so one setup
            covers every product.
          </li>
          <li>
            <strong className="font-semibold text-text">Empty content disappears.</strong> A widget with
            nothing to show hides itself completely, and an accordion tab with no content is not created at
            all — so a product without specs simply has no Technical Specs tab, rather than an empty one.
          </li>
          <li>The previews below are the real widget styling, so they match the live page.</li>
        </ul>
      </Card>

      <div className="mt-6 space-y-6">
        {WIDGETS.map((w) => (
          <Card key={w.section}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-body font-semibold text-text">{w.name}</h2>
              <Badge tone="neutral">{w.section}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted">{w.what}</p>
            <p className="mt-1 text-xs text-subtle">
              <span className="font-semibold">Comes from:</span> {w.source}
            </p>

            <div className="mt-4 rounded-lg border border-border bg-white p-4">{w.preview}</div>
          </Card>
        ))}
      </div>
    </>
  );
}
