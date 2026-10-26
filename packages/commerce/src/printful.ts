/**
 * Printful fulfilment, ported from Ammoura's Printful client and relay
 * (2026-10-18) down to what a paid order needs: build the order request from
 * the site's own order, send it, read it back.
 *
 * Ammoura orders only already-designed store products, so lines carry a
 * `sync_variant_id` and no print files. Lines whose product has no Printful
 * variant (digital goods, things the merchant ships) are left out; an order
 * with none left is not sent at all.
 */
import type { Order, Product } from './types';

export interface PrintfulOrderRequest {
	external_id: string;
	shipping: 'STANDARD';
	recipient: {
		name: string;
		address1: string;
		address2?: string;
		city: string;
		state_code?: string;
		country_code: string;
		zip: string;
		email: string;
	};
	items: Array<{ sync_variant_id: number; quantity: number }>;
}

export class PrintfulError extends Error {
	constructor(
		message: string,
		readonly httpStatus: number
	) {
		super(message);
	}
}

export function buildPrintfulOrder(
	order: Order,
	productsById: Map<string, Pick<Product, 'printfulVariantId'>>
): PrintfulOrderRequest | null {
	if (!order.shippingAddress) return null;
	const items = order.items.flatMap((item) => {
		const variant = item.productId ? productsById.get(item.productId)?.printfulVariantId : null;
		return variant ? [{ sync_variant_id: variant, quantity: item.quantity }] : [];
	});
	if (items.length === 0) return null;
	const address = order.shippingAddress;
	return {
		// Printful dedupes on external_id, so a retried relay cannot double-order.
		external_id: order.id.replace(/-/g, '').slice(0, 32),
		shipping: 'STANDARD',
		recipient: {
			name: address.name,
			address1: address.line1,
			...(address.line2 ? { address2: address.line2 } : {}),
			city: address.city,
			...(address.state ? { state_code: address.state } : {}),
			country_code: address.country,
			zip: address.postalCode,
			email: order.email
		},
		items
	};
}

export class PrintfulClient {
	constructor(
		private readonly apiKey: string,
		private readonly fetchImpl: typeof fetch = fetch,
		private readonly apiUrl = 'https://api.printful.com'
	) {
		if (!apiKey?.trim()) throw new Error('Printful API key is required');
	}

	private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
		const response = await this.fetchImpl(`${this.apiUrl}${path}`, {
			...init,
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` }
		});
		let body: { code?: number; result?: T; error?: { message?: string } } = {};
		try {
			body = await response.json();
		} catch {
			// fall through to the status check with an empty body
		}
		if (!response.ok || (body.code !== undefined && body.code !== 200)) {
			throw new PrintfulError(
				body.error?.message ?? `Printful request failed (${response.status})`,
				response.status
			);
		}
		return body.result as T;
	}

	/** `confirm: false` leaves it a draft in Printful, which is how a site tests without spending. */
	createOrder(request: PrintfulOrderRequest, confirm = false): Promise<{ id: number }> {
		return this.request(`/orders${confirm ? '?confirm=1' : ''}`, {
			method: 'POST',
			body: JSON.stringify(request)
		});
	}

	getOrder(externalId: string): Promise<{ id: number; status: string }> {
		return this.request(`/orders/@${encodeURIComponent(externalId)}`);
	}
}
