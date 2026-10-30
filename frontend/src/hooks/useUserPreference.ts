import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthContext";
import { toast } from "../components/ui";
import { applyTheme, useDocumentTheme, THEME_PREFERENCE_KEY, type Theme } from "../lib/theme";

/**
 * A UI preference stored against the signed-in ACCOUNT, in Supabase's
 * `user_metadata`.
 *
 * Deliberately not localStorage: that's per-browser, so the setting would be
 * lost on another machine and wouldn't survive the "remembers when logging in
 * and out" requirement in any meaningful sense. user_metadata rides along with
 * the session, needs no table or endpoint, and `onAuthStateChange` fires
 * USER_UPDATED on write so AuthContext refreshes itself.
 *
 * Writes are optimistic — the control responds immediately and reverts with a
 * toast if the round-trip fails, since a preference isn't worth a spinner.
 */
export function useUserPreference<T>(key: string, fallback: T) {
  const { user } = useAuth();

  const stored = (user?.user_metadata as Record<string, unknown> | undefined)?.[key];
  const remote = (stored === undefined ? fallback : stored) as T;

  const [value, setValue] = useState<T>(remote);
  const [saving, setSaving] = useState(false);

  // Adopt the account's value once the session resolves, and on any later
  // change from elsewhere (another tab, a fresh login).
  useEffect(() => {
    setValue(remote);
    // Compared by serialisation so object/array preferences don't loop.
  }, [JSON.stringify(remote)]);

  const update = useCallback(
    async (next: T) => {
      const previous = value;
      setValue(next); // optimistic
      setSaving(true);
      try {
        const { error } = await supabase.auth.updateUser({ data: { [key]: next } });
        if (error) throw new Error(error.message);
      } catch (e) {
        setValue(previous);
        toast.error(e instanceof Error ? e.message : "Couldn't save that preference");
      } finally {
        setSaving(false);
      }
    },
    [key, value],
  );

  return { value, setValue: update, saving };
}

/**
 * Hides the native-commerce fields (pricing, stock, inventory, shipping).
 *
 * SAEquip has no native checkout — the quote-request widgets replace it and no
 * prices are shown publicly — so these fields are noise by default. Defaults to
 * TRUE for that reason. Nothing is deleted; the values stay on the product and
 * are simply not rendered.
 */
export const HIDE_COMMERCE_KEY = "hideCommerceFields";

export function useHideCommerceFields() {
  return useUserPreference<boolean>(HIDE_COMMERCE_KEY, true);
}

/**
 * The account's light/dark choice.
 *
 * `null` means never chosen, which keeps whatever the pre-paint copy applied.
 * A value from the account wins once the session resolves, so a choice made
 * on one computer reaches the others. Called once in Layout so it runs on
 * every authenticated page; the theme toggle (redesign batch 4) calls
 * `setTheme`.
 *
 * ⚠️ `setTheme` writes the signed-in user's Supabase user_metadata — a real
 * write to the live auth record, if a harmless one.
 */
export function useThemePreference() {
  const pref = useUserPreference<Theme | null>(THEME_PREFERENCE_KEY, null);
  const { value, setValue, saving } = pref;
  useEffect(() => {
    if (value === "light" || value === "dark") applyTheme(value);
  }, [value]);
  const setTheme = useCallback(
    (theme: Theme) => {
      applyTheme(theme); // instant, and refreshes the pre-paint copy
      // Optimistic: on failure it reverts with a toast, and the effect above
      // re-applies the previous theme.
      void setValue(theme);
    },
    [setValue],
  );
  return { theme: useDocumentTheme(), setTheme, saving };
}
