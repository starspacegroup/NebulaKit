-- listProducts() runs `ORDER BY created_at DESC, slug LIMIT ?`, with `WHERE active = 1` for the public
-- list. With no index every call scanned the whole products table and sorted it in a temp b-tree, so
-- rows read grew with the catalogue on every visit (PinFool: ~2,800 rows a call, 2026-11-16; see
-- docs/FREE_TIER_GUARD_RAILS.md). These two indexes turn both queries into a range seek that stops at
-- LIMIT. `unlisted`/`draft` filters (sites that add them) need their own index; see the guide.
CREATE INDEX IF NOT EXISTS idx_commerce_products_listing
	ON commerce_products (active, created_at DESC, slug);
CREATE INDEX IF NOT EXISTS idx_commerce_products_created
	ON commerce_products (created_at DESC, slug);
