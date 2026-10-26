-- @nebulakit/commerce: products, orders and order lines.
--
-- Money is stored as INTEGER CENTS. Ammoura (where this shop was carved out
-- of) stored floats and rounded at every step; integers make rounding a
-- property of the schema instead of a habit of the code.
--
-- Orders copy the product name and unit price onto each line at checkout, so
-- editing or deleting a product never rewrites what a customer was charged.

CREATE TABLE IF NOT EXISTS commerce_products (
	id TEXT PRIMARY KEY,
	slug TEXT NOT NULL UNIQUE,
	name TEXT NOT NULL,
	description TEXT NOT NULL DEFAULT '',
	price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
	currency TEXT NOT NULL DEFAULT 'usd',
	image_url TEXT,
	-- 'physical' | 'digital'. Regional pricing and fulfilment both branch on it.
	type TEXT NOT NULL DEFAULT 'physical',
	-- Printful sync variant id for print-on-demand products; NULL otherwise.
	printful_variant_id INTEGER,
	active INTEGER NOT NULL DEFAULT 1,
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS commerce_orders (
	id TEXT PRIMARY KEY,
	-- pending → paid → fulfilling → shipped → delivered; any pre-ship state → cancelled.
	-- The allowed moves live in packages/commerce/src/orders.ts.
	status TEXT NOT NULL DEFAULT 'pending',
	email TEXT NOT NULL,
	currency TEXT NOT NULL DEFAULT 'usd',
	subtotal_cents INTEGER NOT NULL,
	shipping_cents INTEGER NOT NULL DEFAULT 0,
	tax_cents INTEGER NOT NULL DEFAULT 0,
	total_cents INTEGER NOT NULL,
	-- JSON shipping address; PII, so the API masks it unless the caller holds orders:read.
	shipping_address TEXT,
	payment_provider TEXT,
	payment_reference TEXT,
	fulfillment_reference TEXT,
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS commerce_order_items (
	id TEXT PRIMARY KEY,
	order_id TEXT NOT NULL REFERENCES commerce_orders(id) ON DELETE CASCADE,
	product_id TEXT,
	name TEXT NOT NULL,
	unit_price_cents INTEGER NOT NULL,
	quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 999),
	line_total_cents INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_commerce_order_items_order ON commerce_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_commerce_orders_created ON commerce_orders(created_at);
