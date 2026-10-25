-- Transactional email: a record of every send, which is also what makes a send once-only.
--
-- Stripe retries a webhook until it gets a 2xx and can deliver the same event
-- twice after one. An order receipt arriving twice reads like being charged
-- twice, so a send first *claims* its slot here and the database refuses a
-- second claim.
--
-- `status` has three real outcomes rather than a boolean:
--   sent    - the slot is claimed and the provider was called (provider_id is
--             filled in once Resend answers; a 'sent' row with no provider_id
--             is a call that died in flight, and is visible as such)
--   failed  - the provider refused it; `error` says what it said
--   skipped - nothing was configured (no API key), so nothing was tried.
--             Kept so a shop that has not set the key up yet can see what it
--             would have sent.
CREATE TABLE IF NOT EXISTS email_log (
	id TEXT PRIMARY KEY,
	-- Kept in full: this is the shop's own record, and a masked address cannot
	-- answer "did she ever get it?".
	to_address TEXT NOT NULL,
	-- Which email this is: 'order-receipt', 'order-shipped', 'notice'.
	template TEXT NOT NULL,
	subject TEXT NOT NULL,
	status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
	provider_id TEXT,
	error TEXT,
	-- What it is about ('order' + the order id). The once-only index keys on related_id.
	related_type TEXT,
	related_id TEXT,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- The once-only guarantee. PARTIAL on status = 'sent' on purpose: a failed or
-- skipped attempt must stay retryable (the key arrives, the provider recovers),
-- while a successful one can never be repeated for the same template and subject.
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_log_once
	ON email_log (template, related_id)
	WHERE related_id IS NOT NULL AND status = 'sent';

CREATE INDEX IF NOT EXISTS idx_email_log_created ON email_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_log_related ON email_log (related_type, related_id);
