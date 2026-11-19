import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "../auth/AuthContext";
import { clearProductIndex } from "../lib/productIndex";
import { clearEnquiryCounts } from "../lib/enquiryCounts";
import { clearAccessAlerts } from "../lib/accessAlerts";

/** Sign out, forget the session's product list and enquiry counts, and go to the sign-in page. Shared by the sidebar and Security. */
export function useSignOut() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  return useCallback(async () => {
    const { error } = await signOut();
    // Still signed in: say so rather than bounce off /login back to the dashboard.
    if (error) {
      toast.error(error);
      return;
    }
    clearProductIndex();
    clearEnquiryCounts();
    clearAccessAlerts();
    navigate("/login", { replace: true });
  }, [signOut, navigate]);
}
