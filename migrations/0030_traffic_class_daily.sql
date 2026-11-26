-- Who the page views probably came from (docs/ADMIN_STATS.md, "Real visitors and bots").
--
-- One daily counter per class, written for EVERY counted page view:
--   'human'      probably a real visitor
--   'likely-bot' does not say it is a bot but does not behave like a browser
--   'bot'        a crawler, preview fetcher or monitor that names itself
-- The detailed counters (page_view_daily and the rest) count only 'human' views, so the charts and
-- breakdowns describe real visitors; this table is what shows how much traffic was left out.
--
-- Three rows a day at most, and no identifier of any kind: the User-Agent and other headers are
-- read once to pick the class and never stored. Pruned with the other counters.
CREATE TABLE IF NOT EXISTS traffic_class_daily (
	day TEXT NOT NULL,           -- 'YYYY-MM-DD' (UTC)
	class TEXT NOT NULL,         -- 'human' | 'likely-bot' | 'bot'
	views INTEGER NOT NULL DEFAULT 0,
	PRIMARY KEY (day, class)
);
