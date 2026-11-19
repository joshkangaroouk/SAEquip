/**
 * The activity log's catalogue: what every changing route of the API means.
 *
 * ⚠️ EVERY non-GET route under /api needs an entry here, a real one or a
 * `skip` with its reason. `npm run activity:test` walks the real app and fails
 * on any route without one, which is what keeps "every action is logged" true
 * as routes are added. A route that slips through anyway is still logged, as
 * `action: "unknown"` with its method and path, never silently dropped.
 *
 * Keys are `METHOD /full/path` exactly as Express declares them (route params
 * included, no trailing slash). The label is the default summary, used when a
 * route adds no wording of its own, and the filter's name for the action.
 *
 * /public is not here: website visitors are not logged (Josh, 2026-11-18), and
 * the activity middleware is mounted on /api only.
 */

export type ActivityCategory =
  | "security"
  | "products"
  | "categories"
  | "options"
  | "media"
  | "logos"
  | "translations"
  | "enquiries"
  | "users"
  | "website"
  | "activity";

/** The filter's names, in the order the page lists them. */
export const CATEGORY_LABELS: Record<ActivityCategory, string> = {
  security: "Sign-ins & security",
  products: "Products",
  categories: "Categories",
  options: "Product options",
  media: "Media",
  logos: "Logos",
  translations: "Translations",
  enquiries: "Enquiries",
  users: "Users & access",
  website: "Website",
  activity: "Activity log",
};

export type TargetType =
  | "product"
  | "category"
  | "option"
  | "media"
  | "logo"
  | "download"
  | "quote"
  | "resource_request"
  | "user"
  | "invite"
  | "site";

export type CatalogueEntry =
  | {
      action: string;
      category: ActivityCategory;
      label: string;
      /** The route param that names the target, when the path carries one. */
      target?: { type: TargetType; param?: string };
    }
  | { skip: string };

const product = (action: string, label: string, param = "id"): CatalogueEntry => ({
  action,
  category: "products",
  label,
  target: { type: "product", param },
});

export const ROUTE_CATALOGUE: Record<string, CatalogueEntry> = {
  // --- Products --------------------------------------------------------------
  "POST /api/products": { action: "product.create", category: "products", label: "Created a product", target: { type: "product" } },
  "DELETE /api/products/:id": product("product.delete", "Deleted a product"),
  "PATCH /api/products/:id": product("product.details.update", "Updated product details"),
  "PUT /api/products/:id/images": product("product.images.update", "Updated the images"),
  "PUT /api/products/:id/options": product("product.options.update", "Changed the options"),
  "PUT /api/products/:id/variations": product("product.variations.update", "Updated variations"),
  "PUT /api/products/:id/compatible": product("product.compatible.update", "Updated compatible products"),
  "PUT /api/products/:id/categories": product("product.categories.update", "Changed the categories"),
  "PUT /api/products/:id/accessory": product("product.accessory.update", "Changed the accessory setting"),
  "PUT /api/products/:id/model3d": product("product.model3d.update", "Changed the 3D model"),
  "PUT /api/products/:id/specs": product("product.specs.update", "Updated technical specs"),
  "PUT /api/products/:id/benefits": product("product.benefits.update", "Updated key benefits"),
  "PUT /api/products/:id/applications": product("product.applications.update", "Updated applications"),
  "PUT /api/products/:id/logos/:logoId": product("product.logo.on", "Switched a logo on"),
  "DELETE /api/products/:id/logos/:logoId": product("product.logo.off", "Switched a logo off"),
  "POST /api/products/:id/downloads": product("product.download.add", "Added a file"),
  "PUT /api/products/:id/downloads": product("product.downloads.update", "Updated files"),
  "PUT /api/products/:id/downloads/reorder": product("product.downloads.reorder", "Reordered files"),
  "PATCH /api/products/:id/downloads/:downloadId": product("product.download.update", "Edited a file"),
  "DELETE /api/products/:id/downloads/:downloadId": product("product.download.remove", "Removed a file"),
  "PUT /api/products/order": { action: "product.order", category: "products", label: "Changed the website order", target: { type: "product" } },
  "POST /api/products/export": { action: "product.export", category: "products", label: "Exported products to CSV" },

  // --- Categories ------------------------------------------------------------
  "POST /api/categories": { action: "category.create", category: "categories", label: "Created a category", target: { type: "category" } },
  "PATCH /api/categories/:id": { action: "category.update", category: "categories", label: "Edited a category", target: { type: "category", param: "id" } },
  "DELETE /api/categories/:id": { action: "category.delete", category: "categories", label: "Deleted a category", target: { type: "category", param: "id" } },
  "PUT /api/categories/reorder": { action: "category.reorder", category: "categories", label: "Reordered categories", target: { type: "category" } },
  "PUT /api/categories/:id/products": { action: "category.products.update", category: "categories", label: "Changed a category's products", target: { type: "category", param: "id" } },

  // --- Product options (Duda's store-wide catalogue) -------------------------
  "POST /api/options": { action: "option.create", category: "options", label: "Created a product option", target: { type: "option" } },
  "PUT /api/options/:id": { action: "option.update", category: "options", label: "Renamed a product option", target: { type: "option", param: "id" } },
  "DELETE /api/options/:id": { action: "option.delete", category: "options", label: "Deleted a product option", target: { type: "option", param: "id" } },
  "POST /api/options/:id/choices": { action: "option.choice.add", category: "options", label: "Added a value to a product option", target: { type: "option", param: "id" } },
  "DELETE /api/options/:id/choices/:choiceId": { action: "option.choice.delete", category: "options", label: "Removed a value from a product option", target: { type: "option", param: "id" } },

  // --- Media Centre ----------------------------------------------------------
  "POST /api/media": { action: "media.upload", category: "media", label: "Uploaded a file", target: { type: "media" } },
  "DELETE /api/media/:id": { action: "media.delete", category: "media", label: "Deleted a file", target: { type: "media", param: "id" } },
  "POST /api/media/upload-url": { skip: "changes nothing: it only reserves an upload, which is logged when it is confirmed (POST /api/media)" },
  "PUT /api/media/:id/thumbnail": { skip: "the preview the browser draws automatically for an uploaded PDF, part of that upload" },

  // --- Logos -----------------------------------------------------------------
  "POST /api/logos": { action: "logo.create", category: "logos", label: "Added a logo", target: { type: "logo" } },
  "PATCH /api/logos/:id": { action: "logo.update", category: "logos", label: "Edited a logo", target: { type: "logo", param: "id" } },
  "PUT /api/logos/reorder": { action: "logo.reorder", category: "logos", label: "Reordered logos" },
  "DELETE /api/logos/:id": { action: "logo.delete", category: "logos", label: "Deleted a logo", target: { type: "logo", param: "id" } },

  // --- Translations ----------------------------------------------------------
  "PUT /api/translations/batch": { action: "translation.save", category: "translations", label: "Saved translations" },
  "POST /api/translations/duda/refresh": { action: "translation.duda_refresh", category: "translations", label: "Refreshed names from Duda" },

  // --- Enquiries -------------------------------------------------------------
  "PATCH /api/quotes/:id": { action: "enquiry.quote.state", category: "enquiries", label: "Changed a quote request", target: { type: "quote", param: "id" } },
  "POST /api/quotes/mark-read": { action: "enquiry.quote.mark_read", category: "enquiries", label: "Marked quote requests as read" },
  "POST /api/quotes/:id/notes": { action: "enquiry.quote.note_add", category: "enquiries", label: "Added a note", target: { type: "quote", param: "id" } },
  "DELETE /api/quotes/:id/notes/:noteId": { action: "enquiry.quote.note_delete", category: "enquiries", label: "Deleted a note", target: { type: "quote", param: "id" } },
  "DELETE /api/quotes/:id": { action: "enquiry.quote.delete", category: "enquiries", label: "Deleted a quote request", target: { type: "quote", param: "id" } },
  "PATCH /api/resource-requests/:id": { action: "enquiry.file_request.state", category: "enquiries", label: "Changed a resource request", target: { type: "resource_request", param: "id" } },
  "POST /api/resource-requests/mark-read": { action: "enquiry.file_request.mark_read", category: "enquiries", label: "Marked resource requests as read" },
  "POST /api/resource-requests/:id/notes": { action: "enquiry.file_request.note_add", category: "enquiries", label: "Added a note", target: { type: "resource_request", param: "id" } },
  "DELETE /api/resource-requests/:id/notes/:noteId": { action: "enquiry.file_request.note_delete", category: "enquiries", label: "Deleted a note", target: { type: "resource_request", param: "id" } },
  "DELETE /api/resource-requests/:id": { action: "enquiry.file_request.delete", category: "enquiries", label: "Deleted a resource request", target: { type: "resource_request", param: "id" } },

  // --- Users and access ------------------------------------------------------
  "POST /api/users/password-reset": { action: "user.password_reset", category: "security", label: "Sent a password reset email", target: { type: "user" } },
  "POST /api/users/:id/disable": { action: "user.disable", category: "users", label: "Disabled an account", target: { type: "user", param: "id" } },
  "POST /api/users/:id/enable": { action: "user.enable", category: "users", label: "Enabled an account", target: { type: "user", param: "id" } },
  "DELETE /api/users/:id": { action: "user.delete", category: "users", label: "Deleted an account", target: { type: "user", param: "id" } },
  "POST /api/users/:id/website-editor": { action: "user.website_editor.grant", category: "users", label: "Gave Website Editor access", target: { type: "user", param: "id" } },
  "DELETE /api/users/:id/website-editor": { action: "user.website_editor.revoke", category: "users", label: "Removed Website Editor access", target: { type: "user", param: "id" } },
  "POST /api/users/:id/two-factor": { action: "user.two_factor.require", category: "users", label: "Required two-factor", target: { type: "user", param: "id" } },
  "DELETE /api/users/:id/two-factor": { action: "user.two_factor.off", category: "users", label: "Turned two-factor off", target: { type: "user", param: "id" } },
  "POST /api/invites": { action: "invite.create", category: "users", label: "Created an invite link", target: { type: "invite" } },
  "POST /api/invites/:id/revoke": { action: "invite.revoke", category: "users", label: "Revoked an invite link", target: { type: "invite", param: "id" } },
  "DELETE /api/invites/:id": { action: "invite.remove", category: "users", label: "Removed an invite", target: { type: "invite", param: "id" } },
  "POST /api/accept-invite": { action: "invite.accept", category: "users", label: "Accepted an invite and created their account", target: { type: "user" } },
  "POST /api/accept-invite/check": { skip: "changes nothing: it only says whether an invite link still works" },
  "POST /api/csp-report": { skip: "a browser's security-policy report: no one signed in, and it is only a log line" },

  // --- Website ---------------------------------------------------------------
  "POST /api/website/sso": { action: "website.editor_open", category: "website", label: "Opened the Website Editor", target: { type: "site" } },

  // --- The activity log itself -----------------------------------------------
  "GET /api/activity/export.csv": { action: "activity.export", category: "activity", label: "Exported the activity log" },
  "POST /api/activity/report": { skip: "writes its own event: what the browser reported (sign-out, password change, two-factor, a CSV export)" },
};

/**
 * Actions that do not come from one route: noticed by the server (sign-ins,
 * refusals), reported by the browser, or copied from Duda. Listed so the
 * page's Action filter can name them.
 */
export const OTHER_ACTIONS: Record<string, { category: ActivityCategory; label: string }> = {
  "auth.sign_in": { category: "security", label: "Signed in" },
  "auth.session_new_ip": { category: "security", label: "Session used from a new IP" },
  "security.refused": { category: "security", label: "Was refused access" },
  "auth.sign_out": { category: "security", label: "Signed out" },
  "auth.password_changed": { category: "security", label: "Changed their password" },
  "auth.two_factor_on": { category: "security", label: "Turned on two-factor" },
  "auth.two_factor_off": { category: "security", label: "Turned off their own two-factor" },
  "enquiry.quote.export": { category: "enquiries", label: "Exported quote requests to CSV" },
  "enquiry.file_request.export": { category: "enquiries", label: "Exported resource requests to CSV" },
  "translation.export": { category: "translations", label: "Exported translations to CSV" },
  "website.published": { category: "website", label: "Published the website" },
  "website.unpublished": { category: "website", label: "Unpublished the website" },
  "website.page_created": { category: "website", label: "Created a page" },
  "website.page_deleted": { category: "website", label: "Deleted a page" },
  "website.backup": { category: "website", label: "Backed up the website" },
  "website.restored": { category: "website", label: "Restored the website from a backup" },
  "website.domain_changed": { category: "website", label: "Changed the website's domain" },
  unknown: { category: "activity", label: "Unrecognised action" },
};

/**
 * What the browser may report (POST /api/activity/report), and nothing else.
 * These happen browser → Supabase, or are built in the browser, so the server
 * would never see them otherwise. Stored as `source: "browser"`.
 */
export const REPORTABLE = [
  "auth.sign_out",
  "auth.password_changed",
  "auth.two_factor_on",
  "auth.two_factor_off",
  "enquiry.quote.export",
  "enquiry.file_request.export",
  "translation.export",
] as const;
export type Reportable = (typeof REPORTABLE)[number];

/** Every action the log can hold, with its category and label: the page's filter. */
export function allActions(): { action: string; category: ActivityCategory; label: string }[] {
  const seen = new Map<string, { action: string; category: ActivityCategory; label: string }>();
  for (const e of Object.values(ROUTE_CATALOGUE)) {
    if ("skip" in e || seen.has(e.action)) continue;
    seen.set(e.action, { action: e.action, category: e.category, label: e.label });
  }
  for (const [action, e] of Object.entries(OTHER_ACTIONS)) seen.set(action, { action, ...e });
  return [...seen.values()];
}

// --- Matching a request to its entry -----------------------------------------

type Compiled = { key: string; method: string; re: RegExp; params: string[]; literals: number };

const normalise = (path: string) => (path.length > 1 ? path.replace(/\/+$/, "") : path);

function compile(key: string): Compiled {
  const [method, rawPath] = key.split(" ");
  const path = normalise(rawPath);
  const params: string[] = [];
  let literals = 0;
  const pattern = path
    .split("/")
    .map((seg) => {
      if (seg.startsWith(":")) {
        params.push(seg.slice(1));
        return "([^/]+)";
      }
      if (seg) literals++;
      return seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");
  // ⚠️ Case-insensitive, as Express routes are by default (USERS-AUDIT L4):
  // `/api/Users/:id/disable` still runs, and used to be logged as `unknown`,
  // losing the route's own target and before → after.
  return { key, method, re: new RegExp(`^${pattern}$`, "i"), params, literals };
}

// Most literal segments first, so `PUT /api/products/order` wins over a
// `PUT /api/products/:id…` shape and `/reorder` over `/:id`.
const COMPILED = Object.keys(ROUTE_CATALOGUE)
  .map(compile)
  .sort((a, b) => b.literals - a.literals || a.params.length - b.params.length);

/**
 * The catalogue entry for a request, with its route params. Matched on the
 * request's own path rather than Express's `req.route`, because by the time an
 * error reaches the app's error handler Express has already restored
 * `req.baseUrl` and `req.params` to the app's.
 */
export function matchRoute(
  method: string,
  path: string,
): { key: string; entry: CatalogueEntry; params: Record<string, string> } | null {
  const p = normalise(path);
  for (const c of COMPILED) {
    if (c.method !== method) continue;
    const m = c.re.exec(p);
    if (!m) continue;
    const params: Record<string, string> = {};
    c.params.forEach((name, i) => {
      try {
        params[name] = decodeURIComponent(m[i + 1]);
      } catch {
        params[name] = m[i + 1];
      }
    });
    return { key: c.key, entry: ROUTE_CATALOGUE[c.key], params };
  }
  return null;
}
