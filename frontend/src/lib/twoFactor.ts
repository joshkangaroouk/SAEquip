/**
 * Two-factor for the Hub as a whole: the dashboard's copy of `TWO_FACTOR_ON`
 * in backend/src/services/twoFactor.ts, which is the one that is enforced.
 * Change both together.
 *
 * ⚠️ OFF since 2026-11-18 (Josh). While it is off the dashboard hides what
 * would set two-factor up: adding an authenticator on Security, "Require
 * two-factor" on Users, and the set-up step after accepting an invite.
 */
export const TWO_FACTOR_ON = false;
