-- First-party page-view analytics (admin-only; docs/ADMIN_STATS.md).
--
-- Everything here is a daily AGGREGATE counter written by the pageViewsHandler
-- server hook. There are no raw request rows, no cookies, no identifiers and no
-- IP addresses anywhere in this feature — which is what lets it ship without a
-- consent banner.
--
-- Cardinality is bounded by construction:
--   * path_key is the SvelteKit ROUTE ID ('/blog/[slug]'), never the URL, so a
--     million posts are one row and slugs/query strings can't leak in here.
--   * referrers are stored host-only ('(direct)' when absent or same-site).
--   * country is the edge-provided ISO 3166-1 alpha-2 code (request.cf.country),
--     never derived from an IP by us; '(unknown)' in local dev.
--   * dimension values come from a small closed vocabulary (see 0019-equivalent
--     comment on view_dimension_daily below).
--
-- All six tables in this feature are pruned together by
-- /api/cron/prune-view-stats; without that they grow one row per day forever.

-- Route-level daily counters — the spine of the traffic panel.
CREATE TABLE IF NOT EXISTS page_view_daily (
	day TEXT NOT NULL,           -- 'YYYY-MM-DD' (UTC)
	path_key TEXT NOT NULL,      -- SvelteKit route id
	views INTEGER NOT NULL DEFAULT 0,
	-- Signed-in VIEWS, not signed-in visitors: there are no visitors to count.
	signed_in INTEGER NOT NULL DEFAULT 0,
	PRIMARY KEY (day, path_key)
);

-- Totals-only hourly counters. The daily table can't resolve a "1 day" traffic
-- window — it renders as two fat bars (yesterday + today so far) — so this backs
-- that window with 24 real buckets. Deliberately carries NO path/referrer/
-- country/dimension breakdown, which is what keeps it at 24 rows per day.
CREATE TABLE IF NOT EXISTS page_view_hourly (
	day TEXT NOT NULL,           -- 'YYYY-MM-DD' (UTC)
	hour INTEGER NOT NULL,       -- 0-23 (UTC)
	views INTEGER NOT NULL DEFAULT 0,
	signed_in INTEGER NOT NULL DEFAULT 0,
	PRIMARY KEY (day, hour)
);

-- Referrers, host only. The full referring URL is never stored.
CREATE TABLE IF NOT EXISTS referrer_daily (
	day TEXT NOT NULL,
	referrer_host TEXT NOT NULL, -- bare host, or '(direct)'
	views INTEGER NOT NULL DEFAULT 0,
	PRIMARY KEY (day, referrer_host)
);

-- Country aggregates. ~250 countries x days keeps this bounded.
CREATE TABLE IF NOT EXISTS country_view_daily (
	day TEXT NOT NULL,
	country TEXT NOT NULL,       -- ISO 3166-1 alpha-2, 'T1' (Tor), or '(unknown)'
	views INTEGER NOT NULL DEFAULT 0,
	PRIMARY KEY (day, country)
);

-- One generic daily-aggregate table for every low-cardinality audience
-- dimension, so adding a dimension is a new `dimension` value rather than a
-- migration:
--   os        ('Windows', 'Android', ...)        from Sec-CH-UA-Platform / coarse UA
--   browser   ('Chrome', 'Safari', ...)          from Sec-CH-UA / coarse UA
--   device    ('mobile' | 'tablet' | 'desktop')  from Sec-CH-UA-Mobile / coarse UA
--   language  ('en-US', 'pt-BR', ...)            from Accept-Language (first tag)
--   viewport  ('under-640' | '640-1023' | '1024-1535' | '1536-plus')
--             from the client beacon (bucketed innerWidth, CSS px)
--
-- Buckets only. The raw User-Agent string is read transiently in the hook and
-- NEVER stored — a full UA is quasi-identifying, a value from a closed list is
-- not. Unrecognized input lands on '(unknown)' / '(other)' rather than passing
-- through.
CREATE TABLE IF NOT EXISTS view_dimension_daily (
	day TEXT NOT NULL,
	dimension TEXT NOT NULL,     -- 'os' | 'browser' | 'device' | 'language' | 'viewport'
	value TEXT NOT NULL,         -- bucketed value, '(unknown)' fallback
	views INTEGER NOT NULL DEFAULT 0,
	PRIMARY KEY (day, dimension, value)
);
