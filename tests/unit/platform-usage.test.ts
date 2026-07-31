import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	FREE_DAILY_REQUESTS,
	PAID_MONTHLY_REQUESTS,
	_resetUsageBuffer,
	getUsage,
	projectUsage,
	recordRequest,
	utcDayKey,
	type UsageWindow
} from '../../src/lib/utils/usage';

type Call = { query: string; binds: unknown[] };

function createMockDb(rows: unknown[] = []) {
	const calls: Call[] = [];
	const db = {
		prepare: vi.fn().mockImplementation((query: string) => {
			const state: Call = { query, binds: [] };
			calls.push(state);
			const stmt = {
				bind: vi.fn().mockImplementation((...args: unknown[]) => {
					state.binds = args;
					return stmt;
				}),
				run: vi.fn().mockResolvedValue({}),
				all: vi.fn().mockResolvedValue({ results: rows })
			};
			return stmt;
		})
	};
	return { db: db as any, calls };
}

describe('recordRequest buffering', () => {
	beforeEach(() => _resetUsageBuffer());

	it('flushes the very first request an isolate sees', async () => {
		// An isolate holding 1-3 counts may never get a second request, so the
		// first one must be written rather than buffered.
		const ctl = createMockDb();
		const write = recordRequest(ctl.db, { day: '2026-07-28', notFound: false, bot: false, now: 0 });

		expect(write).not.toBeNull();
		await write;
		expect(ctl.calls[0].query).toContain('platform_usage_daily');
		expect(ctl.calls[0].binds.slice(0, 4)).toEqual(['2026-07-28', 1, 0, 0]);
	});

	it('buffers subsequent requests inside the rate-limit window', () => {
		const ctl = createMockDb();
		recordRequest(ctl.db, { day: '2026-07-28', notFound: false, bot: false, now: 0 });

		expect(
			recordRequest(ctl.db, { day: '2026-07-28', notFound: false, bot: false, now: 200 })
		).toBeNull();
		expect(
			recordRequest(ctl.db, { day: '2026-07-28', notFound: false, bot: false, now: 500 })
		).toBeNull();
		expect(ctl.calls).toHaveLength(1);
	});

	it('flushes the accumulated batch once the interval has passed', async () => {
		const ctl = createMockDb();
		recordRequest(ctl.db, { day: '2026-07-28', notFound: false, bot: false, now: 0 });
		recordRequest(ctl.db, { day: '2026-07-28', notFound: true, bot: false, now: 100 });
		recordRequest(ctl.db, { day: '2026-07-28', notFound: false, bot: true, now: 200 });

		const write = recordRequest(ctl.db, {
			day: '2026-07-28',
			notFound: false,
			bot: false,
			now: 1_500
		});
		expect(write).not.toBeNull();
		await write;

		// The first request flushed on its own; these three (2 buffered + the one
		// that tripped the interval) go out together, one not-found and one bot
		// among them.
		expect(ctl.calls[1].binds.slice(0, 4)).toEqual(['2026-07-28', 3, 1, 1]);
	});

	it('force-flushes at the hard cap even inside the interval', async () => {
		const ctl = createMockDb();
		recordRequest(ctl.db, { day: '2026-07-28', notFound: false, bot: false, now: 0 });

		let write: Promise<void> | null = null;
		for (let i = 1; i <= 25 && !write; i++) {
			write = recordRequest(ctl.db, { day: '2026-07-28', notFound: false, bot: false, now: 10 });
		}

		expect(write).not.toBeNull();
		await write;
		expect(ctl.calls[1].binds[1]).toBe(25);
	});

	it('flushes the old day under the old key on a rollover', async () => {
		const ctl = createMockDb();
		recordRequest(ctl.db, { day: '2026-07-28', notFound: false, bot: false, now: 0 });
		recordRequest(ctl.db, { day: '2026-07-28', notFound: false, bot: false, now: 100 });

		const write = recordRequest(ctl.db, {
			day: '2026-07-29',
			notFound: false,
			bot: false,
			now: 200
		});
		expect(write).not.toBeNull();
		await write;

		// The carried remainder lands on the OLD day, not the new one — otherwise
		// yesterday's tail would inflate today's count.
		expect(ctl.calls[1].binds[0]).toBe('2026-07-28');

		// And the new day starts clean, carrying the request that triggered it.
		const next = recordRequest(ctl.db, {
			day: '2026-07-29',
			notFound: false,
			bot: false,
			now: 2_000
		});
		await next;
		expect(ctl.calls[2].binds.slice(0, 2)).toEqual(['2026-07-29', 2]);
	});

	it('carries not-found and bot flags across a day rollover', async () => {
		const ctl = createMockDb();
		recordRequest(ctl.db, { day: '2026-07-28', notFound: false, bot: false, now: 0 });
		recordRequest(ctl.db, { day: '2026-07-28', notFound: false, bot: false, now: 100 });

		await recordRequest(ctl.db, { day: '2026-07-29', notFound: true, bot: true, now: 200 });
		// The triggering request belongs to the NEW day, so the old day's flush
		// must not pick up its flags.
		expect(ctl.calls[1].binds.slice(0, 4)).toEqual(['2026-07-28', 1, 0, 0]);

		await recordRequest(ctl.db, { day: '2026-07-29', notFound: false, bot: false, now: 2_000 });
		expect(ctl.calls[2].binds.slice(0, 4)).toEqual(['2026-07-29', 2, 1, 1]);
	});

	it('defaults to the wall clock when no timestamp is supplied', async () => {
		const ctl = createMockDb();
		const write = recordRequest(ctl.db, { day: '2026-07-28', notFound: false, bot: false });

		expect(write).not.toBeNull();
		await write;
		expect(ctl.calls).toHaveLength(1);
	});

	it('formats the UTC day key', () => {
		expect(utcDayKey(new Date('2026-07-28T23:59:59.000Z'))).toBe('2026-07-28');
	});
});

describe('getUsage', () => {
	it('summarizes today, month-to-date and the peak day', async () => {
		const ctl = createMockDb([
			{ day: '2026-06-30', requests: 900, not_found: 0, bot: 10 },
			{ day: '2026-07-27', requests: 5_000, not_found: 12, bot: 400 },
			{ day: '2026-07-28', requests: 1_200, not_found: 3, bot: 90 }
		]);

		const usage = await getUsage(ctl.db, new Date('2026-07-28T06:00:00.000Z'));

		expect(usage.today).toBe(1_200);
		expect(usage.todayBot).toBe(90);
		expect(usage.todayNotFound).toBe(3);
		// June's row is in the window but not in the month — it must not count.
		expect(usage.monthToDate).toBe(6_200);
		expect(usage.peakDay).toBe(5_000);
		expect(usage.peakDayOn).toBe('2026-07-27');
		expect(usage.days).toHaveLength(3);
	});

	it('reports zeros when today has no row yet', async () => {
		const ctl = createMockDb([]);

		const usage = await getUsage(ctl.db, new Date('2026-07-28T06:00:00.000Z'));

		expect(usage.today).toBe(0);
		expect(usage.peakDayOn).toBeNull();
	});

	it('tolerates a query that yields no results field', async () => {
		const db = {
			prepare: vi.fn().mockImplementation(() => ({
				bind: vi.fn().mockReturnThis(),
				all: vi.fn().mockResolvedValue({})
			}))
		} as any;

		const usage = await getUsage(db, new Date('2026-07-28T06:00:00.000Z'));

		expect(usage.days).toEqual([]);
		expect(usage.monthToDate).toBe(0);
	});
});

describe('projectUsage', () => {
	const base: UsageWindow = {
		today: 0,
		todayBot: 0,
		todayNotFound: 0,
		monthToDate: 0,
		peakDay: 0,
		peakDayOn: null,
		days: []
	};

	it('extrapolates the day from the fraction elapsed', () => {
		// A quarter of the way through the day with a quarter of the allowance
		// spent projects to exactly the allowance.
		const p = projectUsage(
			{ ...base, today: FREE_DAILY_REQUESTS / 4 },
			new Date('2026-07-28T06:00:00.000Z')
		);

		expect(p.projectedToday).toBe(FREE_DAILY_REQUESTS);
		expect(p.percentUsed).toBeCloseTo(25, 5);
		expect(p.hoursToReset).toBeCloseTo(18, 5);
	});

	it('flags a day on track to exhaust the free allowance before reset', () => {
		const p = projectUsage(
			{ ...base, today: FREE_DAILY_REQUESTS * 0.9 },
			new Date('2026-07-28T12:00:00.000Z')
		);

		expect(p.willExhaustToday).toBe(true);
		expect(p.hoursToLimit).toBeLessThan(p.hoursToReset);
	});

	it('does not flag a quiet day', () => {
		const p = projectUsage({ ...base, today: 100 }, new Date('2026-07-28T12:00:00.000Z'));

		expect(p.willExhaustToday).toBe(false);
	});

	it('never runs out at zero traffic', () => {
		const p = projectUsage(base, new Date('2026-07-28T12:00:00.000Z'));

		expect(p.hoursToLimit).toBe(Infinity);
		expect(p.willExhaustToday).toBe(false);
	});

	it('prices paid-plan overage only past the included requests', () => {
		const under = projectUsage(
			{ ...base, monthToDate: PAID_MONTHLY_REQUESTS },
			new Date('2026-07-28T12:00:00.000Z')
		);
		expect(under.estimatedPaidOverageUsd).toBe(0);
		expect(under.monthPercentOfPaidAllowance).toBeCloseTo(100, 5);

		const over = projectUsage(
			{ ...base, monthToDate: PAID_MONTHLY_REQUESTS + 2_000_000 },
			new Date('2026-07-28T12:00:00.000Z')
		);
		expect(over.estimatedPaidOverageUsd).toBeCloseTo(0.6, 5);
	});
});
