import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/utils/page-views', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../src/lib/utils/page-views')>();
	return { ...actual, pruneViewStats: vi.fn().mockResolvedValue(undefined) };
});

import { pruneViewStats } from '$lib/utils/page-views';
import { POST } from '../../src/routes/api/cron/prune-view-stats/+server';

function createEvent(overrides: Record<string, any> = {}) {
	return {
		request: new Request('https://example.com/api/cron/prune-view-stats', {
			method: 'POST',
			headers: { authorization: 'Bearer test-secret' }
		}),
		platform: { env: { DB: {}, CRON_SECRET: 'test-secret' } },
		...overrides
	} as any;
}

describe('POST /api/cron/prune-view-stats', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('prunes rows older than the retention window', async () => {
		const response = await POST(createEvent());
		const body = await response.json();

		expect(pruneViewStats).toHaveBeenCalledWith({}, expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
		expect(body.prunedBefore).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});

	it('prunes to roughly 13 months back, not to today', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-07-28T12:00:00.000Z'));
		try {
			const response = await POST(createEvent());
			expect((await response.json()).prunedBefore).toBe('2025-06-23');
		} finally {
			vi.useRealTimers();
		}
	});

	it('rejects a missing or wrong bearer token', async () => {
		await expect(
			POST(
				createEvent({
					request: new Request('https://example.com/api/cron/prune-view-stats', {
						method: 'POST',
						headers: { authorization: 'Bearer wrong' }
					})
				})
			)
		).rejects.toHaveProperty('status', 401);
		expect(pruneViewStats).not.toHaveBeenCalled();
	});

	it('requires CRON_SECRET to be configured', async () => {
		await expect(POST(createEvent({ platform: { env: { DB: {} } } }))).rejects.toHaveProperty(
			'status',
			503
		);
	});

	it('requires a database', async () => {
		await expect(
			POST(createEvent({ platform: { env: { CRON_SECRET: 'test-secret' } } }))
		).rejects.toHaveProperty('status', 503);
	});
});
