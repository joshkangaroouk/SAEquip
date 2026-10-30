import { extendTailwindMerge } from "tailwind-merge";

/**
 * Every custom `fontSize` key in tailwind.config.js.
 *
 * ⚠️ Must stay in step with the config — `scripts/cn-audit.mjs` checks it.
 * tailwind-merge cannot tell `text-help` (a size) from `text-muted` (a
 * colour) on its own: it would class both as text colours and silently DROP
 * one of them whenever they met, e.g. every Input would lose `text-text`.
 */
export const FONT_SIZES = ["title", "body", "help", "label", "micro"];

/**
 * tailwind-merge v2 — v3 targets Tailwind 4 and this project is on Tailwind 3.
 * Colours, custom spacing and `font-heading`-style families need no config:
 * v2 groups any unknown `bg-*`/`text-*`/`border-*` value as a colour.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: FONT_SIZES }],
      // Without this, `shadow-menu` is read as a shadow COLOUR and would not
      // replace `shadow-none` (or vice versa).
      shadow: [{ shadow: ["menu"] }],
    },
  },
});

/**
 * Join conditional class names, resolving Tailwind conflicts: the LATER class
 * wins, so a `className` passed to a ui/ component deterministically
 * overrides that component's own base class. Falsy values are dropped.
 *
 * Before 2026-10 this was a plain string join, and the winner of a conflict
 * was whichever rule Tailwind happened to emit last — `w-56` on an Input and
 * `p-0` on a Card both silently lost that way.
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return twMerge(...parts);
}
