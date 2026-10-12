/**
 * When `duda:sync-categories --confirm` must refuse to write. Pure, so the
 * rule is tested without touching Duda (scripts/script-guards-test.ts).
 *
 * ⚠️ Duda's category links are overwritten wholesale from the Hub. After the
 * 2026-09-29 database wipe, Duda's copy was the one that survived — so an
 * empty or wrong Hub must never be pushed over it, and a sweeping removal must
 * be asked for explicitly.
 */
export function syncRefusal(input: {
  confirm: boolean;
  /** Assignments in the Hub. */
  hubLinks: number;
  /** Links Duda holds now, across every category read. */
  linkedInDuda: number;
  /** Links this run would take away. */
  removals: number;
  allowRemovals: boolean;
}): string | null {
  const { confirm, hubLinks, linkedInDuda, removals, allowRemovals } = input;
  if (!confirm) return null;
  if (hubLinks === 0 && linkedInDuda > 0) {
    return (
      `the Hub holds NO assignments, so this would empty all ${linkedInDuda} links in Duda.\n` +
      `  Is DATABASE_URL the live database? After a wipe, Duda's copy may be the only one left.`
    );
  }
  if (removals > 10 && removals > linkedInDuda / 4 && !allowRemovals) {
    return (
      `this would remove ${removals} of Duda's ${linkedInDuda} links (more than a quarter).\n` +
      `  Check the dry run, then re-run with --allow-removals if that really is the intent.`
    );
  }
  return null;
}
