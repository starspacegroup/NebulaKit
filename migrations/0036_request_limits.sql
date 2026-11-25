-- Counters that limit how often one client address may do something costly: place an order (each
-- writes up to 100 rows and opens a live Stripe payment) or cancel one. Without them one script
-- could use up the day's database writes and fill the Stripe account with open payments.
-- Ported from PinFool (its migration 0039), counters only.
--
-- `who` is a SHA-256 of the client address, never the address itself. A row is one fixed window
-- (`window_start`, unix seconds) for one `scope`; old windows are deleted as new ones are written.
CREATE TABLE IF NOT EXISTS request_limits (
	scope TEXT NOT NULL,
	who TEXT NOT NULL,
	window_start INTEGER NOT NULL,
	hits INTEGER NOT NULL DEFAULT 0,
	PRIMARY KEY (scope, who, window_start)
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS idx_request_limits_window ON request_limits (window_start);
