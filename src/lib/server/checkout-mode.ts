/**
 * How a site takes card payments (docs/CHECKOUT.md):
 *
 * - `onpage` (default): the Stripe Payment Element in the site's own cart, paying a PaymentIntent.
 *   Needs `STRIPE_SECRET_KEY` and a valid `STRIPE_PUBLISHABLE_KEY`.
 * - `hosted`: the shopper is sent to Stripe Checkout and comes back. Needs `STRIPE_SECRET_KEY`.
 * - Without `STRIPE_SECRET_KEY` the order waits for a manual payment, whatever the mode says.
 *
 * The mode is the `CHECKOUT_MODE` variable when it is set to a known value, else the
 * `checkout_mode` row of `commerce_settings`, else `onpage`. An on-page mode without a usable
 * publishable key falls back to `hosted`, so a half-configured site still takes payment.
 */
import type { D1Database } from '@cloudflare/workers-types';
import { getCommerceSetting, isStripePublishableKey } from '@nebulakit/commerce';
import type { CommerceEnv } from './site-info';

export const CHECKOUT_MODES = ['onpage', 'hosted'] as const;
export type CheckoutMode = (typeof CHECKOUT_MODES)[number];
export const CHECKOUT_MODE_SETTING = 'checkout_mode';

export function parseCheckoutMode(value: unknown): CheckoutMode | null {
	return typeof value === 'string' && (CHECKOUT_MODES as readonly string[]).includes(value)
		? (value as CheckoutMode)
		: null;
}

export interface CheckoutConfig {
	provider: 'stripe' | 'manual';
	mode: CheckoutMode;
	/** Only when the card form can be drawn: provider stripe, mode onpage, a valid key. */
	publishableKey: string | null;
}

export async function resolveCheckout(
	db: D1Database | null | undefined,
	env: CommerceEnv
): Promise<CheckoutConfig> {
	let mode = parseCheckoutMode(env.CHECKOUT_MODE);
	if (!mode && db) {
		try {
			mode = parseCheckoutMode(await getCommerceSetting(db, CHECKOUT_MODE_SETTING));
		} catch {
			// An unreadable setting is the default, not an outage.
		}
	}
	mode ??= 'onpage';
	if (!env.STRIPE_SECRET_KEY) return { provider: 'manual', mode, publishableKey: null };
	if (mode === 'onpage' && isStripePublishableKey(env.STRIPE_PUBLISHABLE_KEY)) {
		return { provider: 'stripe', mode, publishableKey: env.STRIPE_PUBLISHABLE_KEY };
	}
	return { provider: 'stripe', mode: 'hosted', publishableKey: null };
}
