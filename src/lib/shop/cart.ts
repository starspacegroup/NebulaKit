/**
 * The shopper's cart, kept in the browser (localStorage) until checkout.
 *
 * The name, price and type stored on a line are for display only. The server
 * prices every line from the catalog at checkout (`POST /api/v1/checkout`), so
 * a tampered cart can change what the shopper sees but never what they pay.
 */
import { MAX_QUANTITY } from '@nebulakit/commerce';

export const CART_STORAGE_KEY = 'nebulakit-cart';

export interface CartItem {
	productId: string;
	slug: string;
	name: string;
	/** Display only. */
	unitPriceCents: number;
	currency: string;
	/** Physical products need a shipping address at checkout. */
	physical: boolean;
	quantity: number;
}

export type Cart = CartItem[];

const clamp = (quantity: number) => Math.min(Math.max(Math.trunc(quantity) || 1, 1), MAX_QUANTITY);

/** Add a product, or raise its quantity if it is already in the cart. */
export function addToCart(cart: Cart, item: CartItem): Cart {
	const quantity = clamp(item.quantity);
	const existing = cart.find((line) => line.productId === item.productId);
	if (!existing) return [...cart, { ...item, quantity }];
	return cart.map((line) =>
		line.productId === item.productId
			? { ...item, quantity: clamp(line.quantity + quantity) }
			: line
	);
}

/** Set a line's quantity. Zero or less removes it. */
export function setQuantity(cart: Cart, productId: string, quantity: number): Cart {
	if (!(quantity >= 1)) return removeFromCart(cart, productId);
	return cart.map((line) =>
		line.productId === productId ? { ...line, quantity: clamp(quantity) } : line
	);
}

export function removeFromCart(cart: Cart, productId: string): Cart {
	return cart.filter((line) => line.productId !== productId);
}

export const cartCount = (cart: Cart): number => cart.reduce((n, line) => n + line.quantity, 0);

export const cartSubtotalCents = (cart: Cart): number =>
	cart.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0);

export const needsShipping = (cart: Cart): boolean => cart.some((line) => line.physical);

/** What `POST /api/v1/checkout` wants for `lines`. */
export const checkoutLines = (cart: Cart) =>
	cart.map((line) => ({ productId: line.productId, quantity: line.quantity }));

function isItem(value: unknown): value is CartItem {
	if (!value || typeof value !== 'object') return false;
	const v = value as Record<string, unknown>;
	return (
		typeof v.productId === 'string' &&
		typeof v.slug === 'string' &&
		typeof v.name === 'string' &&
		Number.isInteger(v.unitPriceCents) &&
		typeof v.currency === 'string' &&
		typeof v.physical === 'boolean' &&
		Number.isInteger(v.quantity) &&
		(v.quantity as number) >= 1 &&
		(v.quantity as number) <= MAX_QUANTITY
	);
}

/** Read a stored cart. Anything unreadable or malformed becomes an empty cart. */
export function parseCart(raw: string | null): Cart {
	if (!raw) return [];
	try {
		const parsed: unknown = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed.filter(isItem) : [];
	} catch {
		return [];
	}
}

/** Storage can be missing or throw (private windows, blocked site data); the cart then lives for the visit only. */
export function loadCart(storage: Pick<Storage, 'getItem'> | undefined): Cart {
	try {
		return parseCart(storage?.getItem(CART_STORAGE_KEY) ?? null);
	} catch {
		return [];
	}
}

export function saveCart(storage: Pick<Storage, 'setItem'> | undefined, cart: Cart): void {
	try {
		storage?.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
	} catch {
		// Not saved; the page still holds the cart in memory.
	}
}
