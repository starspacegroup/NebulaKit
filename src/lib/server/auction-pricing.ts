import type { OrderPricing } from '@nebulakit/commerce';
import { flatShippingFromEnv, taxRuleFromEnv, type CommerceEnv } from './site-info';

/** Tax, shipping and payment provider for a won auction's order, from the deployed settings. */
export function auctionPricing(env: CommerceEnv): OrderPricing {
	return {
		taxRule: taxRuleFromEnv(env),
		shippingCents: flatShippingFromEnv(env),
		paymentProvider: env.STRIPE_SECRET_KEY ? 'stripe' : 'manual'
	};
}
