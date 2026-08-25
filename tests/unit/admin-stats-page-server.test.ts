import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/utils/page-views', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../src/lib/utils/page-views')>();
	return {
		...actual,
		listDailyViews: vi.fn().mockResolvedValue([{ day: '2026-07-28', views: 5, signedIn: 2 }]),
		listHourlyViews: vi
			.fn()
			.mockResolvedValue([{ hourKey: '2026-07-28T09', views: 3, signedIn: 1 }]),
		listViewsByPath: vi.fn().mockResolvedValue([{ pathKey: '/blog', views: 5, signedIn: 2 }]),
		listReferrers: vi.fn().mockResolvedValue([{ referrerHost: '(direct)', views: 5 }]),
		listCountries: vi.fn().mockResolvedValue([{ country: 'US', views: 5 }]),
		listDimension: vi.fn().mockResolvedValue([{ value: 'Chrome', views: 5 }])
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
			peakDayOn: '2026-07-28',
			days: [{ day: '2026-07-28', requests: 10 }]
		})
	};
});

import {
	listCountries,
	listDailyViews,
	listDimension,
	listHourlyViews
} from '$lib/utils/page-views';
import { getUsage as getUsageMock } from '$lib/utils/usage';
import { load } from '../../src/routes/admin/stats/+page.server';

const OWNER = { id: 'u1', isOwner: true };

/** `load` is typed as possibly-void (PageServerLoad allows it); narrow it once
 *  here so the assertions below can read the payload directly. */
async function run(event: any) {
	const data = await load(event);
	if (!data) throw new Error('load returned no data');
	return data;
}

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
			all: vi.fn().mockResolvedValue({ results: [{ ym: '2026-07', count: 7 }] })
		}))
	} as any;
}

function createEvent(overrides: Record<string, any> = {}) {
	return {
		platform: { env: { DB: createDb() } },
		url: new URL('https://example.com/admin/stats'),
		locals: { user: OWNER },
		...overrides
	} as any;
}

describe('/admin/stats load — access', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('throws 403 for an admin without the stats grant', async () => {
		await expect(
			load(createEvent({ locals: { user: { id: 'u2', isAdmin: true } } }))
		).rejects.toHaveProperty('status', 403);
	});

	it('allows an admin holding the grant', async () => {
		const data = await run(
			createEvent({ locals: { user: { id: 'u2', isAdmin: true, canViewStats: true } } })
		);
		expect(data.stats?.totalUsers).toBe(7);
	});
});

describe('/admin/stats load — shape', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns a fully-shaped empty payload with no database bound', async () => {
		const data = await run(createEvent({ platform: undefined }));

		expect(data).toMatchObject({ stats: null, traffic: null, usage: null, trafficWindow: 30 });
		expect(data.trafficNowHour).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}$/);
	});

	it('summarizes counts and gap-filled growth series', async () => {
		const data = await run(createEvent());

		expect(data.stats).toMatchObject({
			totalUsers: 7,
			totalAdmins: 2,
			contentByStatus: { draft: 1, published: 4, archived: 0 }
		});
		expect(data.stats?.usersByMonth[0]).toMatchObject({ ym: '2026-07', count: 7, cumulative: 7 });
	});

	it('falls back to zeros when the optional count queries return nothing', async () => {
		// What a database that predates the CMS/contact migrations looks like:
		// those counts fail soft to null, and the panel must still render.
		const db = {
			prepare: vi.fn().mockImplementation(() => ({
				bind: vi.fn().mockReturnThis(),
				first: vi.fn().mockResolvedValue(null),
				all: vi.fn().mockResolvedValue({})
			}))
		};

		const data = await run(createEvent({ platform: { env: { DB: db } } }));

		expect(data.stats).toMatchObject({
			totalUsers: 0,
			totalAdmins: 0,
			totalContent: 0,
			totalContactSubmissions: 0,
			totalChatMessages: 0,
			contentByStatus: { draft: 0, published: 0, archived: 0 },
			usersByMonth: [],
			contentByMonth: []
		});
	});

	it('defaults to a 30-day window and rejects unsupported values', async () => {
		for (const raw of ['', '45', 'abc', '-1']) {
			const data = await run(
				createEvent({ url: new URL(`https://example.com/admin/stats?window=${raw}`) })
			);
			expect(data.trafficWindow).toBe(30);
		}
	});

	it.each([1, 7, 30, 90])('accepts the %s-day window', async (days) => {
		const data = await run(
			createEvent({ url: new URL(`https://example.com/admin/stats?window=${days}`) })
		);
		expect(data.trafficWindow).toBe(days);
	});

	it('only queries hourly counters for the 1-day window', async () => {
		await run(createEvent({ url: new URL('https://example.com/admin/stats?window=7') }));
		expect(listHourlyViews).not.toHaveBeenCalled();

		await run(createEvent({ url: new URL('https://example.com/admin/stats?window=1') }));
		expect(listHourlyViews).toHaveBeenCalledTimes(1);
	});

	it('keeps the rest of the traffic panel when an optional query fails', async () => {
		vi.mocked(listCountries).mockRejectedValueOnce(new Error('no such table'));

		const data = await run(createEvent());

		expect(data.traffic?.countries).toEqual([]);
		expect(data.traffic?.byPath).toHaveLength(1);
	});

	it('fails soft when optional count, growth, and audience tables are absent', async () => {
		const db = {
			prepare: vi.fn().mockImplementation((query: string) => ({
				bind: vi.fn().mockReturnThis(),
				first: vi.fn().mockImplementation(() => {
					if (query.includes('FROM users') && !query.includes('SUM(CASE')) {
						return Promise.resolve({ count: query.includes('is_admin') ? 1 : 3 });
					}
					return Promise.reject(new Error('optional table missing'));
				}),
				all: vi.fn().mockRejectedValue(new Error('growth table missing'))
			}))
		};
		for (let index = 0; index < 5; index += 1) {
			vi.mocked(listDimension).mockRejectedValueOnce(new Error('audience table missing'));
		}
		vi.mocked(listHourlyViews).mockRejectedValueOnce(new Error('hourly table missing'));

		const data = await run(
			createEvent({
				platform: { env: { DB: db } },
				url: new URL('https://example.com/admin/stats?window=1')
			})
		);

		expect(data.stats).toMatchObject({
			totalUsers: 3,
			totalAdmins: 1,
			totalContent: 0,
			totalContactSubmissions: 0,
			totalChatMessages: 0,
			contentByStatus: { draft: 0, published: 0, archived: 0 },
			usersByMonth: [],
			contentByMonth: []
		});
		expect(data.traffic?.audience).toEqual({
			os: [],
			browsers: [],
			devices: [],
			languages: [],
			viewports: []
		});
		expect(data.traffic?.hourly).toEqual([]);
	});

	it('removes the traffic panel when a required traffic query fails', async () => {
		vi.mocked(listDailyViews).mockRejectedValueOnce(new Error('traffic table missing'));

		const data = await run(createEvent());

		expect(data.traffic).toBeNull();
		expect(data.stats?.totalUsers).toBe(7);
	});

	it('degrades usage to null when its table is missing', async () => {
		vi.mocked(getUsageMock).mockRejectedValueOnce(new Error('no such table'));

		const data = await run(createEvent());

		expect(data.usage).toBeNull();
		// The rest of the page survives.
		expect(data.traffic).not.toBeNull();
	});

	it('fails the page only when the core counts throw', async () => {
		const db = {
			prepare: vi.fn().mockImplementation(() => {
				throw new Error('database is gone');
			})
		};

		await expect(load(createEvent({ platform: { env: { DB: db } } }))).rejects.toHaveProperty(
			'status',
			500
		);
	});
});
