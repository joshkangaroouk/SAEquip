import { isRouteErrorResponse, useNavigate, useRouteError } from "react-router-dom";
import { Button, Card } from "./ui";

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
 * Attached to the authenticated layout route, so the sidebar survives and the
 * failure is scoped to the page that threw.
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
    <Card>
      <h1 className="text-h2 font-semibold text-text">This page hit an error</h1>
      <p className="mt-2 text-sm text-muted">
        The rest of the dashboard is still working — use the sidebar, or try again.
      </p>

      <p className="mt-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2.5 text-small text-danger">
        {summary}
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button onClick={() => navigate(0)}>Reload this page</Button>
        <Button variant="secondary" onClick={() => navigate("/")}>
          Back to Products
        </Button>
      </div>

      {stack && (
        <details className="mt-5">
          <summary className="cursor-pointer text-xs text-muted hover:text-text">
            Technical detail (useful when reporting this)
          </summary>
          <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-surface-2 p-3 text-xs text-muted">
            {stack}
          </pre>
        </details>
      )}
    </Card>
  );
}
