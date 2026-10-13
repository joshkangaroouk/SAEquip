/**
 * Plan the logo toggles from SA Equip's master sheet (Phase 3 of
 * docs/sa-equip-phase0/CURSOR_BRIEF.md). Pure: no network, no database, so the
 * rules are tested by script-guards:test.
 *
 * ⚠️ ON ONLY (Josh, 2026-10-13). Certification logos are compliance claims, so
 * this phase never switches one off: there is no removal path here at all, not
 * merely a flag that disables it. For each READY product and each sheet key:
 *   - true  → switched ON if it is off;
 *   - false → left exactly as it is; if it is currently ON, it is listed in
 *             `heldOn` for SA Equip to confirm (the 7 Inmetro + 1 Zone 21-22);
 *   - null  → unknown, left untouched (UKCA, Made in Britain, SA Rental).
 * An unknown sheet key, or a key with no catalogue logo, throws before anything
 * is planned: a mis-mapped mark would badge products with the wrong certification.
 */
export type Toggles = Record<string, boolean | null | undefined>;
export type LogoWanted = { hubProductId: string; dudaProductId: string; name: string; toggles: Toggles };
export type LogoLink = { hubProductId: string; logoId: string };
export type LogoChange = { hubProductId: string; dudaProductId: string; name: string; key: string; logoId: string };
export type LogoPlan = {
  /** Toggles switched ON (new ProductLogo rows). */
  adds: LogoChange[];
  /** The sheet says OFF, the product has it ON: not changed, for SA Equip to confirm. */
  heldOn: LogoChange[];
};

export function planLogos(input: { wanted: LogoWanted[]; links: LogoLink[]; logoIdFor: Map<string, string> }): LogoPlan {
  const { wanted, links, logoIdFor } = input;
  const on = new Set(links.map((l) => `${l.hubProductId}|${l.logoId}`));
  const seen = new Set<string>();
  const plan: LogoPlan = { adds: [], heldOn: [] };
  for (const w of wanted) {
    if (seen.has(w.hubProductId)) throw new Error(`${w.name} (${w.dudaProductId}) is given twice`);
    seen.add(w.hubProductId);
    for (const [key, value] of Object.entries(w.toggles)) {
      const logoId = logoIdFor.get(key);
      if (!logoId) throw new Error(`${w.name} (${w.dudaProductId}): no catalogue logo for the sheet key "${key}"`);
      if (value == null) continue; // unknown: leave it exactly as it is
      const isOn = on.has(`${w.hubProductId}|${logoId}`);
      const change = { hubProductId: w.hubProductId, dudaProductId: w.dudaProductId, name: w.name, key, logoId };
      if (value === true && !isOn) plan.adds.push(change);
      else if (value === false && isOn) plan.heldOn.push(change);
    }
  }
  return plan;
}
