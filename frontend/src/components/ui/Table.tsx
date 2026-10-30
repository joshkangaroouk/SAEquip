import { cn } from "../../lib/cn";

/**
 * Rounded table primitives. Spacious cells, hairline row dividers,
 * yellow-tinted row hover, and an optional sticky header.
 *
 *   <Table>
 *     <THead sticky><TR><TH>Name</TH><TH>Status</TH></TR></THead>
 *     <TBody>
 *       <TR hover onClick={…}><TD>…</TD><TD>…</TD></TR>
 *     </TBody>
 *   </Table>
 */
export function Table({ className, children, ...rest }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto rounded-lg border border-border bg-surface">
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
        // shadcn: a plain header row separated by a border, sentence case.
        // The old grey uppercase band read as a much heavier element.
        "border-b border-border text-muted [&_th]:font-medium",
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
 */
export function TR({
  hover = false,
  className,
  children,
  onClick,
  ...rest
}: React.HTMLAttributes<HTMLTableRowElement> & { hover?: boolean }) {
  return (
    <tr
      className={cn(
        "border-b border-border last:border-0",
        hover && "cursor-pointer transition-colors hover:bg-surface-2/70",
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
    <th className={cn("h-10 px-3 align-middle text-help font-medium", className)} {...rest}>
      {children}
    </th>
  );
}

export function TD({ className, children, ...rest }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn("px-3 py-2.5 align-middle text-body", className)} {...rest}>
      {children}
    </td>
  );
}
