/**
 * Two-factor for the Hub as a whole.
 *
 * ⚠️ OFF since 2026-11-18 (Josh: "turn off 2FA for everyone, for now"). While
 * it is off:
 * - no account is REQUIRED to have two-factor: requireAuth never answers
 *   `mfa_setup_required`, invites create accounts without `mfa_required`, and
 *   `users:admin --super-admin` does not set it;
 * - the super admin's routes need the role only, not a 2FA session
 *   (requireSuperAdmin, isSuperAdminSession);
 * - "Require two-factor" on the Users page is refused (and hidden).
 *
 * A factor someone still HAS is still honoured: requireAuth asks such an
 * account for its code whatever this says. `npm run users:2fa-off-all`
 * removed every factor and requirement when this was turned off.
 *
 * To turn two-factor back on: set this AND `TWO_FACTOR_ON` in
 * frontend/src/lib/twoFactor.ts to true, deploy, then use "Require two-factor"
 * on the Users page (or `users:admin --super-admin` for the super admin). The
 * off-all script stamped `mfa_was_required` on each account, so it is known
 * who had it required before.
 */
export const TWO_FACTOR_ON = false;
