import { Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Products from "./pages/Products";
import ProductDetail from "./pages/ProductDetail";
import Media from "./pages/Media";
import Logos from "./pages/Logos";
import Status from "./pages/Status";
import UIShowcase from "./pages/UIShowcase";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Layout } from "./components/Layout";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Authenticated app — shared sidebar shell renders the page via <Outlet/>. */}
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Products />} />
        <Route path="/products/:id" element={<ProductDetail />} />
        <Route path="/media" element={<Media />} />
        <Route path="/logos" element={<Logos />} />
        <Route path="/status" element={<Status />} />
        {/* Temporary component-kit showcase — removed after verification. */}
        <Route path="/ui" element={<UIShowcase />} />
      </Route>
    </Routes>
  );
}
