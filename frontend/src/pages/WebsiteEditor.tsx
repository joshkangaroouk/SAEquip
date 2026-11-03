import { useEffect, useState } from "react";
import { ExternalLink, Globe } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  PageHeader,
  Skeleton,
  SkeletonLine,
  toast,
} from "../components/ui";
import { apiJson } from "../lib/api";
import { cn } from "../lib/cn";
import { languageName } from "../lib/language";

interface EditableSite {
  siteName: string;
  domain: string | null;
  siteUrl: string | null;
  thumbnailUrl: string | null;
  publishStatus: string | null;
  lastPublished: string | null;
  grantedPermissions: string[];
  /** Duda's "No index for the entire site"; null when the site read failed. */
  noIndex: boolean | null;
  /** The default language ("en-gb"); null when the site read failed. */
  lang: string | null;
  /** The other languages set up in Duda ("ar", "fr", …). */
  additionalLanguages: string[];
}

interface SitesResponse {
  hasAccess: boolean;
  dudaAccountName?: string;
  sites: EditableSite[];
}

function publishTone(status: string | null): "ok" | "neutral" {
  return status === "PUBLISHED" ? "ok" : "neutral";
}

function publishLabel(status: string | null): string {
  if (!status) return "Unknown";
  return status === "NOT_PUBLISHED_YET" ? "Not published" : status.charAt(0) + status.slice(1).toLowerCase();
}

/**
 * Duda's screenshot as it is now: 400×556 (measured 2026-11-03). The preview
 * reserves this box until the image loads, so the page does not move when it
 * does; a different size from Duda takes its own box on load.
 */
const SCREENSHOT = { w: 400, h: 556 };

/**
 * Homepage preview: Duda's screenshot, the same image Duda shows in its own
 * site list, on --paper with a 1px border (12.12).
 *
 * ⚠️ Never larger than the image itself: Duda's is only 400px wide, and a
 * full-width 16:9 box blew it up about 2.6×. On load it takes the image's
 * natural size, 1:1 in CSS px (aspect-ratio from naturalWidth/Height,
 * width capped at naturalWidth), and shrinks only to fit a narrower column.
 * Until then a Skeleton fills the reserved box.
 *
 * Falls back to a neutral tile if the screenshot 404s (a site Duda hasn't
 * captured yet) rather than showing a broken-image icon.
 */
function HomepagePreview({ src, alt }: { src: string | null; alt: string }) {
  const [state, setState] = useState<"loading" | "loaded" | "failed">(src ? "loading" : "failed");
  const [size, setSize] = useState(SCREENSHOT);
  useEffect(() => {
    setState(src ? "loading" : "failed");
  }, [src]);
  return (
    // The border sits outside the picture, so the picture itself is the
    // natural width: the frame is 2px wider.
    <div className="max-w-full border border-border bg-paper" style={{ width: size.w + 2 }}>
      <div className="relative w-full" style={{ aspectRatio: `${size.w} / ${size.h}` }}>
        {src && state !== "failed" && (
          <img
            src={src}
            alt={alt}
            onLoad={(e) => {
              const img = e.currentTarget;
              if (img.naturalWidth && img.naturalHeight) setSize({ w: img.naturalWidth, h: img.naturalHeight });
              setState("loaded");
            }}
            onError={() => setState("failed")}
            className={cn("absolute inset-0 h-full w-full", state !== "loaded" && "invisible")}
          />
        )}
        {state === "loading" && <Skeleton className="absolute inset-0" />}
        {state === "failed" && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-2">
            <Globe size={32} className="text-muted" aria-hidden="true" />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The page while the access check and the site read run (11 §1): the site's
 * card (its header and two buttons, the homepage preview's reserved box, the
 * status rows with their labels as themselves) and the note under it. One polite
 * announcement, as the old spinner made; the blocks are aria-hidden.
 */
function WebsiteSkeleton() {
  return (
    <div aria-busy="true">
      <p role="status" className="sr-only">
        Checking your website access
      </p>
      <div className="space-y-5" aria-hidden="true">
        {/* The site card's own grid (SITE_CARD) and parts, so each lands where it will. */}
        <Card padded={false} className={SITE_CARD}>
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-5 py-4 [grid-area:head] xl:flex-col xl:justify-start">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <SkeletonLine text="t-section" className="h-[0.8em] w-20" />
                <Skeleton className="h-6.5 w-20" />
              </div>
              <SkeletonLine text="t-help mt-1" className="h-[0.7em] w-64 max-w-full" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-10 w-[148px]" />
              <Skeleton className="h-10 w-[178px]" />
            </div>
          </div>
          <div className="p-5 [grid-area:preview] xl:border-r xl:border-border">
            {/* The preview's reserved box: Duda's screenshot size, with its 1px frame. */}
            <div className="max-w-full border border-border" style={{ width: SCREENSHOT.w + 2 }}>
              <div className="w-full" style={{ aspectRatio: `${SCREENSHOT.w} / ${SCREENSHOT.h}` }}>
                <Skeleton className="h-full w-full" />
              </div>
            </div>
          </div>
          <dl className="divide-y divide-border border-t border-border [grid-area:status] xl:border-t-0">
            {["Search engines", "Languages", "Address"].map((label) => (
              <div key={label} className="px-5 py-4">
                <dt className="t-label">{label}</dt>
                <dd className="mt-1">
                  <SkeletonLine text="text-body" className="h-[0.8em] w-40 max-w-full" />
                  {/* Languages, as SiteLanguages shows a site with more than one:
                      the list (two words' worth, so it wraps), and its note. */}
                  {label === "Languages" && (
                    <>
                      <div className="mt-0.5 text-help">
                        <Skeleton className="inline-block h-[0.7em] w-48 max-w-full align-middle" />{" "}
                        <Skeleton className="inline-block h-[0.7em] w-44 max-w-full align-middle" />
                      </div>
                      <p className="t-help mt-1">
                        Languages switched off in Duda still count here. Check the language menu in the Duda editor.
                      </p>
                    </>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
        <SkeletonLine text="t-help" className="h-[0.7em] w-[28rem] max-w-full" />
      </div>
    </div>
  );
}

/**
 * The site card's layout (12.12), shared with its skeleton. Below 1280 one
 * column: the header and buttons, the preview (left-aligned at its capped
 * size), then the status rows. From 1280 two: the preview on the left, as
 * wide as it is (and no wider than the column), and the header, buttons and
 * status rows on the right.
 *
 * ⚠️ The one column below 1280 is minmax(0, 1fr), not the implicit auto: an
 * auto track is as wide as the preview's own width, so the card ran off a
 * phone and a big screenshot never shrank to fit.
 */
const SITE_CARD =
  "grid grid-cols-[minmax(0,1fr)] [grid-template-areas:'head'_'preview'_'status'] xl:grid-cols-[minmax(0,max-content)_minmax(20rem,1fr)] xl:grid-rows-[auto_1fr] xl:[grid-template-areas:'preview_head'_'preview_status']";

/** A value Duda didn't return (the site read failed, or it has no domain). */
function NotAvailable() {
  return (
    <>
      <span aria-hidden="true" className="text-muted">
        —
      </span>
      <span className="sr-only">Not available</span>
    </>
  );
}

/**
 * "English only", or "English + 6 set up" with the others named beneath
 * (02a "After 6b"). Duda's API lists a language that is set up even while it
 * is switched off, so this never claims they are live, and does not try to
 * tell which are paused.
 */
function SiteLanguages({ lang, others }: { lang: string | null; others: string[] }) {
  if (!lang) return <NotAvailable />;
  // "en-gb" → "English": the site's own language, not its region.
  const base = languageName(lang.split("-")[0]);
  if (others.length === 0) return <>{base} only</>;
  return (
    <>
      {base} + {others.length} set up
      <span className="mt-0.5 block text-help text-text">{others.map(languageName).join(", ")}</span>
      <span className="t-help mt-1 block">
        Languages switched off in Duda still count here. Check the language menu in the Duda editor.
      </span>
    </>
  );
}

export default function WebsiteEditor() {
  const [data, setData] = useState<SitesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await apiJson<SitesResponse>("/api/website/sites");
        if (!cancelled) setData(res);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load your website access");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * The SSO URL only exists after an awaited request, so a window.open() in
   * the resolved promise sits outside the click's user-gesture call stack and
   * popup blockers eat it. So: claim a blank tab synchronously here, then point
   * it at the URL once minted. If the browser refused the popup, fall back to
   * navigating this tab.
   *
   * Do NOT put "noopener" in the features string: it makes window.open()
   * return null by design, which silently sent us down the fallback path —
   * navigating this tab AND leaving the blank one orphaned. The opener is
   * severed on the handle instead, just before navigating it.
   */
  async function openEditor(siteName: string) {
    if (opening) return;
    setOpening(siteName);
    const tab = window.open("about:blank", "_blank");
    try {
      const { url } = await apiJson<{ url: string }>("/api/website/sso", {
        method: "POST",
        body: JSON.stringify({ siteName }),
      });
      if (tab && !tab.closed) {
        tab.opener = null;
        tab.location.replace(url);
      } else {
        // Popup blocked (or the user closed the tab) — go in this tab instead.
        window.location.assign(url);
      }
    } catch (e) {
      if (tab && !tab.closed) tab.close();
      toast.error(e instanceof Error ? e.message : "Could not open the website editor");
    } finally {
      setOpening(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Website Editor"
        description="Open the SAEquip website in Duda's editor to change pages, content and layout."
      />

      {loading && <WebsiteSkeleton />}

      {error && <Alert tone="danger">{error}</Alert>}

      {!loading && !error && data && (
        <>
          {!data.hasAccess || data.sites.length === 0 ? (
            <EmptyState
              title="No editor access yet"
              description="Your account isn't set up to edit the website. Ask Kangaroo to enable editor access for you."
            />
          ) : (
            <div className="space-y-5">
              {data.sites.map((site) => (
                <Card key={site.siteName} padded={false} className={SITE_CARD}>
                  {/* The site, its publish state, and the two ways out — primary last. Beside the
                      preview from 1280, with the buttons under it; above it below 1280. */}
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-5 py-4 [grid-area:head] xl:flex-col xl:justify-start">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="t-section text-text">SAEquip</h2>
                        <Badge tone={publishTone(site.publishStatus)}>{publishLabel(site.publishStatus)}</Badge>
                      </div>
                      <p className="t-help mt-1">
                        Site ID <span className="t-code-sm">{site.siteName}</span>
                        {site.lastPublished && (
                          <> · Last published {new Date(site.lastPublished).toLocaleDateString()}</>
                        )}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {site.siteUrl && (
                        <ButtonLink href={site.siteUrl} target="_blank" rel="noopener noreferrer">
                          View live site
                          <ExternalLink size={16} aria-hidden="true" />
                          <span className="sr-only">(opens in a new tab)</span>
                        </ButtonLink>
                      )}
                      {/* openEditor claims its tab synchronously in this click — keep it the first thing it does. */}
                      <Button
                        onClick={() => void openEditor(site.siteName)}
                        loading={opening === site.siteName}
                        disabled={opening !== null}
                      >
                        Open in Duda editor
                      </Button>
                    </div>
                  </div>

                  <div className="p-5 [grid-area:preview] xl:border-r xl:border-border">
                    <HomepagePreview src={site.thumbnailUrl} alt="SAEquip homepage" />
                  </div>

                  {/*
                    The site status (00), from the one Duda site read the
                    sites route already makes (02a Q21): stacked rows (12.12).
                  */}
                  <dl className="divide-y divide-border border-t border-border [grid-area:status] xl:border-t-0">
                    <div className="px-5 py-4">
                      <dt className="t-label">Search engines</dt>
                      <dd className="mt-1 text-body text-text">
                        {/* Hidden while "No index for the entire site" is on (CLAUDE.md, launch checklist). */}
                        {site.noIndex === null ? <NotAvailable /> : site.noIndex ? "Hidden" : "Visible"}
                      </dd>
                    </div>
                    <div className="px-5 py-4">
                      <dt className="t-label">Languages</dt>
                      <dd className="mt-1 text-body text-text">
                        <SiteLanguages lang={site.lang} others={site.additionalLanguages} />
                      </dd>
                    </div>
                    <div className="px-5 py-4">
                      <dt className="t-label">Address</dt>
                      <dd className="mt-1 min-w-0 truncate text-body text-text">
                        {site.domain ? (
                          site.siteUrl ? (
                            <a
                              href={site.siteUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline-offset-2 hover:underline"
                            >
                              {site.domain}
                            </a>
                          ) : (
                            site.domain
                          )
                        ) : (
                          <NotAvailable />
                        )}
                      </dd>
                    </div>
                  </dl>
                </Card>
              ))}

              <p className="t-help">
                You'll be signed into Duda as {data.dudaAccountName}. Product content is managed here in the Hub, not
                in Duda's store.
              </p>
            </div>
          )}
        </>
      )}
    </>
  );
}
