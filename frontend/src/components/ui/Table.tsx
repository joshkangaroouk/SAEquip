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

export function TR({
  hover = false,
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLTableRowElement> & { hover?: boolean }) {
  return (
    <tr
      className={cn(
        "border-b border-border last:border-0",
        hover && "cursor-pointer transition-colors hover:bg-surface-2/70",
        className,
      )}
      {...rest}
    >
      {children}
    </tr>
  );
}

export function TH({ className, children, ...rest }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={cn("h-10 px-3 align-middle text-small font-medium", className)} {...rest}>
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
