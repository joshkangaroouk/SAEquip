import { createBrowserRouter } from "react-router-dom";
import Login from "./pages/Login";
import Products from "./pages/Products";
import ProductDetail from "./pages/ProductDetail";
import ProductNew from "./pages/ProductNew";
import Categories from "./pages/Categories";
import CategoryDetail from "./pages/CategoryDetail";
import ProductOptions from "./pages/ProductOptions";
import Media from "./pages/Media";
import Logos from "./pages/Logos";
import Widgets from "./pages/Widgets";
import Quotes from "./pages/Quotes";
import ResourceRequests from "./pages/ResourceRequests";
import Translations from "./pages/Translations";
import Status from "./pages/Status";
import UsersPage from "./pages/Users";
import Security from "./pages/Security";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import WebsiteEditor from "./pages/WebsiteEditor";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Layout } from "./components/Layout";
import { RouteError } from "./components/RouteError";

/**
 * Data router (createBrowserRouter), NOT <BrowserRouter>.
 *
 * This is required rather than stylistic: `useBlocker` — which powers the
 * unsaved-changes guard on the product editor — calls useDataRouterContext()
 * internally and throws outside a data router.
 */
export const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  // Unauthenticated on purpose: a visitor who has forgotten their password
  // cannot be behind the auth guard. /reset-password only WORKS while the
  // emailed recovery link's short-lived session exists — it checks for one.
  { path: "/forgot-password", element: <ForgotPassword /> },
  { path: "/reset-password", element: <ResetPassword /> },

  // The UI kit (pages/UIShowcase.tsx): development only. `import.meta.env.DEV`
  // is the constant `false` in a production build, so this branch, and the
  // lazy import inside it, are dropped — the page is never shipped. Outside
  // the auth guard because it calls no API.
  ...(import.meta.env.DEV
    ? [{ path: "/ui", lazy: async () => ({ Component: (await import("./pages/UIShowcase")).default }) }]
    : []),

  // Authenticated app — shared sidebar shell renders the page via <Outlet/>.
  {
    element: (
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    ),
    // On the layout route, so a page that throws keeps the sidebar and the
    // rest of the app reachable. Without it, React Router's default fallback
    // replaces the whole tree — which is how one null SKU once made every
    // page unreachable.
    errorElement: (
      <ProtectedRoute>
        <Layout>
          <RouteError />
        </Layout>
      </ProtectedRoute>
    ),
    // `handle.crumbs` is each page's place in the top bar's breadcrumb (TopBar.tsx).
    children: [
      { path: "/website", element: <WebsiteEditor />, handle: { crumbs: { title: "Website editor" } } },
      { path: "/", element: <Products />, handle: { crumbs: { group: "Catalogue", title: "Products" } } },
      // Static segments outrank dynamic ones in v7's route ranking, so
      // /products/new wins over /products/:id regardless of declaration order.
      {
        path: "/products/new",
        element: <ProductNew />,
        handle: { crumbs: { group: "Catalogue", parent: { title: "Products", to: "/" }, title: "New product" } },
      },
      {
        path: "/products/:id",
        element: <ProductDetail />,
        // The editor names the product (usePageCrumb); "Product" until it loads.
        handle: { crumbs: { group: "Catalogue", parent: { title: "Products", to: "/" }, title: "Product" } },
      },
      { path: "/categories", element: <Categories />, handle: { crumbs: { group: "Catalogue", title: "Categories" } } },
      {
        path: "/categories/:id",
        element: <CategoryDetail />,
        handle: { crumbs: { group: "Catalogue", parent: { title: "Categories", to: "/categories" }, title: "Category" } },
      },
      { path: "/options", element: <ProductOptions />, handle: { crumbs: { group: "Catalogue", title: "Product options" } } },
      { path: "/media", element: <Media />, handle: { crumbs: { group: "Catalogue", title: "Media" } } },
      { path: "/logos", element: <Logos />, handle: { crumbs: { group: "Catalogue", title: "Logos" } } },
      { path: "/widgets", element: <Widgets />, handle: { crumbs: { title: "Widgets" } } },
      {
        path: "/quotes",
        element: <Quotes />,
        // A split view: full width, and the panes scroll on their own (Layout).
        handle: { crumbs: { group: "Enquiries", title: "Quote requests" }, layout: "full" },
      },
      {
        path: "/resource-requests",
        element: <ResourceRequests />,
        handle: { crumbs: { group: "Enquiries", title: "Resource requests" }, layout: "full" },
      },
      { path: "/translations", element: <Translations />, handle: { crumbs: { group: "Catalogue", title: "Translations" } } },
      { path: "/users", element: <UsersPage />, handle: { crumbs: { group: "Admin", title: "Users" } } },
      { path: "/security", element: <Security />, handle: { crumbs: { group: "Admin", title: "Security" } } },
      { path: "/status", element: <Status />, handle: { crumbs: { title: "Status" } } },
    ],
  },
]);
