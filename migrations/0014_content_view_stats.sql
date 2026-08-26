-- Per-content view counters (docs/ADMIN_STATS.md).
--
-- Backs the "Top content" table on /admin/stats: which published CMS items
-- people actually read, as opposed to which routes get hit. The route counter
-- in page_view_daily collapses every item into one `/[contentType]/[slug]`
-- row, so it cannot answer that.
--
-- Same rule as every other counter here: a daily aggregate keyed on an id the
-- CMS already owns. No per-visitor row, no cookie, no identifier.
--
-- CARDINALITY WARNING — this is the one table in the stack whose size is not
-- bounded by construction. Every other counter is keyed on a fixed route table
-- or a closed bucket vocabulary; this one grows with the catalogue, at up to
-- one row per published item per day. It is pruned by the same retention cron
-- as the rest, and that cron is what keeps it in hand.
--
-- No foreign key to content_items: a deleted item's history stays readable for
-- the rest of the retention window, and the read path LEFT JOINs so a missing
-- row degrades to the id rather than dropping the count.
CREATE TABLE IF NOT EXISTS content_view_daily (
	day TEXT NOT NULL,
	content_id TEXT NOT NULL,
	views INTEGER NOT NULL DEFAULT 0,
	PRIMARY KEY (day, content_id)
);
