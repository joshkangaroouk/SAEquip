import type { ReactNode } from "react";
import { Lockup } from "./Lockup";

/**
 * The sign-in, forgot-password and reset-password pages (02a Q15): light only,
 * a centred 400px card on --bg with the SA lockup above it, the title in
 * .t-auth-title. Each page brings its own form.
 */
export function AuthShell({
  title,
  description,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4 py-12">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 flex justify-center">
          <Lockup tone="light" />
        </div>
        <div className="border border-border bg-surface p-8">
          <h1 className="t-auth-title text-text">{title}</h1>
          {description && <p className="mt-2 text-body text-muted">{description}</p>}
          {children}
        </div>
      </div>
    </main>
  );
}
