import { useSyncExternalStore } from "react";

/** True while the media query matches; follows changes (a resize, a rotation). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Tailwind's `lg` (1024px): the sidebar is fixed from here, a drawer below. */
export const LG = "(min-width: 1024px)";
