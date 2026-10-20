import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/stats-summary', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../src/lib/server/stats-summary')>();
	return {
		...actual,
		loadStatsSummary: vi.fn()
	};
});

import { loadStatsSummary, parseTrafficWindow } from '$lib/server/stats-summary';
import { issueStatsToken } from '../../src/lib/server/stats-token';
import { GET } from '../../src/routes/api/stats/summary/+server';

const SUMMARY = {
	trafficWindow: 7,
	trafficNowHour: '2026-10-10T12',
	traffic: null,
	usage: null,
	stats: {
		totalUsers: 3,
		totalAdmins: 1,
		totalContent: 0,
		totalContactSubmissions: 0,
		totalChatMessages: 0,
		contentByStatus: { draft: 0, published: 0, archived: 0 },
		usersByMonth: [],
		contentByMonth: []
	}
};

function createKv() {
	const store = { value: null as string | null };
	return {
		get: vi.fn(async () => store.value),
		put: vi.fn(async (_key: string, value: string) => {
			store.value = value;
		}),
		delete: vi.fn(async () => {
			store.value = null;
		})
	};
}

function createEvent(options: {
	authorization?: string | null;
	kv?: ReturnType<typeof createKv> | null;
	db?: unknown;
	search?: string;
}) {
	const env: Record<string, unknown> = {};
	if (options.kv) env.KV = options.kv;
	if (options.db !== null) env.DB = options.db ?? { prepare: vi.fn() };
	return {
		request: new Request('https://example.com/api/stats/summary', {
			headers: options.authorization ? { authorization: options.authorization } : {}
		}),
		url: new URL(`https://example.com/api/stats/summary${options.search ?? ''}`),
		platform: { env }
	} as never;
}

describe('parseTrafficWindow', () => {
	it('accepts the four windows and defaults everything else to 30', () => {
		expect(parseTrafficWindow('1')).toBe(1);
		expect(parseTrafficWindow('7')).toBe(7);
		expect(parseTrafficWindow('30')).toBe(30);
		expect(parseTrafficWindow('90')).toBe(90);
		for (const raw of ['', '45', 'abc', '-1', null, undefined]) {
			expect(parseTrafficWindow(raw)).toBe(30);
		}
	});
});

describe('GET /api/stats/summary', () => {
	it('answers 503 without KV or D1 bound', async () => {
		await expect(GET(createEvent({ kv: null }))).rejects.toMatchObject({ status: 503 });
		await expect(GET(createEvent({ kv: createKv(), db: null }))).rejects.toMatchObject({
			status: 503
		});
		expect(loadStatsSummary).not.toHaveBeenCalled();
	});

	it('answers 401 and says so when the site has never issued a token', async () => {
		await expect(
			GET(createEvent({ kv: createKv(), authorization: 'Bearer nks_whatever' }))
		).rejects.toMatchObject({
			status: 401,
			body: { message: expect.stringMatching(/not issued a stats token/) }
		});
	});

	it('answers 401 to a wrong or absent token without loading anything', async () => {
		const kv = createKv();
		await issueStatsToken(kv as never);

		await expect(GET(createEvent({ kv }))).rejects.toMatchObject({ status: 401 });
		await expect(GET(createEvent({ kv, authorization: 'Bearer nks_wrong' }))).rejects.toMatchObject(
			{ status: 401, body: { message: 'Invalid stats token' } }
		);
		expect(loadStatsSummary).not.toHaveBeenCalled();
	});

	it('returns the shared summary with site identity and no-store caching', async () => {
		vi.mocked(loadStatsSummary).mockResolvedValueOnce(SUMMARY as never);
		const kv = createKv();
		const { token } = await issueStatsToken(kv as never);
		const db = { prepare: vi.fn() };

		const response = await GET(
			createEvent({ kv, db, authorization: `Bearer ${token}`, search: '?window=7' })
		);

		expect(response.status).toBe(200);
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(loadStatsSummary).toHaveBeenCalledWith(db, 7);

		const body = await response.json();
		expect(body).toMatchObject({
			site: { name: 'NebulaKit', url: expect.stringMatching(/^https:\/\//) },
			...SUMMARY
		});
		expect(body.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
	});

	it('defaults the window like the admin page does', async () => {
		vi.mocked(loadStatsSummary).mockResolvedValueOnce({ ...SUMMARY, trafficWindow: 30 } as never);
		const kv = createKv();
		const { token } = await issueStatsToken(kv as never);

		await GET(createEvent({ kv, authorization: `Bearer ${token}`, search: '?window=45' }));
		expect(loadStatsSummary).toHaveBeenLastCalledWith(expect.anything(), 30);
	});

	it('answers 500 when the core counts throw', async () => {
		vi.mocked(loadStatsSummary).mockRejectedValueOnce(new Error('database is gone'));
		const kv = createKv();
		const { token } = await issueStatsToken(kv as never);

		await expect(GET(createEvent({ kv, authorization: `Bearer ${token}` }))).rejects.toMatchObject({
			status: 500
		});
	});
});
