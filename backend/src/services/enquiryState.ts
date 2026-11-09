import type { RequestHandler } from "express";
import { z } from "zod";

/**
 * Read state, stars and notes on quote requests and resource requests (2026-11,
 * replacing batch 6's "Mark as handled"). Shared by the two routers so the
 * rules cannot drift; each router only supplies how to find and write its own
 * rows (`QuoteRequest` and `Lead`).
 *
 * All of it is SHARED by the team, like a shared mailbox: opening a request
 * marks it read for everyone, and a star is a team flag. Each records who and
 * when, from the signed-in user.
 */

/** Long enough for a running log of calls and prices; short enough to bound a row. */
export const NOTES_MAX = 5000;

/**
 * PATCH body: any of the three, at least one. `.strict()`, so a body with
 * anything else in it (an old client's `handled`) is a 400 rather than
 * silently half-applied.
 */
export const stateBody = z
  .object({
    read: z.boolean().optional(),
    starred: z.boolean().optional(),
    notes: z.string().max(NOTES_MAX).nullable().optional(),
  })
  .strict()
  .refine((b) => b.read !== undefined || b.starred !== undefined || b.notes !== undefined, {
    message: "Nothing to change",
  });

export type StateBody = z.infer<typeof stateBody>;

/** What every state route answers with, and what a router's `find` returns. */
export const stateSelect = {
  id: true,
  readAt: true,
  readBy: true,
  starredAt: true,
  starredBy: true,
  notes: true,
  notesUpdatedAt: true,
  notesUpdatedBy: true,
} as const;

export interface EnquiryState {
  id: string;
  readAt: Date | null;
  readBy: string | null;
  starredAt: Date | null;
  starredBy: string | null;
  notes: string | null;
  notesUpdatedAt: Date | null;
  notesUpdatedBy: string | null;
}

export type StateChanges = Partial<Omit<EnquiryState, "id">>;

/**
 * The columns to write for `body`, given the row as it is now.
 *
 * - `read: true` on a row already read changes nothing, so "first opened by"
 *   keeps the first person rather than whoever opened it last.
 * - `starred: true` on a starred row likewise keeps who starred it.
 * - `notes`: all-whitespace is stored as null. Only a real change stamps who
 *   and when, so an autosave of the same text is not an edit.
 */
export function stateChanges(
  body: StateBody,
  current: EnquiryState,
  email: string | undefined,
  now: Date = new Date(),
): StateChanges {
  const who = email ?? null;
  const data: StateChanges = {};
  if (body.read === true && !current.readAt) Object.assign(data, { readAt: now, readBy: who });
  if (body.read === false && current.readAt) Object.assign(data, { readAt: null, readBy: null });
  if (body.starred === true && !current.starredAt) Object.assign(data, { starredAt: now, starredBy: who });
  if (body.starred === false && current.starredAt) Object.assign(data, { starredAt: null, starredBy: null });
  if (body.notes !== undefined) {
    const notes = body.notes && body.notes.trim() !== "" ? body.notes : null;
    if (notes !== current.notes) Object.assign(data, { notes, notesUpdatedAt: now, notesUpdatedBy: who });
  }
  return data;
}

interface StateModel {
  find: (id: string) => Promise<EnquiryState | null>;
  update: (id: string, data: StateChanges) => Promise<EnquiryState>;
}

/**
 * PATCH /<list>/:id  { read?, starred?, notes? } — answers with the row's
 * state after the change. Unknown id → 404.
 */
export function stateRoute(model: StateModel): RequestHandler {
  return async (req, res, next) => {
    const parsed = stateBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_error", details: parsed.error.flatten() });
      return;
    }
    try {
      const id = String(req.params.id);
      const current = await model.find(id);
      if (!current) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      const data = stateChanges(parsed.data, current, req.user?.email);
      res.json(Object.keys(data).length > 0 ? await model.update(id, data) : current);
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Mark as read in bulk: the ids the page shows as unread, not "everything",
 * so a request that arrived after the page loaded is not marked read unseen.
 */
export const markReadBody = z.object({ ids: z.array(z.string().min(1).max(64)).min(1).max(1000) }).strict();

interface MarkReadModel {
  /** Mark the unread ones among `ids` read, with `data`. */
  markRead: (ids: string[], data: { readAt: Date; readBy: string | null }) => Promise<unknown>;
  /** The state of `ids` afterwards. */
  states: (ids: string[]) => Promise<EnquiryState[]>;
}

/** POST /<list>/mark-read  { ids } — answers `{ requests: EnquiryState[] }`. */
export function markReadRoute(model: MarkReadModel): RequestHandler {
  return async (req, res, next) => {
    const parsed = markReadBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_error", details: parsed.error.flatten() });
      return;
    }
    try {
      const ids = [...new Set(parsed.data.ids)];
      await model.markRead(ids, { readAt: new Date(), readBy: req.user?.email ?? null });
      res.json({ requests: await model.states(ids) });
    } catch (err) {
      next(err);
    }
  };
}

/**
 * DELETE /<list>/:id?confirm=true — permanent, for a person who asks for their
 * data to be removed. There are no backups on this database, so the dashboard
 * asks for a typed confirmation and the route refuses without `confirm=true`,
 * the same guard as deleting a product. Unknown id → 404 (P2025, through the
 * shared error handler).
 *
 * Logged with the row id and who deleted it, never the person's details: the
 * point of deleting is that those are gone.
 */
export function deleteRoute(kind: string, remove: (id: string) => Promise<unknown>): RequestHandler {
  return async (req, res, next) => {
    if (req.query.confirm !== "true") {
      res.status(400).json({ error: "confirm_required", detail: "Add ?confirm=true to delete permanently." });
      return;
    }
    try {
      const id = String(req.params.id);
      await remove(id);
      console.info(`[enquiries] ${kind} ${id} deleted by ${req.user?.email ?? "unknown"}`);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  };
}
