export type ProductType = 'physical' | 'digital';

export interface Product {
	id: string;
	slug: string;
	name: string;
	description: string;
	priceCents: number;
	currency: string;
	imageUrl: string | null;
	type: ProductType;
	printfulVariantId: number | null;
	active: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface ProductInput {
	slug: string;
	name: string;
	description?: string;
	priceCents: number;
	currency?: string;
	imageUrl?: string | null;
	type?: ProductType;
	printfulVariantId?: number | null;
	active?: boolean;
}

export interface ShippingAddress {
	name: string;
	line1: string;
	line2?: string;
	city: string;
	state?: string;
	postalCode: string;
	/** ISO 3166-1 alpha-2. */
	country: string;
}

export const ORDER_STATUSES = [
	'pending',
	'paid',
	'fulfilling',
	'shipped',
	'delivered',
	'cancelled'
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface OrderItem {
	id: string;
	productId: string | null;
	name: string;
	unitPriceCents: number;
	quantity: number;
	lineTotalCents: number;
}

/**
 * How regional pricing treated an order, kept so the discount is auditable.
 * Present only for orders placed while regional pricing was on.
 */
export interface OrderRegionalPricing {
	/** 1 is full price, 0.7 is 30% off. */
	multiplier: number;
	/** The countries considered, by source: `request`, `shipping`, `billing`. Null = could not be placed. */
	countries: Record<string, string | null>;
	/** What the order would have cost at catalog prices. */
	baseSubtotalCents: number;
}

export interface Order {
	id: string;
	status: OrderStatus;
	email: string;
	currency: string;
	subtotalCents: number;
	shippingCents: number;
	taxCents: number;
	totalCents: number;
	shippingAddress: ShippingAddress | null;
	paymentProvider: string | null;
	paymentReference: string | null;
	fulfillmentReference: string | null;
	/** Null when regional pricing was off for this order. */
	regional: OrderRegionalPricing | null;
	items: OrderItem[];
	createdAt: string;
	updatedAt: string;
}
