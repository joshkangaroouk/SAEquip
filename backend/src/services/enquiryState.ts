import type { RequestHandler } from "express";
import { z } from "zod";

/**
 * Read state, stars and the team's notes on quote requests and resource
 * requests (2026-11, replacing batch 6's "Mark as handled"). Shared by the two
 * routers so the rules cannot drift; each router only supplies how to find and
 * write its own rows (`QuoteRequest` and `Lead`, and their `EnquiryNote`s).
 *
 * All of it is SHARED by the team, like a shared mailbox: opening a request
 * marks it read for everyone, a star is a team flag, and notes are a small
 * message board everyone sees. Each records who and when, from the signed-in
 * user.
 */

/**
 * PATCH body: read and/or starred, at least one. `.strict()`, so a body with
 * anything else in it (an old client's `handled` or `notes`) is a 400 rather
 * than silently half-applied.
 */
export const stateBody = z
  .object({
    read: z.boolean().optional(),
    starred: z.boolean().optional(),
  })
  .strict()
  .refine((b) => b.read !== undefined || b.starred !== undefined, { message: "Nothing to change" });

export type StateBody = z.infer<typeof stateBody>;

/** What every state route answers with, and what a router's `find` returns. */
export const stateSelect = {
  id: true,
  readAt: true,
  readBy: true,
  starredAt: true,
  starredBy: true,
} as const;

export interface EnquiryState {
  id: string;
  readAt: Date | null;
  readBy: string | null;
  starredAt: Date | null;
  starredBy: string | null;
}

export type StateChanges = Partial<Omit<EnquiryState, "id">>;

/**
 * The columns to write for `body`, given the row as it is now.
 *
 * - `read: true` on a row already read changes nothing, so "first opened by"
 *   keeps the first person rather than whoever opened it last.
 * - `starred: true` on a starred row likewise keeps who starred it.
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
  return data;
}

interface StateModel {
  find: (id: string) => Promise<EnquiryState | null>;
  update: (id: string, data: StateChanges) => Promise<EnquiryState>;
}

/**
 * PATCH /<list>/:id  { read?, starred? } — answers with the row's
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

/** Long enough for a call log with prices; short enough to bound a row. */
export const NOTE_MAX = 5000;

/** POST body: the note's text, trimmed, not empty. */
export const noteBody = z.object({ body: z.string().trim().min(1).max(NOTE_MAX) }).strict();

/** What a note looks like in every answer, oldest first in a request's list. */
export const noteSelect = { id: true, body: true, createdAt: true, createdBy: true } as const;

export interface EnquiryNote {
  id: string;
  body: string;
  createdAt: Date;
  createdBy: string | null;
}

interface NotesModel {
  /** Whether the request exists. */
  exists: (id: string) => Promise<boolean>;
  create: (id: string, body: string, createdBy: string | null) => Promise<EnquiryNote>;
  /** The note, only if it belongs to request `id`. */
  find: (id: string, noteId: string) => Promise<{ createdBy: string | null } | null>;
  remove: (noteId: string) => Promise<unknown>;
}

/**
 * POST /<list>/:id/notes  { body } — adds a note, stamped now and with the
 * signed-in user's email; answers 201 with the note. Unknown request → 404.
 */
export function addNoteRoute(model: NotesModel): RequestHandler {
  return async (req, res, next) => {
    const parsed = noteBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_error", details: parsed.error.flatten() });
      return;
    }
    try {
      const id = String(req.params.id);
      if (!(await model.exists(id))) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      res.status(201).json(await model.create(id, parsed.data.body, req.user?.email ?? null));
    } catch (err) {
      next(err);
    }
  };
}

/**
 * DELETE /<list>/:id/notes/:noteId — only its author may delete a note, so
 * the board stays a record of what each person wrote (403 `not_author`
 * otherwise; a note with no recorded author cannot be deleted). A note that
 * is not on that request → 404.
 */
export function deleteNoteRoute(model: NotesModel): RequestHandler {
  return async (req, res, next) => {
    try {
      const note = await model.find(String(req.params.id), String(req.params.noteId));
      if (!note) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      if (!note.createdBy || note.createdBy !== req.user?.email) {
        res.status(403).json({ error: "not_author", detail: "Only the person who wrote a note can delete it." });
        return;
      }
      await model.remove(String(req.params.noteId));
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  };
}
