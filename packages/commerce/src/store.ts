/**
 * D1 storage for the shop: `commerce_products`, `commerce_orders`,
 * `commerce_order_items` (migration 0016). One site, one database — there is
 * no tenant column, because every client has their own NebulaKit site.
 */
import type { D1Database } from '@cloudflare/workers-types';
import type { PricedCart } from './cart';
import { canTransition } from './orders';
import { parseRegionalPricing, type RegionalPricingSettings } from './regional';
import { EMPTY_GOOGLE, type GoogleAttributes } from './google-listing';
import type {
	Order,
	OrderItem,
	OrderRegionalPricing,
	OrderStatus,
	Product,
	ProductInput,
	ProductType,
	ShippingAddress
} from './types';

type Row = Record<string, unknown>;

export class CommerceConflictError extends Error {
	readonly status = 409;
}

/** One mapper for every place a product row is read (feed pages included). */
export function productFromRow(row: Record<string, unknown>): Product {
	return toProduct(row);
}

function toProduct(row: Row): Product {
	return {
		id: row.id as string,
		slug: row.slug as string,
		name: row.name as string,
		description: row.description as string,
		priceCents: Number(row.price_cents),
		currency: row.currency as string,
		imageUrl: (row.image_url as string | null) ?? null,
		type: row.type as ProductType,
		printfulVariantId: row.printful_variant_id == null ? null : Number(row.printful_variant_id),
		active: Number(row.active) === 1,
		google: toGoogle(row),
		createdAt: row.created_at as string,
		updatedAt: row.updated_at as string
	};
}

const text = (v: unknown) => (typeof v === 'string' && v !== '' ? v : null);
const int = (v: unknown) => (v == null ? null : Number(v));
const flag = (v: unknown) => (v == null ? null : Number(v) === 1);

function imageList(raw: unknown): string[] {
	if (typeof raw !== 'string' || !raw) return [];
	try {
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed.filter((u): u is string => typeof u === 'string') : [];
	} catch {
		// an unreadable list reads as "no extra images"; the product still sells
		return [];
	}
}

/** The Google columns of a row (migration 0037). A row from before it reads as all-empty. */
function toGoogle(row: Row): GoogleAttributes {
	return {
		...EMPTY_GOOGLE,
		brand: text(row.brand),
		gtin: text(row.gtin),
		mpn: text(row.mpn),
		condition: text(row.condition) as GoogleAttributes['condition'],
		googleProductCategory: text(row.google_product_category),
		productType: text(row.product_type),
		availability: text(row.availability) as GoogleAttributes['availability'],
		availabilityDate: text(row.availability_date),
		salePriceCents: int(row.sale_price_cents),
		saleStartsAt: text(row.sale_starts_at),
		saleEndsAt: text(row.sale_ends_at),
		additionalImages: imageList(row.additional_images),
		color: text(row.color),
		size: text(row.size),
		material: text(row.material),
		gender: text(row.gender) as GoogleAttributes['gender'],
		ageGroup: text(row.age_group) as GoogleAttributes['ageGroup'],
		itemGroupId: text(row.item_group_id),
		identifierExists: flag(row.identifier_exists),
		weightGrams: int(row.weight_grams),
		lengthMm: int(row.length_mm),
		widthMm: int(row.width_mm),
		heightMm: int(row.height_mm),
		adult: flag(row.adult) === true,
		customLabel0: text(row.custom_label_0),
		customLabel1: text(row.custom_label_1),
		customLabel2: text(row.custom_label_2),
		customLabel3: text(row.custom_label_3),
		customLabel4: text(row.custom_label_4),
		excluded: Number(row.google_excluded ?? 0) === 1
	};
}

/** Attribute -> column, fixed here so a request can never name a column. */
const GOOGLE_COLUMNS: Record<keyof GoogleAttributes, string> = {
	brand: 'brand',
	gtin: 'gtin',
	mpn: 'mpn',
	condition: 'condition',
	googleProductCategory: 'google_product_category',
	productType: 'product_type',
	availability: 'availability',
	availabilityDate: 'availability_date',
	salePriceCents: 'sale_price_cents',
	saleStartsAt: 'sale_starts_at',
	saleEndsAt: 'sale_ends_at',
	additionalImages: 'additional_images',
	color: 'color',
	size: 'size',
	material: 'material',
	gender: 'gender',
	ageGroup: 'age_group',
	itemGroupId: 'item_group_id',
	identifierExists: 'identifier_exists',
	weightGrams: 'weight_grams',
	lengthMm: 'length_mm',
	widthMm: 'width_mm',
	heightMm: 'height_mm',
	adult: 'adult',
	customLabel0: 'custom_label_0',
	customLabel1: 'custom_label_1',
	customLabel2: 'custom_label_2',
	customLabel3: 'custom_label_3',
	customLabel4: 'custom_label_4',
	excluded: 'google_excluded'
};

/** [column, bound value] for every Google attribute present in a patch. */
function googleAssignments(google: Partial<GoogleAttributes> | undefined): [string, unknown][] {
	const out: [string, unknown][] = [];
	if (!google) return out;
	for (const [key, column] of Object.entries(GOOGLE_COLUMNS)) {
		const value = google[key as keyof GoogleAttributes];
		if (value === undefined) continue;
		if (key === 'additionalImages')
			out.push([column, (value as string[]).length ? JSON.stringify(value) : null]);
		else if (typeof value === 'boolean') out.push([column, value ? 1 : 0]);
		else out.push([column, value]);
	}
	return out;
}

function parseAddress(raw: unknown): ShippingAddress | null {
	if (typeof raw !== 'string' || !raw) return null;
	try {
		return JSON.parse(raw) as ShippingAddress;
	} catch {
		return null;
	}
}

function toRegional(row: Row | null): OrderRegionalPricing | null {
	if (!row) return null;
	let countries: Record<string, string | null> = {};
	try {
		const parsed = JSON.parse(String(row.countries));
		if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) countries = parsed;
	} catch {
		// an unreadable audit blob must not hide the order it describes
	}
	return {
		multiplier: Number(row.multiplier_percent) / 100,
		countries,
		baseSubtotalCents: Number(row.base_subtotal_cents)
	};
}

function toOrder(row: Row, items: OrderItem[], regional: OrderRegionalPricing | null): Order {
	return {
		id: row.id as string,
		status: row.status as OrderStatus,
		email: row.email as string,
		currency: row.currency as string,
		subtotalCents: Number(row.subtotal_cents),
		shippingCents: Number(row.shipping_cents),
		taxCents: Number(row.tax_cents),
		totalCents: Number(row.total_cents),
		shippingAddress: parseAddress(row.shipping_address),
		paymentProvider: (row.payment_provider as string | null) ?? null,
		paymentReference: (row.payment_reference as string | null) ?? null,
		fulfillmentReference: (row.fulfillment_reference as string | null) ?? null,
		regional,
		items,
		createdAt: row.created_at as string,
		updatedAt: row.updated_at as string
	};
}

function toItem(row: Row): OrderItem {
	return {
		id: row.id as string,
		productId: (row.product_id as string | null) ?? null,
		name: row.name as string,
		unitPriceCents: Number(row.unit_price_cents),
		quantity: Number(row.quantity),
		lineTotalCents: Number(row.line_total_cents)
	};
}

function isUniqueViolation(err: unknown): boolean {
	return err instanceof Error && /UNIQUE constraint failed/i.test(err.message);
}

export async function listProducts(
	db: D1Database,
	options: { includeInactive?: boolean; limit?: number } = {}
): Promise<Product[]> {
	const limit = Math.min(Math.max(options.limit ?? 100, 1), 500);
	const where = options.includeInactive ? '' : 'WHERE active = 1';
	const { results } = await db
		.prepare(`SELECT * FROM commerce_products ${where} ORDER BY created_at DESC, slug LIMIT ?`)
		.bind(limit)
		.all<Row>();
	return results.map(toProduct);
}

export async function getProduct(db: D1Database, idOrSlug: string): Promise<Product | null> {
	const row = await db
		.prepare('SELECT * FROM commerce_products WHERE id = ? OR slug = ? LIMIT 1')
		.bind(idOrSlug, idOrSlug)
		.first<Row>();
	return row ? toProduct(row) : null;
}

export async function createProduct(db: D1Database, input: ProductInput): Promise<Product> {
	const id = crypto.randomUUID();
	const columns: [string, unknown][] = [
		['id', id],
		['slug', input.slug],
		['name', input.name],
		['description', input.description ?? ''],
		['price_cents', input.priceCents],
		['currency', input.currency ?? 'usd'],
		['image_url', input.imageUrl ?? null],
		['type', input.type ?? 'physical'],
		['printful_variant_id', input.printfulVariantId ?? null],
		['active', input.active === false ? 0 : 1],
		...googleAssignments(input.google)
	];
	try {
		await db
			.prepare(
				`INSERT INTO commerce_products (${columns.map(([c]) => c).join(', ')})
				 VALUES (${columns.map(() => '?').join(', ')})`
			)
			.bind(...columns.map(([, v]) => v))
			.run();
	} catch (err) {
		if (isUniqueViolation(err)) throw new CommerceConflictError(`Slug "${input.slug}" is taken`);
		throw err;
	}
	return (await getProduct(db, id)) as Product;
}

const PRODUCT_COLUMNS: Record<Exclude<keyof ProductInput, 'google'>, string> = {
	slug: 'slug',
	name: 'name',
	description: 'description',
	priceCents: 'price_cents',
	currency: 'currency',
	imageUrl: 'image_url',
	type: 'type',
	printfulVariantId: 'printful_variant_id',
	active: 'active'
};

export async function updateProduct(
	db: D1Database,
	id: string,
	patch: Partial<ProductInput>
): Promise<Product | null> {
	const sets: string[] = [];
	const values: unknown[] = [];
	// Column names come from the fixed map above, never from the request.
	for (const [key, column] of Object.entries(PRODUCT_COLUMNS)) {
		const value = patch[key as keyof typeof PRODUCT_COLUMNS];
		if (value === undefined) continue;
		sets.push(`${column} = ?`);
		values.push(typeof value === 'boolean' ? (value ? 1 : 0) : value);
	}
	for (const [column, value] of googleAssignments(patch.google)) {
		sets.push(`${column} = ?`);
		values.push(value);
	}
	if (sets.length) {
		try {
			await db
				.prepare(
					`UPDATE commerce_products SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ?`
				)
				.bind(...values, id)
				.run();
		} catch (err) {
			if (isUniqueViolation(err)) throw new CommerceConflictError('Slug is taken');
			throw err;
		}
	}
	const row = await db
		.prepare('SELECT * FROM commerce_products WHERE id = ?')
		.bind(id)
		.first<Row>();
	return row ? toProduct(row) : null;
}

export async function deleteProduct(db: D1Database, id: string): Promise<boolean> {
	const result = await db.prepare('DELETE FROM commerce_products WHERE id = ?').bind(id).run();
	return (result.meta?.changes ?? 0) > 0;
}

export async function createOrder(
	db: D1Database,
	cart: PricedCart,
	details: {
		email: string;
		shippingAddress: ShippingAddress | null;
		paymentProvider: string;
		/** Written beside the order when regional pricing was on; see migration 0022. */
		regional?: OrderRegionalPricing | null;
		/** The cart page's id for this checkout (migration 0034); unique, so a double submit finds this order. */
		checkoutKey?: string | null;
	}
): Promise<Order> {
	const orderId = crypto.randomUUID();
	const statements = [
		db
			.prepare(
				`INSERT INTO commerce_orders
				 (id, status, email, currency, subtotal_cents, shipping_cents, tax_cents, total_cents, shipping_address, payment_provider, checkout_key)
				 VALUES (?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
			)
			.bind(
				orderId,
				details.email,
				cart.currency,
				cart.subtotalCents,
				cart.shippingCents,
				cart.taxCents,
				cart.totalCents,
				details.shippingAddress ? JSON.stringify(details.shippingAddress) : null,
				details.paymentProvider,
				details.checkoutKey ?? null
			),
		...itemStatements(db, orderId, cart),
		...regionalStatements(db, orderId, details.regional)
	];
	// One batch: an order never exists without its lines (or its audit row).
	try {
		await db.batch(statements);
	} catch (err) {
		if (details.checkoutKey && isUniqueViolation(err)) {
			throw new CommerceConflictError('This checkout already has an order');
		}
		throw err;
	}
	return (await getOrder(db, orderId)) as Order;
}

function itemStatements(db: D1Database, orderId: string, cart: PricedCart) {
	return cart.lines.map((line) =>
		db
			.prepare(
				`INSERT INTO commerce_order_items
					 (id, order_id, product_id, name, unit_price_cents, quantity, line_total_cents)
					 VALUES (?, ?, ?, ?, ?, ?, ?)`
			)
			.bind(
				crypto.randomUUID(),
				orderId,
				line.product.id,
				line.product.name,
				line.unitPriceCents,
				line.quantity,
				line.lineTotalCents
			)
	);
}

function regionalStatements(
	db: D1Database,
	orderId: string,
	regional: OrderRegionalPricing | null | undefined
) {
	return regional
		? [
				db
					.prepare(
						`INSERT INTO commerce_order_regional
						 (order_id, multiplier_percent, countries, base_subtotal_cents)
						 VALUES (?, ?, ?, ?)`
					)
					.bind(
						orderId,
						Math.round(regional.multiplier * 100),
						JSON.stringify(regional.countries),
						regional.baseSubtotalCents
					)
			]
		: [];
}

/** The order a cart checkout made, by the cart page's checkout key (migration 0034). */
export async function findOrderByCheckoutKey(
	db: D1Database,
	checkoutKey: string
): Promise<Order | null> {
	const row = await db
		.prepare('SELECT id FROM commerce_orders WHERE checkout_key = ?')
		.bind(checkoutKey)
		.first<Row>();
	return row ? getOrder(db, row.id as string) : null;
}

/**
 * Reprice a pending order in place: the cart changed between the first "Pay" and the payment, so
 * the order's lines, totals, email, address and regional audit are replaced with a fresh server-side
 * pricing, and `payment_revision` moves from `expectedRevision` to `expectedRevision + 1`.
 *
 * One batch, which D1 runs as one transaction. The first statement is a compare-and-set on
 * (pending, expected revision) that stamps a fresh nonce; every later statement only acts on the
 * row carrying that nonce. So a reprice that lost a race, or an order paid a moment ago, changes
 * nothing at all — never the totals without the lines, never lines on a paid order.
 *
 * Returns the repriced order and its new revision, or null when it was not repriced.
 */
export async function repriceOrder(
	db: D1Database,
	orderId: string,
	expectedRevision: number,
	cart: PricedCart,
	details: {
		email: string;
		shippingAddress: ShippingAddress | null;
		regional?: OrderRegionalPricing | null;
	}
): Promise<{ order: Order; revision: number } | null> {
	const nonce = crypto.randomUUID();
	const ours = `EXISTS (SELECT 1 FROM commerce_orders WHERE id = ? AND payment_nonce = ? AND status = 'pending')`;
	await db.batch([
		db
			.prepare(
				`UPDATE commerce_orders
				 SET email = ?, currency = ?, subtotal_cents = ?, shipping_cents = ?, tax_cents = ?,
				     total_cents = ?, shipping_address = ?, payment_revision = payment_revision + 1,
				     payment_nonce = ?, updated_at = datetime('now')
				 WHERE id = ? AND status = 'pending' AND payment_revision = ?`
			)
			.bind(
				details.email,
				cart.currency,
				cart.subtotalCents,
				cart.shippingCents,
				cart.taxCents,
				cart.totalCents,
				details.shippingAddress ? JSON.stringify(details.shippingAddress) : null,
				nonce,
				orderId,
				expectedRevision
			),
		db
			.prepare(`DELETE FROM commerce_order_items WHERE order_id = ? AND ${ours}`)
			.bind(orderId, orderId, nonce),
		db
			.prepare(`DELETE FROM commerce_order_regional WHERE order_id = ? AND ${ours}`)
			.bind(orderId, orderId, nonce),
		...cart.lines.map((line) =>
			db
				.prepare(
					`INSERT INTO commerce_order_items
					 (id, order_id, product_id, name, unit_price_cents, quantity, line_total_cents)
					 SELECT ?, ?, ?, ?, ?, ?, ? WHERE ${ours}`
				)
				.bind(
					crypto.randomUUID(),
					orderId,
					line.product.id,
					line.product.name,
					line.unitPriceCents,
					line.quantity,
					line.lineTotalCents,
					orderId,
					nonce
				)
		),
		...(details.regional
			? [
					db
						.prepare(
							`INSERT INTO commerce_order_regional
							 (order_id, multiplier_percent, countries, base_subtotal_cents)
							 SELECT ?, ?, ?, ? WHERE ${ours}`
						)
						.bind(
							orderId,
							Math.round(details.regional.multiplier * 100),
							JSON.stringify(details.regional.countries),
							details.regional.baseSubtotalCents,
							orderId,
							nonce
						)
				]
			: [])
	]);
	const row = await db
		.prepare('SELECT payment_revision, payment_nonce FROM commerce_orders WHERE id = ?')
		.bind(orderId)
		.first<Row>();
	if (!row || row.payment_nonce !== nonce) return null;
	const order = await getOrder(db, orderId);
	return order ? { order, revision: Number(row.payment_revision) } : null;
}

/** How many times a pending order has been repriced (migration 0034). 0 for one never repriced. */
export async function getPaymentRevision(db: D1Database, orderId: string): Promise<number | null> {
	const row = await db
		.prepare('SELECT payment_revision FROM commerce_orders WHERE id = ?')
		.bind(orderId)
		.first<Row>();
	return row ? Number(row.payment_revision ?? 0) : null;
}

export async function getOrder(db: D1Database, id: string): Promise<Order | null> {
	const row = await db.prepare('SELECT * FROM commerce_orders WHERE id = ?').bind(id).first<Row>();
	if (!row) return null;
	const { results } = await db
		.prepare('SELECT * FROM commerce_order_items WHERE order_id = ? ORDER BY rowid')
		.bind(id)
		.all<Row>();
	const regional = await db
		.prepare('SELECT * FROM commerce_order_regional WHERE order_id = ?')
		.bind(id)
		.first<Row>();
	return toOrder(row, results.map(toItem), toRegional(regional));
}

/**
 * Just an order's status, for the public status poll. Nothing else about the
 * order is read, so nothing else can leak through the caller.
 */
export async function getOrderStatus(db: D1Database, id: string): Promise<OrderStatus | null> {
	const row = await db
		.prepare('SELECT status FROM commerce_orders WHERE id = ?')
		.bind(id)
		.first<Row>();
	return row ? (row.status as OrderStatus) : null;
}

export async function listOrders(
	db: D1Database,
	options: { status?: OrderStatus; limit?: number } = {}
): Promise<Order[]> {
	const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
	const query = options.status
		? db
				.prepare('SELECT * FROM commerce_orders WHERE status = ? ORDER BY created_at DESC LIMIT ?')
				.bind(options.status, limit)
		: db.prepare('SELECT * FROM commerce_orders ORDER BY created_at DESC LIMIT ?').bind(limit);
	const { results } = await query.all<Row>();
	// Lists carry totals, not lines; one order's lines are a GET away.
	return results.map((row) => toOrder(row, [], null));
}

/**
 * Move an order to a new status, refusing moves `orders.ts` does not allow.
 * The `WHERE status = ?` makes it a compare-and-set: two racing updates cannot
 * both win from the same starting state.
 */
export async function transitionOrder(
	db: D1Database,
	id: string,
	to: OrderStatus,
	refs: { paymentReference?: string; fulfillmentReference?: string } = {}
): Promise<Order | null> {
	const current = await getOrder(db, id);
	if (!current) return null;
	if (!canTransition(current.status, to)) {
		throw new CommerceConflictError(`An order cannot move from ${current.status} to ${to}`);
	}
	const result = await db
		.prepare(
			`UPDATE commerce_orders
			 SET status = ?,
			     payment_reference = COALESCE(?, payment_reference),
			     fulfillment_reference = COALESCE(?, fulfillment_reference),
			     updated_at = datetime('now')
			 WHERE id = ? AND status = ?`
		)
		.bind(to, refs.paymentReference ?? null, refs.fulfillmentReference ?? null, id, current.status)
		.run();
	if ((result.meta?.changes ?? 0) === 0) {
		throw new CommerceConflictError('The order changed while it was being updated');
	}
	return getOrder(db, id);
}

/**
 * Set where a pending order ships. Only a pending order can change address: once
 * it is paid, the address is what the customer was charged shipping for.
 */
export async function setOrderShippingAddress(
	db: D1Database,
	id: string,
	address: ShippingAddress
): Promise<boolean> {
	const result = await db
		.prepare(
			`UPDATE commerce_orders SET shipping_address = ?, updated_at = datetime('now')
			 WHERE id = ? AND status = 'pending'`
		)
		.bind(JSON.stringify(address), id)
		.run();
	return (result.meta?.changes ?? 0) > 0;
}

/** Record the provider's reference (e.g. a Stripe session id) without moving the order. */
export async function setPaymentReference(
	db: D1Database,
	id: string,
	reference: string
): Promise<void> {
	await db
		.prepare(
			"UPDATE commerce_orders SET payment_reference = ?, updated_at = datetime('now') WHERE id = ?"
		)
		.bind(reference, id)
		.run();
}

/** The settings row for `key`, or null when it was never saved. */
export async function getCommerceSetting(db: D1Database, key: string): Promise<string | null> {
	const row = await db
		.prepare('SELECT value FROM commerce_settings WHERE key = ?')
		.bind(key)
		.first<Row>();
	return row ? (row.value as string) : null;
}

export async function setCommerceSetting(
	db: D1Database,
	key: string,
	value: string
): Promise<void> {
	await db
		.prepare(
			`INSERT INTO commerce_settings (key, value) VALUES (?, ?)
			 ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
		)
		.bind(key, value)
		.run();
}

const REGIONAL_PRICING_KEY = 'regional_pricing';

/**
 * Regional pricing settings. A missing or corrupt row reads as the defaults,
 * which are OFF: the safe direction is charging the catalog price.
 */
export async function getRegionalPricingSettings(db: D1Database): Promise<RegionalPricingSettings> {
	const raw = await getCommerceSetting(db, REGIONAL_PRICING_KEY);
	if (raw === null) return parseRegionalPricing(null);
	try {
		return parseRegionalPricing(JSON.parse(raw));
	} catch {
		return parseRegionalPricing(null);
	}
}

export async function saveRegionalPricingSettings(
	db: D1Database,
	settings: RegionalPricingSettings
): Promise<RegionalPricingSettings> {
	// Normalise on the way in as well, so what is stored is always what is read.
	const safe = parseRegionalPricing(settings);
	await setCommerceSetting(db, REGIONAL_PRICING_KEY, JSON.stringify(safe));
	return safe;
}
