-- @nebulakit/commerce: shop settings, and the audit row for regional pricing.
--
-- commerce_settings is a small key/value table for owner-chosen shop
-- settings. Regional (purchasing-power) pricing is the first user: the key
-- 'regional_pricing' holds its settings as JSON. A key/value table (rather
-- than one column per setting) means the next setting needs no migration,
-- and an absent row means "never configured", which for regional pricing
-- means OFF: a site that never opted in charges the catalog price.
--
-- commerce_order_regional records how regional pricing treated an order:
-- the multiplier applied, the countries it was derived from, and what the
-- order would have cost at catalog prices. It is a separate table, not new
-- columns on commerce_orders, so the orders table stays untouched, orders
-- placed with the feature off carry no row at all, and the row survives
-- being read without a join. Money stays integer cents; the multiplier is
-- stored as a whole percent (70 = pays 70% of the catalog price).

CREATE TABLE IF NOT EXISTS commerce_settings (
	key TEXT PRIMARY KEY,
	value TEXT NOT NULL,
	updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS commerce_order_regional (
	order_id TEXT PRIMARY KEY REFERENCES commerce_orders(id) ON DELETE CASCADE,
	multiplier_percent INTEGER NOT NULL CHECK (multiplier_percent BETWEEN 1 AND 100),
	-- JSON object: { request, shipping, billing } -> ISO code or null.
	countries TEXT NOT NULL,
	base_subtotal_cents INTEGER NOT NULL CHECK (base_subtotal_cents >= 0),
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
