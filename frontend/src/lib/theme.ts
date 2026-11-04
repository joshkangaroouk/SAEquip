import { useEffect, useSyncExternalStore } from "react";

/**
 * Light / dark theme for the main panel. The sidebar ignores it: it uses the
 * fixed `--sidebar-*` tokens (index.css).
 *
 * The theme is `data-theme` on <html>, so portalled modals, menus and toasts
 * are themed too. It is set before first paint by the inline script in
 * index.html, from a copy kept in localStorage; the account's own preference
 * (useThemePreference) takes over once the session has loaded.
 */
export type Theme = "light" | "dark";

/** Pre-paint copy, read by the inline script in index.html. ⚠️ Keep the two in step. */
export const THEME_STORAGE_KEY = "hub-theme";
/** Account copy, in Supabase user_metadata through useUserPreference. */
export const THEME_PREFERENCE_KEY = "theme";

/** The theme as rendered right now. */
export function readTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

/** The pre-paint copy. Storage can throw (private mode, blocked site data). */
export function storedTheme(): Theme {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

/** Apply now and refresh the pre-paint copy. */
export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* the attribute is set; only the next first paint is affected */
  }
}

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

/** The theme as rendered. Follows any change to <html data-theme>. */
export function useDocumentTheme(): Theme {
  return useSyncExternalStore(subscribe, readTheme, () => "light");
}

/**
 * The sign-in, forgot-password and reset-password pages are light only
 * (docs/redesign/02a Q15), whatever the stored theme. The pre-paint script
 * already paints them light; this keeps them light when they are reached
 * in-app (signing out) and hands the stored theme back when they are left
 * (signing in). It never writes the stored copy.
 */
export function useForceLightTheme() {
  useEffect(() => {
    document.documentElement.dataset.theme = "light";
    return () => {
      document.documentElement.dataset.theme = storedTheme();
    };
  }, []);
}
