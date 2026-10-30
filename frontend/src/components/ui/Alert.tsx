import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import { cn } from "../../lib/cn";
import { useInAccordionBody } from "./AccordionBody";

export type AlertTone = "danger" | "warning" | "info" | "ok";

const TONES: Record<AlertTone, { bar: string; ink: string; Icon: LucideIcon }> = {
  danger: { bar: "border-l-danger", ink: "text-danger", Icon: CircleAlert },
  warning: { bar: "border-l-warning", ink: "text-warning", Icon: TriangleAlert },
  info: { bar: "border-l-text", ink: "text-text", Icon: Info },
  ok: { bar: "border-l-ok", ink: "text-ok", Icon: CircleCheck },
};

/**
 * The one box for errors, notices and warnings (02a Q2): --surface with a 1px
 * --border, a 3px left bar in the tone colour, the icon and title in that
 * tone, the message in --text, and optional actions on the right.
 *
 * Announced by tone: danger is `role="alert"`, the rest `role="status"`.
 * `live` overrides it — "off" for a notice that is simply part of the page
 * (it was not caused by what the user just did), "assertive"/"polite" to
 * force one or the other.
 *
 * `section` is the editor-section error: it renders nothing inside an
 * accordion body, where the accordion prints the same message itself (see
 * SectionError).
 */
export function Alert({
  tone = "info",
  title,
  action,
  live,
  section = false,
  className,
  children,
}: {
  tone?: AlertTone;
  title?: ReactNode;
  action?: ReactNode;
  live?: "assertive" | "polite" | "off";
  section?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const bare = useInAccordionBody();
  if (section && bare) return null;
  const { bar, ink, Icon } = TONES[tone];
  const role =
    live === "off" ? undefined : live === "assertive" ? "alert" : live === "polite" ? "status" : tone === "danger" ? "alert" : "status";
  return (
    <div
      role={role}
      className={cn("flex items-start gap-2.5 border border-l-[3px] border-border bg-surface px-3 py-2.5 text-body text-text", bar, className)}
    >
      <Icon size={16} strokeWidth={2} aria-hidden="true" className={cn("mt-0.5 shrink-0", ink)} />
      <div className="min-w-0 flex-1">
        {title && <p className={cn("font-semibold", ink)}>{title}</p>}
        {children && <div className={title ? "mt-0.5" : undefined}>{children}</div>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}
