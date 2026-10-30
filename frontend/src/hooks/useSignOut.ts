import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { clearProductIndex } from "../lib/productIndex";
import { clearEnquiryCounts } from "../lib/enquiryCounts";

/** Sign out, forget the session's product list and enquiry counts, and go to the sign-in page. Shared by the sidebar and Security. */
export function useSignOut() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  return useCallback(async () => {
    await signOut();
    clearProductIndex();
    clearEnquiryCounts();
    navigate("/login", { replace: true });
  }, [signOut, navigate]);
}
