import { useEffect, useState } from "react";
import { ExternalLink, Globe } from "lucide-react";
import { Badge, Button, Card, EmptyState, Loader, PageHeader, toast } from "../components/ui";
import { apiJson } from "../lib/api";

interface EditableSite {
  siteName: string;
  domain: string | null;
  siteUrl: string | null;
  thumbnailUrl: string | null;
  publishStatus: string | null;
  lastPublished: string | null;
  grantedPermissions: string[];
}

interface SitesResponse {
  hasAccess: boolean;
  dudaAccountName?: string;
  sites: EditableSite[];
}

function publishTone(status: string | null): "success" | "neutral" {
  return status === "PUBLISHED" ? "success" : "neutral";
}

function publishLabel(status: string | null): string {
  if (!status) return "Unknown";
  return status === "NOT_PUBLISHED_YET" ? "Not published" : status.charAt(0) + status.slice(1).toLowerCase();
}

/**
 * Homepage screenshot from Duda's CDN — the same image Duda shows in its own
 * site list.
 *
 * Duda captures the FULL page, so the source image is very tall. Cropping a
 * fixed 200x160 tile from the top (object-top) shows the above-the-fold hero,
 * which reads as a browser viewport rather than a squashed whole-page image.
 *
 * Falls back to a neutral tile if the screenshot 404s (a site Duda hasn't
 * captured yet) rather than showing a broken-image icon.
 */
function SiteThumbnail({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="h-[160px] w-[200px] shrink-0 overflow-hidden rounded-md border border-border bg-surface-2">
      {src && !failed ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover object-top"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Globe size={28} className="text-subtle" />
        </div>
      )}
    </div>
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

      {loading && <Loader label="Checking your website access…" />}

      {error && (
        <div className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-body text-danger">
          {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          {!data.hasAccess || data.sites.length === 0 ? (
            <Card className="mt-4">
              <EmptyState
                title="No editor access yet"
                description="Your account isn't set up to edit the website. Ask Kangaroo to enable editor access for you."
              />
            </Card>
          ) : (
            <div className="mt-4 space-y-4">
              {data.sites.map((site) => (
                <Card key={site.siteName}>
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                    <SiteThumbnail src={site.thumbnailUrl} alt="SAEquip homepage" />

                    <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-h3 font-semibold text-text">SAEquip</h2>
                          <Badge tone={publishTone(site.publishStatus)}>
                            {publishLabel(site.publishStatus)}
                          </Badge>
                        </div>

                        {site.siteUrl ? (
                          <a
                            href={site.siteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 inline-flex items-center gap-1.5 text-body text-muted underline underline-offset-2 hover:text-text"
                          >
                            {site.domain ?? site.siteUrl}
                            <ExternalLink size={13} className="shrink-0" />
                          </a>
                        ) : (
                          <p className="mt-1 text-body text-muted">{site.siteName}</p>
                        )}

                        <p className="mt-1 text-small text-subtle">
                          Site ID: {site.siteName}
                          {site.lastPublished && (
                            <> · Last published {new Date(site.lastPublished).toLocaleDateString()}</>
                          )}
                        </p>
                      </div>

                      <Button
                        onClick={() => void openEditor(site.siteName)}
                        loading={opening === site.siteName}
                        disabled={opening !== null}
                      >
                        Edit Website
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}

              <p className="text-small text-subtle">
                You'll be signed into Duda as {data.dudaAccountName}. Product content is managed
                here in the Hub, not in Duda's store.
              </p>
            </div>
          )}
        </>
      )}
    </>
  );
}
