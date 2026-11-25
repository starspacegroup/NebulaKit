-- @nebulakit/commerce: the product attributes Google Merchant Center asks for.
--
-- Everything is additive and nullable (docs/GOOGLE_LISTINGS.md): a product
-- that fills none of it behaves exactly as before. What is "valid" is not
-- decided here but in packages/commerce/src/google-listing.ts, so a row that
-- predates a rule is reported to the admin instead of being refused by SQL.
-- The CHECKs below are only the closed vocabularies Google itself defines.
--
-- Sale price and weight are integers (cents, grams); dimensions are whole
-- millimetres, so no money or measurement ever lives in a float.
--
-- Feed and sync settings (return policy, ship-to countries, default brand,
-- the opt-in Merchant API sync) live in the existing commerce_settings
-- key/value table, so they need no migration of their own.

ALTER TABLE commerce_products ADD COLUMN brand TEXT;
ALTER TABLE commerce_products ADD COLUMN gtin TEXT;
ALTER TABLE commerce_products ADD COLUMN mpn TEXT;
ALTER TABLE commerce_products ADD COLUMN condition TEXT
	CHECK (condition IS NULL OR condition IN ('new', 'refurbished', 'used'));
ALTER TABLE commerce_products ADD COLUMN google_product_category TEXT;
ALTER TABLE commerce_products ADD COLUMN product_type TEXT;
-- NULL = derive: in stock. The template keeps no stock count.
ALTER TABLE commerce_products ADD COLUMN availability TEXT
	CHECK (availability IS NULL OR availability IN ('in_stock', 'out_of_stock', 'preorder', 'backorder'));
-- ISO 8601 date the item ships; Google requires it for preorder and backorder.
ALTER TABLE commerce_products ADD COLUMN availability_date TEXT;
ALTER TABLE commerce_products ADD COLUMN sale_price_cents INTEGER
	CHECK (sale_price_cents IS NULL OR sale_price_cents >= 0);
-- ISO 8601 instants. Both NULL = the sale price applies until it is cleared.
ALTER TABLE commerce_products ADD COLUMN sale_starts_at TEXT;
ALTER TABLE commerce_products ADD COLUMN sale_ends_at TEXT;
-- JSON array of at most 10 image URLs.
ALTER TABLE commerce_products ADD COLUMN additional_images TEXT;
ALTER TABLE commerce_products ADD COLUMN color TEXT;
ALTER TABLE commerce_products ADD COLUMN size TEXT;
ALTER TABLE commerce_products ADD COLUMN material TEXT;
ALTER TABLE commerce_products ADD COLUMN gender TEXT
	CHECK (gender IS NULL OR gender IN ('male', 'female', 'unisex'));
ALTER TABLE commerce_products ADD COLUMN age_group TEXT
	CHECK (age_group IS NULL OR age_group IN ('newborn', 'infant', 'toddler', 'kids', 'adult'));
ALTER TABLE commerce_products ADD COLUMN item_group_id TEXT;
-- NULL = unset (Google assumes yes), 0 = no identifiers exist, 1 = they do.
ALTER TABLE commerce_products ADD COLUMN identifier_exists INTEGER
	CHECK (identifier_exists IS NULL OR identifier_exists IN (0, 1));
ALTER TABLE commerce_products ADD COLUMN weight_grams INTEGER
	CHECK (weight_grams IS NULL OR weight_grams > 0);
ALTER TABLE commerce_products ADD COLUMN length_mm INTEGER
	CHECK (length_mm IS NULL OR length_mm > 0);
ALTER TABLE commerce_products ADD COLUMN width_mm INTEGER
	CHECK (width_mm IS NULL OR width_mm > 0);
ALTER TABLE commerce_products ADD COLUMN height_mm INTEGER
	CHECK (height_mm IS NULL OR height_mm > 0);
-- NULL and 0 both read as "not adult content".
ALTER TABLE commerce_products ADD COLUMN adult INTEGER
	CHECK (adult IS NULL OR adult IN (0, 1));
ALTER TABLE commerce_products ADD COLUMN custom_label_0 TEXT;
ALTER TABLE commerce_products ADD COLUMN custom_label_1 TEXT;
ALTER TABLE commerce_products ADD COLUMN custom_label_2 TEXT;
ALTER TABLE commerce_products ADD COLUMN custom_label_3 TEXT;
ALTER TABLE commerce_products ADD COLUMN custom_label_4 TEXT;
-- 1 keeps the product in the shop but out of the feed and the sync.
ALTER TABLE commerce_products ADD COLUMN google_excluded INTEGER NOT NULL DEFAULT 0
	CHECK (google_excluded IN (0, 1));

-- The feed pages through active products by id (keyset), so a 2000-product
-- catalog is read once, in order, with no OFFSET rescans and no sort.
CREATE INDEX IF NOT EXISTS idx_commerce_products_active_id
	ON commerce_products (active, id);

-- What the opt-in Merchant API sync last sent for each product, so a tick
-- sends only what changed and deletes only what it once sent.
CREATE TABLE IF NOT EXISTS commerce_google_sync (
	product_id TEXT PRIMARY KEY,
	-- The offerId Google knows the product by; kept so a deleted product can still be removed.
	offer_id TEXT NOT NULL,
	-- SHA-256 of the exact payload last accepted.
	content_hash TEXT NOT NULL,
	synced_at TEXT NOT NULL DEFAULT (datetime('now'))
);
