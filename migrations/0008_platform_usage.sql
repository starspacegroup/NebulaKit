-- Platform usage counters (admin-only; docs/ADMIN_STATS.md).
--
-- Cloudflare bills every Function invocation, which is a strictly LARGER set
-- than `page_view_daily` counts: that table deliberately records only non-bot
-- HTML GET 200s on matched routes, while billing also includes bots, /api/*
-- calls, redirects, 404s and non-GET requests. On the Workers Free plan the
-- whole account shares 100,000 requests per UTC day and the site simply stops
-- serving when that runs out, so operators need the billable number, not the
-- human-visitor number. The gap between the two is usually bot traffic.
--
-- One row per UTC day. Counted in-process and flushed on a rate limit (see
-- src/lib/utils/usage.ts) so the meter does not cost one D1 write per request.
-- Counts can be lost when an isolate is evicted holding an unflushed remainder,
-- so this is a slight UNDER-count and a floor — Cloudflare's dashboard remains
-- the source of truth; this exists to give early warning.
CREATE TABLE IF NOT EXISTS platform_usage_daily (
	day TEXT PRIMARY KEY,        -- 'YYYY-MM-DD' (UTC)
	-- Every request that reached the Worker, billable or not.
	requests INTEGER NOT NULL DEFAULT 0,
	-- Subset that never reaches SvelteKit routing (404s, asset misses).
	not_found INTEGER NOT NULL DEFAULT 0,
	-- Requests served to bots/crawlers. Excluded from page views but still
	-- billed, and the usual reason billed >> page views.
	bot INTEGER NOT NULL DEFAULT 0,
	updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
