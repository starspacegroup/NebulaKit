-- @nebulakit/commerce: auctions for products.
--
-- An auction sells ONE unit of a product to the highest bidder. Money is
-- INTEGER CENTS, as everywhere else in commerce.
--
-- Bidding is proxy ("max bid") bidding: a bidder states the most they will
-- pay, the auction shows only the price needed to stay ahead, and raises it
-- for them up to their maximum. The rules live in
-- packages/commerce/src/auction.ts (pure, no database); this file is only
-- where the result is kept.
--
-- `version` makes every bid a compare-and-set: a bid is written only if the
-- auction is still the one the bid was resolved against, so two bids at the
-- same moment cannot both win.
--
-- A won auction becomes an ordinary commerce_orders row (order_id), so
-- payment, fulfilment and the orders API need no auction-specific code.

CREATE TABLE IF NOT EXISTS commerce_auctions (
	id TEXT PRIMARY KEY,
	slug TEXT NOT NULL UNIQUE,
	product_id TEXT NOT NULL REFERENCES commerce_products(id),
	-- Copied from the product at creation: a later product edit never rewrites an auction in progress.
	title TEXT NOT NULL,
	currency TEXT NOT NULL DEFAULT 'usd',
	starting_cents INTEGER NOT NULL CHECK (starting_cents >= 0),
	-- Hidden minimum: below it the item does not sell. NULL = no reserve.
	reserve_cents INTEGER CHECK (reserve_cents IS NULL OR reserve_cents >= 0),
	-- "Buy it now" price while it is on offer. NULL = none.
	buy_now_cents INTEGER CHECK (buy_now_cents IS NULL OR buy_now_cents >= 0),
	-- Fixed minimum raise. NULL = the tiered default (auction.ts).
	increment_cents INTEGER CHECK (increment_cents IS NULL OR increment_cents >= 1),
	starts_at TEXT NOT NULL,
	ends_at TEXT NOT NULL,
	-- A bid this close to the end pushes the end out by this many seconds. 0 = off.
	extend_seconds INTEGER NOT NULL DEFAULT 0 CHECK (extend_seconds BETWEEN 0 AND 3600),
	extensions INTEGER NOT NULL DEFAULT 0,
	-- open → sold | unsold | cancelled. "Scheduled" and "live" are read from the clock, not stored.
	status TEXT NOT NULL DEFAULT 'open',
	-- The price to beat. NULL until the first bid.
	current_cents INTEGER,
	leader_id TEXT,
	leader_email TEXT,
	leader_max_cents INTEGER,
	bid_count INTEGER NOT NULL DEFAULT 0,
	version INTEGER NOT NULL DEFAULT 0,
	winner_id TEXT,
	winner_email TEXT,
	final_cents INTEGER,
	order_id TEXT REFERENCES commerce_orders(id),
	settled_at TEXT,
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One row per bid placed. `price_after_cents` is the price that bid left on
-- the board (what the public sees); `max_cents` is private to the bidder.
CREATE TABLE IF NOT EXISTS commerce_auction_bids (
	id TEXT PRIMARY KEY,
	auction_id TEXT NOT NULL REFERENCES commerce_auctions(id) ON DELETE CASCADE,
	bidder_id TEXT NOT NULL,
	bidder_email TEXT NOT NULL,
	max_cents INTEGER NOT NULL CHECK (max_cents >= 0),
	price_after_cents INTEGER NOT NULL CHECK (price_after_cents >= 0),
	-- 1 when this bid took or kept the lead.
	leading INTEGER NOT NULL DEFAULT 0,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_commerce_auctions_status_end ON commerce_auctions(status, ends_at);
CREATE INDEX IF NOT EXISTS idx_commerce_auctions_product ON commerce_auctions(product_id);
CREATE INDEX IF NOT EXISTS idx_commerce_auction_bids_auction ON commerce_auction_bids(auction_id, created_at);
