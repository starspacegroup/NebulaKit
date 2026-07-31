import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/utils/page-views', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../src/lib/utils/page-views')>();
	return { ...actual, recordViewportSample: vi.fn().mockResolvedValue(undefined) };
});

import { recordViewportSample } from '$lib/utils/page-views';
import { POST } from '../../src/routes/api/stats/viewport/+server';

function beacon(body: unknown, headers: Record<string, string> = {}) {
	return new Request('https://example.com/api/stats/viewport', {
		method: 'POST',
		headers: { 'content-type': 'application/json', ...headers },
		body: typeof body === 'string' ? body : JSON.stringify(body)
	});
}

function createEvent(overrides: Record<string, any> = {}) {
	return {
		request: beacon({ width: 1280 }),
		platform: { env: { DB: {} } },
		...overrides
	} as any;
}

describe('POST /api/stats/viewport', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('stores only the breakpoint bucket, never the raw width', async () => {
		const response = await POST(createEvent());

		expect(await response.json()).toEqual({ received: true });
		expect(recordViewportSample).toHaveBeenCalledWith(
			{},
			expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
			'1024-1535'
		);
	});

	it('uses waitUntil when the platform provides it', async () => {
		const waitUntil = vi.fn();
		await POST(createEvent({ platform: { env: { DB: {} }, context: { waitUntil } } }));

		expect(waitUntil).toHaveBeenCalledTimes(1);
	});

	it.each([
		['a bot user-agent', { request: beacon({ width: 1280 }, { 'user-agent': 'Googlebot/2.1' }) }],
		['no database', { platform: undefined }],
		['malformed JSON', { request: beacon('not json') }],
		['a non-numeric width', { request: beacon({ width: '1280' }) }],
		['an out-of-range width', { request: beacon({ width: 99_999 }) }],
		['a missing width', { request: beacon({}) }]
	])('records nothing for %s', async (_name, overrides: any) => {
		const response = await POST(createEvent(overrides));

		// Always 200: a beacon is fire-and-forget, so a rejected sample is still
		// an accepted request as far as the caller is concerned.
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ received: true });
		expect(recordViewportSample).not.toHaveBeenCalled();
	});
});
