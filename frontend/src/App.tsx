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
import UIShowcase from "./pages/UIShowcase";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Layout } from "./components/Layout";

/**
 * Data router (createBrowserRouter), NOT <BrowserRouter>.
 *
 * This is required rather than stylistic: `useBlocker` — which powers the
 * unsaved-changes guard on the product editor — calls useDataRouterContext()
 * internally and throws outside a data router.
 */
export const router = createBrowserRouter([
  { path: "/login", element: <Login /> },

  // Authenticated app — shared sidebar shell renders the page via <Outlet/>.
  {
    element: (
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    ),
    children: [
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
      { path: "/status", element: <Status /> },
      // Temporary component-kit showcase — removed after verification.
      { path: "/ui", element: <UIShowcase /> },
    ],
  },
]);
