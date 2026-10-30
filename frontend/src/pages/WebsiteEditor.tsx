import { useEffect, useState } from "react";
import { ExternalLink, Globe } from "lucide-react";
import { Alert, Badge, Button, ButtonLink, Card, EmptyState, Loader, PageHeader, toast } from "../components/ui";
import { apiJson } from "../lib/api";
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
 * Homepage preview: Duda's screenshot, the same image Duda shows in its own
 * site list, on --paper.
 *
 * Duda captures the FULL page, so the source image is very tall. Cropping from
 * the top (object-top) shows the above-the-fold hero, which reads as a browser
 * viewport rather than a squashed whole-page image.
 *
 * Falls back to a neutral tile if the screenshot 404s (a site Duda hasn't
 * captured yet) rather than showing a broken-image icon.
 */
function HomepagePreview({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="aspect-[16/9] max-h-[420px] w-full overflow-hidden border border-border bg-surface-2">
      {src && !failed ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full bg-paper object-cover object-top"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Globe size={32} className="text-muted" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}

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
 * "English only", or "English + 6" with the others named beneath. As set up
 * in Duda: a language paused there still counts, since Duda's API lists it.
 */
function SiteLanguages({ lang, others }: { lang: string | null; others: string[] }) {
  if (!lang) return <NotAvailable />;
  // "en-gb" → "English": the site's own language, not its region.
  const base = languageName(lang.split("-")[0]);
  if (others.length === 0) return <>{base} only</>;
  return (
    <>
      {base} + {others.length}
      <span className="t-help mt-0.5 block">{others.map(languageName).join(", ")}</span>
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
        title="Website editor"
        description="Open the SAEquip website in Duda's editor to change pages, content and layout."
      />

      {loading && <Loader label="Checking your website access…" />}

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
                <Card key={site.siteName} padded={false}>
                  {/* Header row: the site, its publish state, and the two ways out — primary last. */}
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-5 py-4">
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

                  <div className="p-5">
                    <HomepagePreview src={site.thumbnailUrl} alt="SAEquip homepage" />
                  </div>

                  {/*
                    The site status grid (00), from the one Duda site read the
                    sites route already makes (02a Q21).
                  */}
                  <dl className="grid grid-cols-1 border-t border-border sm:grid-cols-3">
                    <div className="px-5 py-4">
                      <dt className="t-label">Search engines</dt>
                      <dd className="mt-1 text-body text-text">
                        {/* Hidden while "No index for the entire site" is on (CLAUDE.md, launch checklist). */}
                        {site.noIndex === null ? <NotAvailable /> : site.noIndex ? "Hidden" : "Visible"}
                      </dd>
                    </div>
                    <div className="border-t border-border px-5 py-4 sm:border-l sm:border-t-0">
                      <dt className="t-label">Languages</dt>
                      <dd className="mt-1 text-body text-text">
                        <SiteLanguages lang={site.lang} others={site.additionalLanguages} />
                      </dd>
                    </div>
                    <div className="border-t border-border px-5 py-4 sm:border-l sm:border-t-0">
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
