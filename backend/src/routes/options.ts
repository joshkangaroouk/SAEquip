import { Router } from "express";
import { z } from "zod";
import { duda } from "../services/duda.js";
import { emptyUsage, getOptionUsage, invalidateOptionUsage } from "../services/optionUsage.js";

export const optionsRouter = Router();

const createSchema = z
  .object({
    name: z.string().trim().min(1, "name is required").max(100, "name max 100 chars"),
    type: z.enum(["TEXT", "COLOR"]).default("TEXT"),
    choices: z
      .array(z.string().trim().min(1, "choice must not be blank").max(100))
      .min(1, "at least one choice is required"),
  })
  .strict();

const updateSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    type: z.enum(["TEXT", "COLOR"]).default("TEXT"),
  })
  .strict();

const choiceSchema = z.object({ value: z.string().trim().min(1).max(100) }).strict();

/**
 * GET /api/options
 * The whole shared catalog, annotated with which products use each option, plus
 * store headroom. Options are per-CATALOG (max 20) and shared, so every
 * response carries enough context for the UI to warn before a change.
 */
optionsRouter.get("/options", async (_req, res, next) => {
  try {
    const [list, store, usage] = await Promise.all([
      duda.listOptions(),
      duda.getStore(),
      getOptionUsage(),
    ]);

    const max = store.features?.max_options ?? null;
    res.json({
      max_options: max,
      max_choices_per_option: store.features?.max_choices_per_option ?? null,
      count: list.total_responses ?? list.results.length,
      remaining: max != null ? max - (list.total_responses ?? list.results.length) : null,
      options: list.results.map((o) => {
        const u = usage.get(o.id) ?? emptyUsage();
        return {
          id: o.id,
          name: o.name,
          type: o.type,
          choices: o.choices.map((c) => ({
            id: c.id,
            value: c.value,
            usage: u.choiceUsage[c.id] ?? 0,
          })),
          usage: u.productCount,
          products: u.products,
        };
      }),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/options
 * Creates a catalog option. 409s at the per-catalog cap with an explicit
 * message, because that cap is easy to mistake for a per-product one.
 */
optionsRouter.post("/options", async (req, res, next) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", details: parsed.error.flatten() });
    return;
  }

  try {
    const [list, store] = await Promise.all([duda.listOptions(), duda.getStore()]);
    const max = store.features?.max_options ?? null;
    const count = list.total_responses ?? list.results.length;
    const maxChoices = store.features?.max_choices_per_option ?? null;

    if (max != null && count >= max) {
      res.status(409).json({
        error: "option_cap_reached",
        detail: `The store already has ${count} of its ${max} options. This cap is shared across the whole catalog, not per product — reuse an existing option (products can expose just the choices they need) or delete one first.`,
      });
      return;
    }
    if (maxChoices != null && parsed.data.choices.length > maxChoices) {
      res.status(409).json({
        error: "choice_cap_reached",
        detail: `An option can hold at most ${maxChoices} choices.`,
      });
      return;
    }

    const created = await duda.createOption(parsed.data);
    invalidateOptionUsage();
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/options/:id
 * Renames a SHARED option — this changes it on every product using it, so the
 * response reports how many were affected.
 */
optionsRouter.put("/options/:id", async (req, res, next) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", details: parsed.error.flatten() });
    return;
  }

  try {
    const usage = (await getOptionUsage()).get(req.params.id) ?? emptyUsage();
    const updated = await duda.updateOption(req.params.id, parsed.data);
    invalidateOptionUsage();
    res.json({ ...updated, affectedProducts: usage.productCount });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/options/:id?confirm=true
 * Refuses without ?confirm=true when the option is in use, returning the full
 * list of affected products so the UI can name them.
 */
optionsRouter.delete("/options/:id", async (req, res, next) => {
  try {
    const usage = (await getOptionUsage()).get(req.params.id) ?? emptyUsage();
    if (usage.productCount > 0 && req.query.confirm !== "true") {
      res.status(409).json({
        error: "option_in_use",
        detail: `This option is used by ${usage.productCount} product(s). Deleting it removes it from all of them.`,
        products: usage.products,
      });
      return;
    }

    await duda.deleteOption(req.params.id);
    invalidateOptionUsage();
    res.json({ deleted: true, affectedProducts: usage.productCount });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/options/:id/choices
 * Adding a choice is SAFE: verified that it does not propagate to products
 * already using the option — each product keeps its own subset.
 */
optionsRouter.post("/options/:id/choices", async (req, res, next) => {
  const parsed = choiceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", details: parsed.error.flatten() });
    return;
  }

  try {
    const [store, list] = await Promise.all([duda.getStore(), duda.listOptions()]);
    const option = list.results.find((o) => o.id === req.params.id);
    if (!option) {
      res.status(404).json({ error: "option_not_found" });
      return;
    }
    const maxChoices = store.features?.max_choices_per_option ?? null;
    if (maxChoices != null && option.choices.length >= maxChoices) {
      res.status(409).json({
        error: "choice_cap_reached",
        detail: `"${option.name}" already has the maximum of ${maxChoices} choices.`,
      });
      return;
    }

    const created = await duda.addOptionChoice(req.params.id, parsed.data.value);
    invalidateOptionUsage();
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/options/:id/choices/:choiceId?confirm=true
 * Unlike adding, removing a choice DOES affect every product exposing it —
 * their variations regenerate and lose that combination.
 */
optionsRouter.delete("/options/:id/choices/:choiceId", async (req, res, next) => {
  try {
    const usage = (await getOptionUsage()).get(req.params.id) ?? emptyUsage();
    const affected = usage.choiceUsage[req.params.choiceId] ?? 0;

    if (affected > 0 && req.query.confirm !== "true") {
      res.status(409).json({
        error: "choice_in_use",
        detail: `${affected} product(s) currently offer this choice. Removing it regenerates their variations and drops that combination.`,
        products: usage.products,
      });
      return;
    }

    await duda.deleteOptionChoice(req.params.id, req.params.choiceId);
    invalidateOptionUsage();
    res.json({ deleted: true, affectedProducts: affected });
  } catch (err) {
    next(err);
  }
});
