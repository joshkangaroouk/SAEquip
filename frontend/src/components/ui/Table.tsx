import { cn } from "../../lib/cn";

/**
 * Table primitives (00 "Table / list rows"): a bordered --surface box, the
 * head on --surface-2 in the table-head type (Inter 12/600, muted), rows with
 * 1px dividers, padding 10 20, a --surface-2 hover, and a selected state.
 *
 *   <Table>
 *     <THead sticky><TR><TH>Name</TH><TH>Status</TH></TR></THead>
 *     <TBody>
 *       <TR hover onClick={…}><TD>…</TD><TD>…</TD></TR>
 *     </TBody>
 *   </Table>
 */
export function Table({
  className,
  children,
  scroll = "x",
  ...rest
}: React.TableHTMLAttributes<HTMLTableElement> & {
  /**
   * "x" (default) lets a wide table scroll sideways inside its box. ⚠️ That box
   * is then a scroll container, so a sticky head sticks to IT, not the page —
   * use "none" for a table whose THead must stay in view as the page scrolls.
   */
  scroll?: "x" | "none";
}) {
  return (
    <div className={cn("w-full border border-border bg-surface", scroll === "x" && "overflow-x-auto")}>
      <table className={cn("w-full border-collapse text-left", className)} {...rest}>
        {children}
      </table>
    </div>
  );
}

export function THead({
  sticky = false,
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLTableSectionElement> & { sticky?: boolean }) {
  return (
    <thead
      className={cn(
        // The background is what makes a sticky head usable: without it the
        // rows scroll visibly underneath.
        "border-b border-border bg-surface-2",
        sticky && "sticky top-0 z-10",
        className,
      )}
      {...rest}
    >
      {children}
    </thead>
  );
}

export function TBody({ className, children, ...rest }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={cn("divide-y divide-border", className)} {...rest}>
      {children}
    </tbody>
  );
}

/**
 * A table row. With `hover` and `onClick` the whole row is a mouse target.
 *
 * ⚠️ A clickable row is NOT a keyboard target — a `<tr>` takes no focus — so
 * every such row must ALSO carry a real link or button in one of its cells
 * (Products, Quotes, Resource Requests and Translations were mouse-only until
 * 2026-10-12). A click that starts on such a control is left to it, so the
 * action does not run twice — twice is two history entries for a link.
 *
 * `selected` draws the selected row (00): a --surface-2 fill and a 3px yellow
 * bar on the left (an inset shadow on the first cell, so nothing shifts). It
 * is visual only — the caller sets whatever ARIA its list pattern needs.
 */
export function TR({
  hover = false,
  selected = false,
  className,
  children,
  onClick,
  ...rest
}: React.HTMLAttributes<HTMLTableRowElement> & { hover?: boolean; selected?: boolean }) {
  return (
    <tr
      className={cn(
        "border-b border-border last:border-0",
        hover && "cursor-pointer transition-colors duration-[120ms] hover:bg-surface-2",
        selected && "bg-surface-2 [&>:first-child]:shadow-[inset_3px_0_0_0_rgb(var(--accent))]",
        className,
      )}
      onClick={
        onClick &&
        ((e) => {
          if ((e.target as Element).closest("a,button,input,select,textarea,label")) return;
          onClick(e);
        })
      }
      {...rest}
    >
      {children}
    </tr>
  );
}

export function TH({ className, children, ...rest }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={cn("t-th h-10 px-5 align-middle", className)} {...rest}>
      {children}
    </th>
  );
}

export function TD({ className, children, ...rest }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn("px-5 py-2.5 align-middle text-body", className)} {...rest}>
      {children}
    </td>
  );
}
