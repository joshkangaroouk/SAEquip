import type { Store, ClientRateLimitInfo, Options } from "express-rate-limit";
import { prisma } from "../prisma.js";

/**
 * An `express-rate-limit` store backed by Postgres.
 *
 * Why not the default memory store: it lives in one process. On serverless the
 * app runs as many short-lived instances, so every instance keeps its own
 * counter and the effective limit becomes (limit x concurrency), resetting
 * whenever an instance is recycled. A limit that guards credential minting
 * cannot be that soft.
 *
 * Why not Redis: this needs one shared counter, the volume is a handful of
 * writes per staff action, and Postgres is already here with a pooled
 * connection. Adding a Redis service to hold an integer would be a new
 * dependency to provision, monitor and pay for.
 *
 * Rows are self-expiring by comparison (`expiresAt` in the past = fresh
 * window), so nothing has to be swept for correctness.
 *
 * ⚠️ But the sweep is about PRIVACY, not correctness: a key is the visitor's
 * IP address, and on the lead and quote forms that is the IP of someone who
 * just submitted personal data. `sweepExpiredRateLimits()` existed and was
 * never called, so every such IP was kept forever (fixed 2026-10-12). It now
 * runs from `increment()` on roughly one call in SWEEP_ONE_IN, unawaited and
 * best-effort: an expired row means nothing to the limit, so deleting it only
 * forgets the address.
 */
const SWEEP_ONE_IN = 20;

export class PgRateLimitStore implements Store {
  /** Namespace so several limiters can share the table without colliding.
   *  Named `keyPrefix`, not `prefix`, because express-rate-limit's own Store
   *  interface declares a public `prefix` and a private field of that name
   *  fails to satisfy it. */
  private readonly keyPrefix: string;
  private windowMs = 60_000;

  constructor(prefix: string) {
    this.keyPrefix = prefix;
  }

  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  private id(key: string): string {
    return `${this.keyPrefix}:${key}`;
  }

  /**
   * Count this request and report the window state.
   *
   * One atomic statement on purpose. Read-then-write would let two concurrent
   * requests both read the same count and both write count+1, losing a hit —
   * which is precisely the race a rate limit exists to catch, and serverless
   * makes concurrent instances the normal case rather than the exception.
   */
  async increment(key: string): Promise<ClientRateLimitInfo> {
    const expires = new Date(Date.now() + this.windowMs);
    const rows = await prisma.$queryRaw<{ hits: number; expiresAt: Date }[]>`
      INSERT INTO "RateLimitCounter" ("key", "hits", "expiresAt")
      VALUES (${this.id(key)}, 1, ${expires})
      ON CONFLICT ("key") DO UPDATE SET
        "hits" = CASE
          WHEN "RateLimitCounter"."expiresAt" < now() THEN 1
          ELSE "RateLimitCounter"."hits" + 1
        END,
        "expiresAt" = CASE
          WHEN "RateLimitCounter"."expiresAt" < now() THEN ${expires}
          ELSE "RateLimitCounter"."expiresAt"
        END
      RETURNING "hits", "expiresAt"
    `;
    const row = rows[0];
    if (Math.random() < 1 / SWEEP_ONE_IN) void sweepExpiredRateLimits().catch(() => {});
    return { totalHits: row?.hits ?? 1, resetTime: row?.expiresAt ?? expires };
  }

  /** Used when `skipSuccessfulRequests`/`skipFailedRequests` refund a hit. */
  async decrement(key: string): Promise<void> {
    await prisma.$executeRaw`
      UPDATE "RateLimitCounter"
         SET "hits" = GREATEST("hits" - 1, 0)
       WHERE "key" = ${this.id(key)} AND "expiresAt" >= now()
    `;
  }

  async resetKey(key: string): Promise<void> {
    await prisma.rateLimitCounter.deleteMany({ where: { key: this.id(key) } });
  }

  async resetAll(): Promise<void> {
    await prisma.rateLimitCounter.deleteMany({ where: { key: { startsWith: `${this.keyPrefix}:` } } });
  }
}

/** Forget expired counters (and the IP addresses in their keys). Expiry
 *  itself is decided by comparison, so this never changes a limit. */
export function sweepExpiredRateLimits(): Promise<number> {
  return prisma.rateLimitCounter
    .deleteMany({ where: { expiresAt: { lt: new Date() } } })
    .then((r) => r.count);
}
