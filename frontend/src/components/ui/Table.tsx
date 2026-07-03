import { cn } from "../../lib/cn";

/**
 * Sharp-cornered table primitives. Spacious cells, hairline row dividers,
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
    <div className="w-full overflow-x-auto border border-border">
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
        "bg-surface-2 text-small font-semibold uppercase tracking-wide text-muted",
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
        hover && "cursor-pointer transition-colors hover:bg-surface-2",
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
    <th className={cn("px-4 py-3 font-semibold", className)} {...rest}>
      {children}
    </th>
  );
}

export function TD({ className, children, ...rest }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn("px-4 py-3.5 text-body align-middle", className)} {...rest}>
      {children}
    </td>
  );
}
