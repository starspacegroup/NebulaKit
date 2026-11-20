-- @nebulakit/commerce: payment deadlines, lapsed sales and relisting for auctions.
--
-- pay_within_hours: how long a winner has to pay once their order exists. 0 = no
-- deadline (the default, because a site that takes manual payment cannot
-- tell "slow" from "never"; the admin form suggests 72).
-- pay_due_at: set when the order is created, ISO-8601 UTC. NULL = no deadline.
-- reminded_at: set once when the "pay soon" email is claimed, so it goes out once.
-- relisted_from: the auction this one replaced, so a lapsed or unsold auction is
-- relisted once and not twice.
--
-- A new status 'lapsed' (a sold auction whose winner did not pay in time; its
-- order is cancelled) needs no schema change: status has no CHECK.

ALTER TABLE commerce_auctions ADD COLUMN pay_within_hours INTEGER NOT NULL DEFAULT 0 CHECK (pay_within_hours BETWEEN 0 AND 720);
ALTER TABLE commerce_auctions ADD COLUMN pay_due_at TEXT;
ALTER TABLE commerce_auctions ADD COLUMN reminded_at TEXT;
ALTER TABLE commerce_auctions ADD COLUMN relisted_from TEXT REFERENCES commerce_auctions(id);

CREATE INDEX IF NOT EXISTS idx_commerce_auctions_pay_due ON commerce_auctions(status, pay_due_at);

-- One open relist per auction, enforced by the database: two admins (or one
-- double click) relisting the same auction cannot both succeed.
CREATE UNIQUE INDEX IF NOT EXISTS idx_commerce_auctions_one_open_relist
	ON commerce_auctions(relisted_from)
	WHERE relisted_from IS NOT NULL AND status = 'open';
