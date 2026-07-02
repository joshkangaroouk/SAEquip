import type { Request, Response, NextFunction } from "express";
import { env } from "../env.js";
import { supabase } from "../supabase.js";

/**
 * Requires a valid Supabase access token whose user's email domain is in
 * ALLOWED_EMAIL_DOMAINS. On success, attaches req.user = { id, email }.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.header("authorization");
  const match = header?.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();

  if (!token) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const email = data.user.email ?? "";
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  if (!domain || !env.allowedEmailDomains.includes(domain)) {
    res.status(403).json({ error: "forbidden_domain" });
    return;
  }

  req.user = { id: data.user.id, email };
  next();
}
