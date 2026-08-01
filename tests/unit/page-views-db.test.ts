import { describe, expect, it, vi } from 'vitest';
import {
	browserBucket,
	deviceBucket,
	languageBucket,
	listCountries,
	listDailyViews,
	listDimension,
	listHourlyViews,
	listReferrers,
	listViewsByPath,
	normalizeCountry,
	osBucket,
	pruneViewStats,
	recordPageView,
	recordViewportSample,
	referrerHostFrom,
	utcDay,
	utcHour,
	utcHourKey,
	viewportBucketFromWidth
} from '../../src/lib/utils/page-views';

type Call = { query: string; binds: unknown[] };

function createMockDb() {
	const calls: Call[] = [];
	const allQueue: unknown[] = [];
	const batches: Call[][] = [];
	const db = {
		batch: vi.fn().mockImplementation((statements: any[]) => {
			batches.push(statements.map((s) => s.__state));
			return Promise.resolve([]);
		}),
		prepare: vi.fn().mockImplementation((query: string) => {
			const state: Call = { query, binds: [] };
			calls.push(state);
			const stmt = {
				__state: state,
				bind: vi.fn().mockImplementation((...args: unknown[]) => {
					state.binds = args;
					return stmt;
				}),
				all: vi.fn().mockImplementation(() => Promise.resolve(allQueue.shift() ?? { results: [] })),
				run: vi.fn().mockImplementation(() => Promise.resolve({}))
			};
			return stmt;
		})
	};
	return { db: db as any, calls, allQueue, batches };
}

describe('utcDay / referrerHostFrom', () => {
	it('formats a UTC calendar day', () => {
		expect(utcDay(new Date('2026-07-16T23:59:59.000Z'))).toBe('2026-07-16');
	});

	it('formats the UTC hour and hour key', () => {
		expect(utcHour(new Date('2026-07-16T23:59:59.000Z'))).toBe(23);
		expect(utcHour(new Date('2026-07-16T00:00:00.000Z'))).toBe(0);
		expect(utcHourKey(new Date('2026-07-16T09:30:00.000Z'))).toBe('2026-07-16T09');
		expect(utcHourKey(new Date('2026-07-16T00:00:00.000Z'))).toBe('2026-07-16T00');
	});

	it('buckets OS from the platform client hint, falling back to coarse UA', () => {
		expect(osBucket('"Windows"', null)).toBe('Windows');
		expect(osBucket('"macOS"', null)).toBe('macOS');
		expect(osBucket('"Haiku"', null)).toBe('(other)');
		expect(osBucket(null, 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe('iOS');
		expect(osBucket(null, 'Mozilla/5.0 (Linux; Android 14; Pixel 8)')).toBe('Android');
		expect(osBucket(null, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('Windows');
		expect(osBucket(null, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe('macOS');
		expect(osBucket(null, 'Mozilla/5.0 (X11; Linux x86_64)')).toBe('Linux');
		expect(osBucket(null, null)).toBe('(unknown)');
		// Chromium reports Chrome OS under two spellings; both collapse to one.
		expect(osBucket('"Chromium OS"', null)).toBe('Chrome OS');
		expect(osBucket(null, 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0)')).toBe('Chrome OS');
	});

	it('buckets browser from Sec-CH-UA brands, falling back to coarse UA', () => {
		expect(browserBucket('"Google Chrome";v="125", "Chromium";v="125"', null)).toBe('Chrome');
		expect(browserBucket('"Microsoft Edge";v="125", "Chromium";v="125"', null)).toBe(
			'Microsoft Edge'
		);
		expect(browserBucket('"Chromium";v="125"', null)).toBe('Chromium');
		expect(browserBucket(null, 'Mozilla/5.0 (X11; Linux) Gecko/20100101 Firefox/126.0')).toBe(
			'Firefox'
		);
		expect(
			browserBucket(null, 'Mozilla/5.0 (Macintosh) AppleWebKit/605 Version/17.4 Safari/605.1.15')
		).toBe('Safari');
		expect(browserBucket(null, null)).toBe('(unknown)');
		// UA-only fallbacks, in the order the function tries them — Edge, Opera
		// and Samsung all also contain 'Chrome/', so order is what makes these
		// resolve correctly rather than all reporting Chrome.
		expect(browserBucket(null, 'Mozilla/5.0 Chrome/125.0 Safari/537.36 Edg/125.0')).toBe(
			'Microsoft Edge'
		);
		expect(browserBucket(null, 'Mozilla/5.0 Chrome/125.0 Safari/537.36 OPR/111.0')).toBe('Opera');
		expect(browserBucket(null, 'Mozilla/5.0 SamsungBrowser/25.0 Chrome/121.0')).toBe(
			'Samsung Internet'
		);
		expect(browserBucket(null, 'Mozilla/5.0 (iPhone) CriOS/125.0 Mobile/15E148')).toBe('Chrome');
		expect(browserBucket(null, 'Mozilla/5.0 Chrome/125.0 Safari/537.36')).toBe('Chrome');
	});

	it('buckets device class from Sec-CH-UA-Mobile with UA fallbacks', () => {
		expect(deviceBucket('?1', null)).toBe('mobile');
		expect(deviceBucket('?0', null)).toBe('desktop');
		expect(deviceBucket(null, 'Mozilla/5.0 (iPad; CPU OS 17_0)')).toBe('tablet');
		expect(deviceBucket(null, 'Mozilla/5.0 (iPhone) Mobile/15E148')).toBe('mobile');
		expect(deviceBucket(null, 'Mozilla/5.0 (Windows NT 10.0)')).toBe('desktop');
		expect(deviceBucket(null, null)).toBe('(unknown)');
	});

	it('takes the first Accept-Language tag, normalized', () => {
		expect(languageBucket('en-US,en;q=0.9')).toBe('en-US');
		expect(languageBucket('pt-br')).toBe('pt-BR');
		expect(languageBucket('fr')).toBe('fr');
		expect(languageBucket('*')).toBe('(unknown)');
		expect(languageBucket(null)).toBe('(unknown)');
	});

	it('buckets viewport widths on the CSS breakpoints, rejecting junk', () => {
		expect(viewportBucketFromWidth(390)).toBe('under-640');
		expect(viewportBucketFromWidth(800)).toBe('640-1023');
		expect(viewportBucketFromWidth(1280)).toBe('1024-1535');
		expect(viewportBucketFromWidth(2560)).toBe('1536-plus');
		expect(viewportBucketFromWidth(0)).toBeNull();
		expect(viewportBucketFromWidth(-5)).toBeNull();
		expect(viewportBucketFromWidth(99999)).toBeNull();
		expect(viewportBucketFromWidth(NaN)).toBeNull();
	});

	it('normalizes country codes: passes edge codes, collapses the rest', () => {
		expect(normalizeCountry('US')).toBe('US');
		expect(normalizeCountry('T1')).toBe('T1');
		expect(normalizeCountry('XX')).toBe('XX');
		expect(normalizeCountry('usa')).toBe('(unknown)');
		expect(normalizeCountry('')).toBe('(unknown)');
		expect(normalizeCountry(null)).toBe('(unknown)');
		expect(normalizeCountry(undefined)).toBe('(unknown)');
	});

	it('extracts external referrer hosts and drops same-site/invalid ones', () => {
		expect(referrerHostFrom('https://news.ycombinator.com/item?id=1', 'example.com')).toBe(
			'news.ycombinator.com'
		);
		// Same-site referrals are noise in a referrer report, and the comparison
		// has to be case-insensitive or a capitalized Referer leaks through.
		expect(referrerHostFrom('https://EXAMPLE.COM/blog', 'example.com')).toBeNull();
		expect(referrerHostFrom('not a url', 'example.com')).toBeNull();
		expect(referrerHostFrom(null, 'example.com')).toBeNull();
	});
});

describe('recordPageView', () => {
	it('bumps page + hourly + referrer counters in one batch', async () => {
		const ctl = createMockDb();
		await recordPageView(ctl.db, {
			day: '2026-07-16',
			hour: 14,
			pathKey: '/blog',
			signedIn: true
		});

		expect(ctl.batches).toHaveLength(1);
		const [pageStmt, hourStmt, referrerStmt, countryStmt, ...dimStmts] = ctl.batches[0];
		expect(pageStmt.query).toContain('page_view_daily');
		expect(pageStmt.query).toContain('ON CONFLICT');
		expect(pageStmt.binds).toEqual(['2026-07-16', '/blog', 1]);
		expect(hourStmt.query).toContain('page_view_hourly');
		expect(hourStmt.binds).toEqual(['2026-07-16', 14, 1]);
		expect(referrerStmt.query).toContain('referrer_daily');
		expect(referrerStmt.binds).toEqual(['2026-07-16', '(direct)']);
		expect(countryStmt.query).toContain('country_view_daily');
		expect(countryStmt.binds).toEqual(['2026-07-16', '(unknown)']);
		// Audience dimensions default to '(unknown)' so totals always match.
		expect(dimStmts.map((s) => s.binds)).toEqual([
			['2026-07-16', 'os', '(unknown)'],
			['2026-07-16', 'browser', '(unknown)'],
			['2026-07-16', 'device', '(unknown)'],
			['2026-07-16', 'language', '(unknown)']
		]);
	});

	it('carries referrer, country and audience buckets through to their counters', async () => {
		const ctl = createMockDb();
		await recordPageView(ctl.db, {
			day: '2026-07-16',
			hour: 0,
			pathKey: '/blog/[slug]',
			signedIn: false,
			referrerHost: 'news.ycombinator.com',
			country: 'IN',
			os: 'Android',
			browser: 'Chrome',
			device: 'mobile',
			language: 'hi-IN'
		});

		const batch = ctl.batches[0];
		expect(batch).toHaveLength(8);
		// The route id is stored, never the resolved URL — that's what bounds
		// cardinality no matter how many posts exist.
		expect(batch[0].binds).toEqual(['2026-07-16', '/blog/[slug]', 0]);
		expect(batch[1].query).toContain('page_view_hourly');
		expect(batch[1].binds).toEqual(['2026-07-16', 0, 0]);
		expect(batch[2].query).toContain('referrer_daily');
		expect(batch[2].binds).toEqual(['2026-07-16', 'news.ycombinator.com']);
		expect(batch[3].query).toContain('country_view_daily');
		expect(batch[3].binds).toEqual(['2026-07-16', 'IN']);
		expect(batch.slice(4).map((s) => s.binds)).toEqual([
			['2026-07-16', 'os', 'Android'],
			['2026-07-16', 'browser', 'Chrome'],
			['2026-07-16', 'device', 'mobile'],
			['2026-07-16', 'language', 'hi-IN']
		]);
	});
});

describe('page-view queries', () => {
	it('lists daily totals since a day', async () => {
		const ctl = createMockDb();
		ctl.allQueue.push({ results: [{ day: '2026-07-15', views: 12, signed_in: 3 }] });

		const daily = await listDailyViews(ctl.db, '2026-06-16');

		expect(ctl.calls[0].query).toContain('GROUP BY day');
		expect(ctl.calls[0].binds).toEqual(['2026-06-16']);
		expect(daily).toEqual([{ day: '2026-07-15', views: 12, signedIn: 3 }]);
	});

	it('lists hourly totals since an hour key', async () => {
		const ctl = createMockDb();
		ctl.allQueue.push({
			results: [
				{ day: '2026-07-22', hour: 23, views: 4, signed_in: 1 },
				{ day: '2026-07-23', hour: 3, views: 9, signed_in: 0 }
			]
		});

		const hourly = await listHourlyViews(ctl.db, '2026-07-22T18');

		// Day prefix first so the scan stays on the primary key.
		expect(ctl.calls[0].query).toContain('page_view_hourly');
		expect(ctl.calls[0].binds).toEqual(['2026-07-22', '2026-07-22T18']);
		expect(hourly).toEqual([
			{ hourKey: '2026-07-22T23', views: 4, signedIn: 1 },
			{ hourKey: '2026-07-23T03', views: 9, signedIn: 0 }
		]);
	});

	it('lists views by path with a limit', async () => {
		const ctl = createMockDb();
		ctl.allQueue.push({ results: [{ path_key: '/blog', views: 40, signed_in: 10 }] });

		const byPath = await listViewsByPath(ctl.db, '2026-06-16', 10);

		expect(ctl.calls[0].binds).toEqual(['2026-06-16', 10]);
		expect(byPath[0]).toEqual({ pathKey: '/blog', views: 40, signedIn: 10 });
	});

	it('lists referrers', async () => {
		const ctl = createMockDb();
		ctl.allQueue.push({ results: [{ referrer_host: 'news.ycombinator.com', views: 7 }] });

		const refs = await listReferrers(ctl.db, '2026-06-16');
		expect(refs[0]).toEqual({ referrerHost: 'news.ycombinator.com', views: 7 });
	});

	it('lists countries', async () => {
		const ctl = createMockDb();
		ctl.allQueue.push({ results: [{ country: 'US', views: 21 }] });

		const countries = await listCountries(ctl.db, '2026-06-16', 10);

		expect(ctl.calls[0].query).toContain('country_view_daily');
		expect(ctl.calls[0].binds).toEqual(['2026-06-16', 10]);
		expect(countries[0]).toEqual({ country: 'US', views: 21 });
	});

	it('lists a dimension with a limit', async () => {
		const ctl = createMockDb();
		ctl.allQueue.push({ results: [{ value: 'Android', views: 12 }] });

		const rows = await listDimension(ctl.db, 'os', '2026-06-16', 10);

		expect(ctl.calls[0].query).toContain('view_dimension_daily');
		expect(ctl.calls[0].binds).toEqual(['os', '2026-06-16', 10]);
		expect(rows[0]).toEqual({ value: 'Android', views: 12 });
	});

	it('applies default row limits when the caller does not pass one', async () => {
		const ctl = createMockDb();
		await listViewsByPath(ctl.db, '2026-06-16');
		await listReferrers(ctl.db, '2026-06-16');
		await listCountries(ctl.db, '2026-06-16');
		await listDimension(ctl.db, 'browser', '2026-06-16');

		expect(ctl.calls.map((c) => c.binds.at(-1))).toEqual([50, 50, 50, 20]);
	});

	it('returns an empty list when a query yields no results field', async () => {
		const ctl = createMockDb();
		for (let i = 0; i < 6; i++) ctl.allQueue.push({});

		await expect(listDailyViews(ctl.db, '2026-06-16')).resolves.toEqual([]);
		await expect(listHourlyViews(ctl.db, '2026-06-16T00')).resolves.toEqual([]);
		await expect(listViewsByPath(ctl.db, '2026-06-16')).resolves.toEqual([]);
		await expect(listReferrers(ctl.db, '2026-06-16', 5)).resolves.toEqual([]);
		await expect(listCountries(ctl.db, '2026-06-16')).resolves.toEqual([]);
		await expect(listDimension(ctl.db, 'device', '2026-06-16')).resolves.toEqual([]);
	});

	it('records a viewport sample as a single upsert', async () => {
		const ctl = createMockDb();
		await recordViewportSample(ctl.db, '2026-07-18', 'under-640');

		expect(ctl.calls[0].query).toContain("'viewport'");
		expect(ctl.calls[0].binds).toEqual(['2026-07-18', 'under-640']);
	});

	it('prunes every counter table before a day', async () => {
		const ctl = createMockDb();
		await pruneViewStats(ctl.db, '2025-06-01');

		const batch = ctl.batches[0];
		// A table missing here would grow forever, so the list is asserted whole.
		// platform_usage_daily was missing until 2026-08-01 — this assertion passed
		// the whole time because it only ever described what the code already did.
		expect(batch).toHaveLength(6);
		expect(batch.map((s) => s.query.match(/FROM (\w+)/)?.[1])).toEqual([
			'page_view_daily',
			'page_view_hourly',
			'referrer_daily',
			'country_view_daily',
			'view_dimension_daily',
			'platform_usage_daily'
		]);
		for (const stmt of batch) expect(stmt.binds).toEqual(['2025-06-01']);
	});
});
