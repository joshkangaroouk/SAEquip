import { isRouteErrorResponse, useNavigate, useRouteError } from "react-router-dom";
import { Alert, Button, PageHeader } from "./ui";

/**
 * Route-level error boundary.
 *
 * ⚠️ Without one, a single render-time throw blanks the ENTIRE dashboard —
 * React Router's default fallback is a bare "Unexpected Application Error!"
 * screen with no navigation, so one bad row makes every page unreachable.
 * That is not hypothetical: `p.sku.toLowerCase()` on a product whose SKU was
 * null did exactly that, and the class of bug behind it is structural — a
 * frontend interface in `lib/types.ts` is a *claim* about a payload that
 * TypeScript cannot check against the route producing it, so a nullability
 * drift shows up first at runtime, in the browser.
 *
 * Attached to the authenticated layout route, so the sidebar and top bar
 * survive (the breadcrumb still names the page) and the failure is scoped to
 * the page that threw. Drawn like any page: the header band, then the error.
 */
export function RouteError() {
  const error = useRouteError();
  const navigate = useNavigate();

  const summary = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : "Something went wrong rendering this page.";
  const stack = error instanceof Error ? error.stack : undefined;

  return (
    <>
      <PageHeader
        title="This page hit an error"
        description="The rest of the dashboard is still working — use the sidebar, or try again."
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate("/")}>
              Back to products
            </Button>
            <Button onClick={() => navigate(0)}>Reload this page</Button>
          </>
        }
      />

      <Alert tone="danger">{summary}</Alert>

      {stack && (
        <details className="mt-5">
          <summary className="t-label cursor-pointer hover:text-text">Technical detail (useful when reporting this)</summary>
          <pre className="t-code-sm mt-2 max-h-64 overflow-auto border border-border bg-surface-2 p-3 text-muted">{stack}</pre>
        </details>
      )}
    </>
  );
}
