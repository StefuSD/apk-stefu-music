/**
 * Buying Pro, in one place.
 *
 * The Pro sheet and the Pro row in Settings talk only to these three
 * functions, so wiring Google Play billing is a change to this file alone.
 * Until then the store is "not ready": no prices, a purchase answers
 * 'unavailable', a restore finds nothing — and the app behaves as before.
 *
 * Stefu Music has one product: a one-time purchase `pro_lifetime` (4,99 $).
 */

/** True once purchases actually work; shows the plan, the buy button and "Restore purchase". */
export const BILLING_READY = false;

export const PRODUCTS = { life: 'pro_lifetime' };

/** The price as the store shows it ("4,99 $", "89 MDL"), or null. */
export async function getPrices() {
  return { life: null };
}

/**
 * Buys Pro. Resolves to
 *   { ok: true }                         — paid, Pro is the buyer's
 *   { ok: false, reason: 'cancelled' }   — the buyer stepped back
 *   { ok: false, reason: 'unavailable' } — the store is not wired yet
 *   { ok: false, reason: 'error', message }
 */
export async function buy(_plan) {
  return { ok: false, reason: 'unavailable' };
}

/** Asks the store what this account already owns. { owned: boolean } */
export async function restore() {
  return { owned: false };
}
