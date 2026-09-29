import { createBrowserRouter } from "react-router-dom";
import Login from "./pages/Login";
import Products from "./pages/Products";
import ProductDetail from "./pages/ProductDetail";
import ProductNew from "./pages/ProductNew";
import Categories from "./pages/Categories";
import ProductOptions from "./pages/ProductOptions";
import Media from "./pages/Media";
import Logos from "./pages/Logos";
import Widgets from "./pages/Widgets";
import Quotes from "./pages/Quotes";
import Status from "./pages/Status";
// The component-kit showcase (pages/UIShowcase.tsx) is intentionally NOT
// routed: it was a temporary reference for building the UI and is hidden from
// the app. The file is kept for reference rather than deleted.
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
    children: [
      { path: "/website", element: <WebsiteEditor /> },
      { path: "/", element: <Products /> },
      // Static segments outrank dynamic ones in v7's route ranking, so
      // /products/new wins over /products/:id regardless of declaration order.
      { path: "/products/new", element: <ProductNew /> },
      { path: "/products/:id", element: <ProductDetail /> },
      { path: "/categories", element: <Categories /> },
      { path: "/options", element: <ProductOptions /> },
      { path: "/media", element: <Media /> },
      { path: "/logos", element: <Logos /> },
      { path: "/widgets", element: <Widgets /> },
      { path: "/quotes", element: <Quotes /> },
      { path: "/users", element: <UsersPage /> },
      { path: "/security", element: <Security /> },
      { path: "/status", element: <Status /> },
    ],
  },
]);
