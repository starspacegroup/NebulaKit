import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/utils/page-views', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../src/lib/utils/page-views')>();
	return {
		...actual,
		listDailyViews: vi.fn().mockResolvedValue([{ day: '2026-10-09', views: 5, signedIn: 2 }]),
		listHourlyViews: vi
			.fn()
			.mockResolvedValue([{ hourKey: '2026-10-10T09', views: 3, signedIn: 1 }]),
		listViewsByPath: vi.fn().mockResolvedValue([{ pathKey: '/blog', views: 5, signedIn: 2 }]),
		listReferrers: vi.fn().mockResolvedValue([{ referrerHost: '(direct)', views: 5 }]),
		listCountries: vi.fn().mockResolvedValue([{ country: 'US', views: 5 }]),
		listDimension: vi.fn().mockResolvedValue([{ value: 'Chrome', views: 5 }]),
		listTopContent: vi.fn().mockResolvedValue([])
	};
});

vi.mock('$lib/utils/usage', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../src/lib/utils/usage')>();
	return {
		...actual,
		getUsage: vi.fn().mockResolvedValue({
			today: 10,
			todayBot: 1,
			todayNotFound: 0,
			monthToDate: 100,
			peakDay: 10,
			peakDayOn: '2026-10-09',
			days: [{ day: '2026-10-09', requests: 10 }]
		})
	};
});

import { listDailyViews, listHourlyViews } from '$lib/utils/page-views';
import { getUsage } from '$lib/utils/usage';
import { loadStatsSummary } from '../../src/lib/server/stats-summary';

function createDb() {
	return {
		prepare: vi.fn().mockImplementation((query: string) => ({
			bind: vi.fn().mockReturnThis(),
			first: vi
				.fn()
				.mockResolvedValue(
					query.includes('SUM(CASE')
						? { draft: 1, published: 4, archived: 0 }
						: { count: query.includes('is_admin') ? 2 : 7 }
				),
			all: vi.fn().mockResolvedValue({ results: [{ ym: '2026-09', count: 7 }] })
		}))
	} as never;
}

const NOW = new Date('2026-10-10T12:30:00.000Z');

describe('loadStatsSummary', () => {
	it('assembles counts, growth, traffic and usage for a window', async () => {
		const summary = await loadStatsSummary(createDb(), 7, NOW);

		expect(summary.trafficWindow).toBe(7);
		expect(summary.trafficNowHour).toBe('2026-10-10T12');
		expect(summary.stats).toMatchObject({
			totalUsers: 7,
			totalAdmins: 2,
			totalContent: 7,
			contentByStatus: { draft: 1, published: 4, archived: 0 }
		});
		expect(summary.stats.usersByMonth[0]).toMatchObject({ ym: '2026-09', count: 7, cumulative: 7 });
		expect(summary.traffic?.daily).toEqual([{ day: '2026-10-09', views: 5, signedIn: 2 }]);
		expect(summary.traffic?.hourly).toEqual([]);
		expect(summary.traffic?.audience.browsers).toEqual([{ value: 'Chrome', views: 5 }]);
		expect(summary.usage?.today).toBe(10);
		expect(summary.usage?.projection.percentUsed).toBeCloseTo(0.01);
		// The window drives the "since" day handed to the counters.
		expect(listDailyViews).toHaveBeenLastCalledWith(expect.anything(), '2026-10-03');
	});

	it('adds the hourly series only for the 1-day window', async () => {
		vi.mocked(listHourlyViews).mockClear();
		const summary = await loadStatsSummary(createDb(), 1, NOW);
		expect(listHourlyViews).toHaveBeenCalledTimes(1);
		expect(summary.traffic?.hourly).toHaveLength(1);
	});

	it('fails soft per panel: a missing traffic table loses traffic, not the summary', async () => {
		vi.mocked(listDailyViews).mockRejectedValueOnce(new Error('no such table'));
		vi.mocked(getUsage).mockRejectedValueOnce(new Error('no such table'));

		const summary = await loadStatsSummary(createDb(), 30, NOW);

		expect(summary.traffic).toBeNull();
		expect(summary.usage).toBeNull();
		expect(summary.stats.totalUsers).toBe(7);
	});

	it('zeroes the optional counts when their tables are absent', async () => {
		const db = {
			prepare: vi.fn().mockImplementation((query: string) => ({
				bind: vi.fn().mockReturnThis(),
				first: vi
					.fn()
					.mockImplementation(() =>
						query.includes('FROM users') && !query.includes('SUM(CASE')
							? Promise.resolve({ count: 3 })
							: Promise.reject(new Error('optional table missing'))
					),
				all: vi.fn().mockRejectedValue(new Error('growth table missing'))
			}))
		} as never;

		const summary = await loadStatsSummary(db, 30, NOW);

		expect(summary.stats).toMatchObject({
			totalUsers: 3,
			totalAdmins: 3,
			totalContent: 0,
			totalContactSubmissions: 0,
			totalChatMessages: 0,
			contentByStatus: { draft: 0, published: 0, archived: 0 },
			usersByMonth: [],
			contentByMonth: []
		});
	});

	it('lets a failure of the core user counts propagate', async () => {
		const db = {
			prepare: vi.fn().mockImplementation(() => {
				throw new Error('database is gone');
			})
		} as never;
		await expect(loadStatsSummary(db, 30, NOW)).rejects.toThrow('database is gone');
	});
});
