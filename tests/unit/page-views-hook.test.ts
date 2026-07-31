import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/environment', () => ({ dev: false, browser: false, building: false }));

vi.mock('$lib/utils/page-views', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../src/lib/utils/page-views')>();
	return { ...actual, recordPageView: vi.fn().mockResolvedValue(undefined) };
});

import { recordPageView } from '$lib/utils/page-views';
import { pageViewsHandler } from '../../src/hooks.server';

function htmlResponse(status = 200) {
	return new Response('<html></html>', {
		status,
		headers: { 'content-type': 'text/html; charset=utf-8' }
	});
}

function createEvent(overrides: Record<string, any> = {}) {
	return {
		route: { id: '/blog' },
		url: new URL('https://example.com/blog'),
		// Not a real Request: 'referer' is a forbidden header name that the
		// Request constructor silently strips; a bare Headers object keeps it.
		request: {
			method: 'GET',
			headers: new Headers({
				'user-agent': 'Mozilla/5.0',
				referer: 'https://news.ycombinator.com/item?id=1'
			})
		},
		platform: { env: { DB: {} } },
		locals: {},
		...overrides
	} as any;
}

describe('page views hook', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('records a successful HTML view with route id, referrer, and signed-in flag', async () => {
		const resolve = vi.fn().mockResolvedValue(htmlResponse());
		const event = createEvent({ locals: { user: { id: 'u1' } } });

		await pageViewsHandler({ event, resolve });

		expect(recordPageView).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				pathKey: '/blog',
				signedIn: true,
				referrerHost: 'news.ycombinator.com'
			})
		);
	});

	it('stamps the UTC day and hour so the hourly counters line up', async () => {
		const resolve = vi.fn().mockResolvedValue(htmlResponse());
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-07-23T14:37:00.000Z'));
		try {
			await pageViewsHandler({ event: createEvent(), resolve });
		} finally {
			vi.useRealTimers();
		}

		expect(recordPageView).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ day: '2026-07-23', hour: 14 })
		);
	});

	it('passes the edge-provided country through (and only that — never an IP)', async () => {
		const resolve = vi.fn().mockResolvedValue(htmlResponse());
		const event = createEvent({ platform: { env: { DB: {} }, cf: { country: 'IN' } } });

		await pageViewsHandler({ event, resolve });

		expect(recordPageView).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ country: 'IN' })
		);
	});

	it('records with country undefined when the platform provides no cf data', async () => {
		const resolve = vi.fn().mockResolvedValue(htmlResponse());

		await pageViewsHandler({ event: createEvent(), resolve });

		expect(recordPageView).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ country: undefined })
		);
	});

	it('buckets audience dimensions from headers (never the raw UA)', async () => {
		const resolve = vi.fn().mockResolvedValue(htmlResponse());
		const event = createEvent({
			request: {
				method: 'GET',
				headers: new Headers({
					'user-agent': 'Mozilla/5.0 (Linux; Android 14) Chrome/125.0 Mobile',
					'sec-ch-ua': '"Google Chrome";v="125", "Chromium";v="125"',
					'sec-ch-ua-platform': '"Android"',
					'sec-ch-ua-mobile': '?1',
					'accept-language': 'pt-BR,pt;q=0.9'
				})
			}
		});

		await pageViewsHandler({ event, resolve });

		const recorded = vi.mocked(recordPageView).mock.calls[0][1];
		expect(recorded).toMatchObject({
			os: 'Android',
			browser: 'Chrome',
			device: 'mobile',
			language: 'pt-BR'
		});
		// The point of bucketing: nothing resembling the raw UA is handed on.
		expect(JSON.stringify(recorded)).not.toContain('Mozilla');
	});

	it('uses waitUntil when the platform provides it', async () => {
		const resolve = vi.fn().mockResolvedValue(htmlResponse());
		const waitUntil = vi.fn();
		const event = createEvent({ platform: { env: { DB: {} }, context: { waitUntil } } });

		await pageViewsHandler({ event, resolve });

		expect(waitUntil).toHaveBeenCalledTimes(1);
	});

	it.each([
		['non-200 response', { resolveWith: htmlResponse(404) }],
		[
			'non-HTML response',
			{ resolveWith: new Response('{}', { headers: { 'content-type': 'application/json' } }) }
		],
		['admin route', { event: { route: { id: '/admin/stats' } } }],
		['api route', { event: { route: { id: '/api/chat' } } }],
		['setup route', { event: { route: { id: '/setup' } } }],
		['unmatched route', { event: { route: { id: null } } }],
		[
			'bot user-agent',
			{
				event: {
					request: new Request('https://example.com/blog', {
						headers: { 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' }
					})
				}
			}
		],
		['missing DB', { event: { platform: undefined } }],
		[
			'POST request',
			{
				event: {
					request: new Request('https://example.com/blog', {
						method: 'POST',
						headers: { 'user-agent': 'Mozilla/5.0' }
					})
				}
			}
		]
	])('does not record: %s', async (_name, setup: any) => {
		const resolve = vi.fn().mockResolvedValue(setup.resolveWith ?? htmlResponse());
		const event = createEvent(setup.event ?? {});

		const response = await pageViewsHandler({ event, resolve });

		expect(recordPageView).not.toHaveBeenCalled();
		expect(response).toBeDefined();
	});

	it('swallows recording failures without breaking the response', async () => {
		vi.mocked(recordPageView).mockRejectedValueOnce(new Error('D1 down'));
		const resolve = vi.fn().mockResolvedValue(htmlResponse());

		const response = await pageViewsHandler({ event: createEvent(), resolve });
		expect(response.status).toBe(200);
	});
});
