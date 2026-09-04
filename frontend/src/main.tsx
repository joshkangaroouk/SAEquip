import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./App";
import { AuthProvider } from "./auth/AuthContext";
import { ConfirmProvider, Toaster } from "./components/ui";
// No font imports here: DIN 2014 comes from Adobe Fonts via the <link> in
// index.html, since Adobe's licence forbids self-hosting the files.
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <ConfirmProvider>
        <RouterProvider router={router} />
        <Toaster />
      </ConfirmProvider>
    </AuthProvider>
  </StrictMode>,
);
