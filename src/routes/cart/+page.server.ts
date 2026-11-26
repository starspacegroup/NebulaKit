import { resolveCheckout } from '$lib/server/checkout-mode';
import type { CommerceEnv } from '$lib/server/site-info';
import type { PageServerLoad } from './$types';

/**
 * How this cart takes payment (src/lib/server/checkout-mode.ts). Only what the browser needs:
 * the mode, and the Stripe publishable key when the card form is drawn here (it is meant for the
 * browser). Never a price: the page shows the server's quote and the server charges its own total.
 */
export const load: PageServerLoad = async ({ platform }) => {
	const env = (platform?.env ?? {}) as CommerceEnv & { DB?: App.Platform['env']['DB'] };
	const config = await resolveCheckout(env.DB, env);
	return {
		checkout: {
			provider: config.provider,
			mode: config.mode,
			publishableKey: config.publishableKey
		}
	};
};
