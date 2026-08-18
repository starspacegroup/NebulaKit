import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/utils/usage', () => ({ recordRequest: vi.fn() }));
vi.mock('$lib/agent-discovery', () => ({
	buildLinkHeader: vi.fn(() => '</robots.txt>; rel="robots"')
}));
vi.mock('$lib/server/markdown-negotiation', () => ({
	isConvertibleHtml: vi.fn(),
	prefersMarkdown: vi.fn(),
	toMarkdownResponse: vi.fn()
}));

import {
	isConvertibleHtml,
	prefersMarkdown,
	toMarkdownResponse
} from '$lib/server/markdown-negotiation';
import { recordRequest } from '$lib/utils/usage';
import { agentDiscoveryHandler, pageViewsHandler, usageHandler } from '../../src/hooks.server';

function event(overrides: Record<string, unknown> = {}): any {
	return {
		request: new Request('https://example.com/missing', {
			headers: { 'user-agent': 'Googlebot', accept: 'text/html' }
		}),
		platform: undefined,
		...overrides
	};
}

describe('usageHandler', () => {
	beforeEach(() => vi.clearAllMocks());

	it('returns the response without recording when D1 is unavailable', async () => {
		const response = new Response('ok', { status: 200 });
		await expect(
			usageHandler({ event: event(), resolve: vi.fn(async () => response) })
		).resolves.toBe(response);
		expect(recordRequest).not.toHaveBeenCalled();
	});

	it('records billed bot and not-found dimensions without scheduling when buffered', async () => {
		vi.mocked(recordRequest).mockReturnValue(null);
		const waitUntil = vi.fn();
		const response = new Response('missing', { status: 404 });

		await usageHandler({
			event: event({ platform: { env: { DB: {} }, context: { waitUntil } } }),
			resolve: vi.fn(async () => response)
		});

		expect(recordRequest).toHaveBeenCalledWith(
			{},
			expect.objectContaining({ bot: true, notFound: true })
		);
		expect(waitUntil).not.toHaveBeenCalled();
	});

	it('records a successful browser request as neither bot nor not-found', async () => {
		vi.mocked(recordRequest).mockReturnValue(null);
		const browserRequest = new Request('https://example.com/', {
			headers: { 'user-agent': 'Mozilla/5.0' }
		});

		await usageHandler({
			event: event({ request: browserRequest, platform: { env: { DB: {} } } }),
			resolve: vi.fn(async () => new Response('ok', { status: 200 }))
		});

		expect(recordRequest).toHaveBeenCalledWith(
			{},
			expect.objectContaining({ bot: false, notFound: false })
		);
	});

	it('schedules due writes and suppresses asynchronous storage failures', async () => {
		vi.mocked(recordRequest).mockReturnValue(Promise.reject(new Error('D1 unavailable')));
		const waitUntil = vi.fn();

		await usageHandler({
			event: event({ platform: { env: { DB: {} }, context: { waitUntil } } }),
			resolve: vi.fn(async () => new Response('ok'))
		});

		expect(waitUntil).toHaveBeenCalledOnce();
		await expect(waitUntil.mock.calls[0][0]).resolves.toBeUndefined();
	});

	it('awaits a due write when waitUntil is unavailable', async () => {
		vi.mocked(recordRequest).mockReturnValue(Promise.resolve());

		await expect(
			usageHandler({
				event: event({ platform: { env: { DB: {} } } }),
				resolve: vi.fn(async () => new Response('ok'))
			})
		).resolves.toHaveProperty('status', 200);
	});
});

describe('pageViewsHandler', () => {
	it('does not record crawler traffic as a human page view', async () => {
		const response = new Response('<main>Page</main>', {
			headers: { 'content-type': 'text/html' }
		});

		await expect(
			pageViewsHandler({
				event: {
					...event({ platform: { env: { DB: {} } } }),
					route: { id: '/' },
					locals: {},
					url: new URL('https://example.com/')
				} as never,
				resolve: vi.fn(async () => response)
			})
		).resolves.toBe(response);
	});
});

describe('agentDiscoveryHandler', () => {
	beforeEach(() => vi.clearAllMocks());

	it('leaves non-HTML responses untouched', async () => {
		vi.mocked(isConvertibleHtml).mockReturnValue(false);
		const response = new Response('{}', { headers: { 'content-type': 'application/json' } });

		await expect(
			agentDiscoveryHandler({ event: event(), resolve: vi.fn(async () => response) })
		).resolves.toBe(response);
		expect(prefersMarkdown).not.toHaveBeenCalled();
	});

	it('advertises discovery on HTML while preserving an HTML request', async () => {
		vi.mocked(isConvertibleHtml).mockReturnValue(true);
		vi.mocked(prefersMarkdown).mockReturnValue(false);
		const response = new Response('<main>Page</main>', {
			headers: { 'content-type': 'text/html' }
		});

		const result = await agentDiscoveryHandler({
			event: event(),
			resolve: vi.fn(async () => response)
		});

		expect(result).toBe(response);
		expect(result.headers.get('Link')).toContain('/robots.txt');
		expect(result.headers.get('Vary')).toBe('Accept');
		expect(toMarkdownResponse).not.toHaveBeenCalled();
	});

	it('returns converted Markdown when requested', async () => {
		vi.mocked(isConvertibleHtml).mockReturnValue(true);
		vi.mocked(prefersMarkdown).mockReturnValue(true);
		const markdown = new Response('# Page', { headers: { 'content-type': 'text/markdown' } });
		vi.mocked(toMarkdownResponse).mockResolvedValue(markdown);

		await expect(
			agentDiscoveryHandler({
				event: event(),
				resolve: vi.fn(async () => new Response('<main>Page</main>'))
			})
		).resolves.toBe(markdown);
	});

	it('falls back to the original HTML when conversion fails', async () => {
		vi.mocked(isConvertibleHtml).mockReturnValue(true);
		vi.mocked(prefersMarkdown).mockReturnValue(true);
		vi.mocked(toMarkdownResponse).mockRejectedValue(new Error('conversion failed'));
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const html = new Response('<main>Page</main>');

		await expect(
			agentDiscoveryHandler({ event: event(), resolve: vi.fn(async () => html) })
		).resolves.toBe(html);
		expect(console.error).toHaveBeenCalledWith(
			'markdown negotiation: conversion failed',
			expect.any(Error)
		);
	});
});
