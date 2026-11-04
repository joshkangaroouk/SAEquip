import { z } from "zod";

/**
 * Marking a quote request or a resource request handled (redesign batch 6).
 * Shared by the two PATCH routes so they cannot drift.
 *
 * `{ handled: true }` stamps now and the signed-in user's email; `false`
 * clears both, which is "new" again. `.strict()`, so a body with anything
 * else in it is a 400 rather than silently half-applied.
 */
export const handledBody = z.object({ handled: z.boolean() }).strict();

export function handledData(handled: boolean, email: string | undefined) {
  return handled
    ? { handledAt: new Date(), handledBy: email ?? null }
    : { handledAt: null, handledBy: null };
}

/** What both PATCH routes answer with. */
export const handledSelect = { id: true, handledAt: true, handledBy: true } as const;
