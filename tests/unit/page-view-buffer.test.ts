import { beforeEach, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
	FLUSH_AT_VIEWS,
	MIN_FLUSH_INTERVAL_MS,
	_resetPageViewBuffer,
	addPageView,
	flushPageViews,
	recordPageViewBuffered
} from '../../src/lib/utils/page-view-buffer';
import { normalizeCountry, type PageViewRecord } from '../../src/lib/utils/page-views';

/** A fake D1 that records every statement's table and bound values. */
function fakeDb() {
	const writes: Array<{ table: string; binds: unknown[] }> = [];
	const batches: number[] = [];
	const db = {
		prepare(sql: string) {
			const table = /INSERT INTO (\w+)/.exec(sql)![1];
			return { table, bind: (...binds: unknown[]) => ({ table, binds }) };
		},
		async batch(stmts: Array<{ table: string; binds: unknown[] }>) {
			batches.push(stmts.length);
			writes.push(...stmts);
		}
	};
	return { db: db as any, writes, batches };
}

const view = (o: Partial<PageViewRecord> = {}): PageViewRecord => ({
	day: '2026-11-17',
	hour: 7,
	pathKey: '/shop',
	signedIn: false,
	referrerHost: 'example.com',
	country: 'US',
	os: 'Linux',
	browser: 'Firefox',
	device: 'desktop',
	language: 'en',
	...o
});

/** What the unbuffered recordPageView would write for these views, summed per counter. */
function expected(views: PageViewRecord[]) {
	const out = new Map<string, number>();
	const add = (k: string, n = 1) => out.set(k, (out.get(k) ?? 0) + n);
	for (const v of views) {
		add(`page_view_daily|${v.day}|${v.pathKey}|views`);
		add(`page_view_daily|${v.day}|${v.pathKey}|signed`, v.signedIn ? 1 : 0);
		add(`page_view_hourly|${v.day}|${v.hour}|views`);
		add(`page_view_hourly|${v.day}|${v.hour}|signed`, v.signedIn ? 1 : 0);
		add(`referrer_daily|${v.day}|${v.referrerHost ?? '(direct)'}|views`);
		add(`country_view_daily|${v.day}|${normalizeCountry(v.country)}|views`);
		if (v.contentId) add(`content_view_daily|${v.day}|${v.contentId}|views`);
		for (const [d, val] of [
			['os', v.os],
			['browser', v.browser],
			['device', v.device],
			['language', v.language]
		] as const)
			add(`view_dimension_daily|${v.day}|${d}|${val || '(unknown)'}|views`);
	}
	return out;
}

function written(writes: Array<{ table: string; binds: unknown[] }>) {
	const out = new Map<string, number>();
	const add = (k: string, n: number) => out.set(k, (out.get(k) ?? 0) + n);
	for (const { table, binds } of writes) {
		if (table === 'view_dimension_daily') {
			const [day, dim, val, n] = binds as [string, string, string, number];
			add(`${table}|${day}|${dim}|${val}|views`, n);
		} else if (table === 'page_view_daily' || table === 'page_view_hourly') {
			const [day, key, n, s] = binds as [string, string | number, number, number];
			add(`${table}|${day}|${key}|views`, n);
			add(`${table}|${day}|${key}|signed`, s);
		} else {
			const [day, key, n] = binds as [string, string, number];
			add(`${table}|${day}|${key}|views`, n);
		}
	}
	return out;
}

describe('page view buffer', () => {
	beforeEach(() => _resetPageViewBuffer());

	it('writes the first view at once, then buffers inside the interval', async () => {
		const { db, writes } = fakeDb();
		const first = recordPageViewBuffered(db, view(), 1_000);
		expect(first).not.toBeNull();
		await first;
		const buffered = recordPageViewBuffered(db, view(), 1_000 + MIN_FLUSH_INTERVAL_MS - 1);
		expect(buffered).toBeNull();
		const due = recordPageViewBuffered(db, view(), 1_000 + MIN_FLUSH_INTERVAL_MS);
		expect(due).not.toBeNull();
		await due;
		// the second flush carried two views as ONE upsert per counter, not two
		const daily = writes.filter((w) => w.table === 'page_view_daily');
		expect(daily).toHaveLength(2);
		expect(daily[1].binds).toEqual(['2026-11-17', '/shop', 2, 0]);
	});

	it('flushes by size even inside the interval', async () => {
		const { db } = fakeDb();
		await recordPageViewBuffered(db, view(), 0);
		let flushed = 0;
		for (let i = 0; i < FLUSH_AT_VIEWS; i++) {
			if (recordPageViewBuffered(db, view(), 1)) flushed++;
		}
		expect(flushed).toBe(1);
	});

	it('a flush with nothing waiting writes nothing', async () => {
		const { db, writes } = fakeDb();
		await flushPageViews(db, 5);
		expect(writes).toHaveLength(0);
	});

	it('large drains are chunked into batches of at most 50 statements', async () => {
		const { db, batches } = fakeDb();
		for (let i = 0; i < 90; i++) addPageView(view({ pathKey: `/p/${i}` }));
		await flushPageViews(db, 0);
		expect(batches.length).toBeGreaterThan(1);
		expect(Math.max(...batches)).toBeLessThanOrEqual(50);
	});

	it('property: increments written equal views recorded, for any views and any flush schedule', async () => {
		const viewArb = fc.record({
			day: fc.constantFrom('2026-11-16', '2026-11-17'),
			hour: fc.integer({ min: 0, max: 23 }),
			pathKey: fc.constantFrom('/', '/shop', '/shop/[slug]', '/about'),
			signedIn: fc.boolean(),
			contentId: fc.option(fc.constantFrom('c1', 'c2'), { nil: undefined }),
			referrerHost: fc.option(fc.constantFrom('a.com', 'b.org'), { nil: undefined }),
			country: fc.option(fc.constantFrom('US', 'de', 'T1', 'ZZZ', ''), { nil: undefined }),
			os: fc.option(fc.constantFrom('Linux', 'iOS'), { nil: undefined }),
			browser: fc.option(fc.constantFrom('Firefox', 'Safari'), { nil: undefined }),
			device: fc.option(fc.constantFrom('desktop', 'phone'), { nil: undefined }),
			language: fc.option(fc.constantFrom('en', 'fr'), { nil: undefined })
		});
		await fc.assert(
			fc.asyncProperty(
				fc.array(fc.tuple(viewArb, fc.integer({ min: 0, max: 20_000 })), { maxLength: 120 }),
				async (events) => {
					_resetPageViewBuffer();
					const { db, writes } = fakeDb();
					const views: PageViewRecord[] = [];
					let clock = 0;
					for (const [v, dt] of events) {
						clock += dt;
						const record = v as PageViewRecord;
						views.push(record);
						const p = recordPageViewBuffered(db, record, clock);
						if (p) await p;
					}
					await flushPageViews(db, clock); // the final remainder, as an eviction-free run would
					expect(written(writes)).toEqual(expected(views));
				}
			),
			{ numRuns: 80 }
		);
	});

	it('property: the buffer never writes more statements than the unbuffered path would', async () => {
		await fc.assert(
			fc.asyncProperty(fc.integer({ min: 1, max: 200 }), async (n) => {
				_resetPageViewBuffer();
				const { db, writes } = fakeDb();
				for (let i = 0; i < n; i++) {
					const p = recordPageViewBuffered(db, view(), i * 100);
					if (p) await p;
				}
				await flushPageViews(db, n * 100);
				expect(writes.length).toBeLessThanOrEqual(n * 8);
			}),
			{ numRuns: 30 }
		);
	});
});
