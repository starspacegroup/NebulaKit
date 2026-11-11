import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	GATE_ALLOWLIST,
	SITE_MODE_KEY,
	SITE_MODE_TTL_MS,
	gatedResponse,
	holdingPageHtml,
	isReachableWhileGated,
	parseSiteMode,
	readSiteMode,
	resetSiteModeCache,
	writeSiteMode
} from '$lib/server/site-mode';
import { siteModeHandler } from '../../src/hooks.server';

const kvWith = (value: string | null) => ({ get: vi.fn(async () => value), put: vi.fn() }) as any;
const ON = JSON.stringify({ mode: 'coming-soon' });

function run(opts: { kv?: any; user?: any; path?: string; method?: string }) {
	const resolve = vi.fn(async () => new Response('real page'));
	const event: any = {
		url: new URL(`https://example.com${opts.path ?? '/'}`),
		request: new Request(`https://example.com${opts.path ?? '/'}`, { method: opts.method ?? 'GET' }),
		platform: { env: { KV: opts.kv } },
		locals: { user: opts.user }
	};
	return { resolve, result: siteModeHandler({ event, resolve } as any) };
}

describe('site mode config', () => {
	beforeEach(() => resetSiteModeCache());

	it('parses unknown and malformed values as off', () => {
		expect(parseSiteMode(null)).toBe('off');
		expect(parseSiteMode('not json')).toBe('off');
		expect(parseSiteMode('{"mode":"maintenance"}')).toBe('off');
		expect(parseSiteMode('null')).toBe('off');
		expect(parseSiteMode(ON)).toBe('coming-soon');
	});

	it('fails open without a binding or when KV throws', async () => {
		expect(await readSiteMode(undefined)).toBe('off');
		const err = vi.spyOn(console, 'error').mockImplementation(() => {});
		const kv = { get: vi.fn(async () => Promise.reject(new Error('down'))) } as any;
		expect(await readSiteMode(kv)).toBe('off');
		err.mockRestore();
	});

	it('caches the off state, then re-reads after the TTL', async () => {
		const kv = kvWith(null);
		await readSiteMode(kv, 1000);
		await readSiteMode(kv, 1000 + SITE_MODE_TTL_MS - 1);
		expect(kv.get).toHaveBeenCalledTimes(1);
		await readSiteMode(kv, 1000 + SITE_MODE_TTL_MS + 1);
		expect(kv.get).toHaveBeenCalledTimes(2);
	});

	it('writing the setting clears the cache', async () => {
		const kv = kvWith(ON);
		expect(await readSiteMode(kv)).toBe('coming-soon');
		await writeSiteMode(kv, 'off');
		expect(kv.put).toHaveBeenCalledWith(SITE_MODE_KEY, expect.stringContaining('"off"'));
		await readSiteMode(kv);
		expect(kv.get).toHaveBeenCalledTimes(2);
	});
});

describe('reachable-route allowlist', () => {
	it.each([
		'/setup',
		'/auth/login',
		'/auth/signup',
		'/api/auth/login',
		'/api/auth/github/callback',
		'/api/v1/webhooks/stripe',
		'/api/cron/anything',
		'/_app/immutable/x.js',
		'/robots.txt'
	])('%s stays reachable', (p) => expect(isReachableWhileGated(p)).toBe(true));

	it.each(['/', '/shop', '/authors', '/auth-evil', '/admin', '/api/v1/orders', '/sitemap.xml'])(
		'%s is gated',
		(p) => expect(isReachableWhileGated(p)).toBe(false)
	);

	it('keeps sign-in routes on the list', () => {
		for (const p of ['/setup', '/auth', '/api/auth']) expect(GATE_ALLOWLIST).toContain(p);
	});
});

describe('holding page', () => {
	it('is a 200 HTML page for a read, uncached', async () => {
		const res = gatedResponse('GET');
		expect(res.status).toBe(200);
		expect(res.headers.get('content-type')).toContain('text/html');
		expect(res.headers.get('cache-control')).toBe('no-store');
		expect(await res.text()).toBe(holdingPageHtml());
	});

	it('answers HEAD without a body and refuses writes with 503 + Retry-After', async () => {
		expect(await gatedResponse('HEAD').text()).toBe('');
		const res = gatedResponse('POST');
		expect(res.status).toBe(503);
		expect(res.headers.get('retry-after')).toBe('3600');
	});
});

describe('siteModeHandler', () => {
	beforeEach(() => resetSiteModeCache());

	it('passes everything through when off', async () => {
		const { resolve, result } = run({ kv: kvWith(null) });
		expect(await (await result).text()).toBe('real page');
		expect(resolve).toHaveBeenCalled();
	});

	it('passes through when there is no KV binding', async () => {
		const { resolve, result } = run({});
		await result;
		expect(resolve).toHaveBeenCalled();
	});

	it('shows signed-out visitors the holding page when on', async () => {
		const { resolve, result } = run({ kv: kvWith(ON), path: '/shop' });
		const res = await result;
		expect(res.status).toBe(200);
		expect(await res.text()).toContain('Coming soon');
		expect(resolve).not.toHaveBeenCalled();
	});

	it('gates a signed-in non-admin too', async () => {
		const { resolve, result } = run({ kv: kvWith(ON), user: { isAdmin: false } });
		await result;
		expect(resolve).not.toHaveBeenCalled();
	});

	it('lets an admin through', async () => {
		const { resolve, result } = run({ kv: kvWith(ON), user: { isAdmin: true }, path: '/admin' });
		expect(await (await result).text()).toBe('real page');
		expect(resolve).toHaveBeenCalled();
	});

	it('lets the sign-in route through for a signed-out visitor', async () => {
		const { resolve, result } = run({ kv: kvWith(ON), path: '/auth/login' });
		await result;
		expect(resolve).toHaveBeenCalled();
	});

	it('refuses a signed-out write with 503', async () => {
		const { result } = run({ kv: kvWith(ON), path: '/api/v1/orders', method: 'POST' });
		expect((await result).status).toBe(503);
	});
});
