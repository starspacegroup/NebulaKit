import { describe, expect, it, vi } from 'vitest';
import {
	REDIRECT_EXEMPT_PREFIXES,
	canonicalHostname,
	canonicalRedirect,
	shouldNoindexHost,
	withHostRobots
} from '../../src/lib/server/canonical-host';
import { canonicalHostHandler } from '../../src/hooks.server';
import { site } from '../../src/lib/site.config';

const SITE = 'https://example.com';
const redirect = (url: string, method = 'GET', siteUrl = SITE) =>
	canonicalRedirect(new URL(url), method, siteUrl);

describe('canonicalRedirect', () => {
	it('sends www to the apex with 301 for reads, path and query kept', () => {
		for (const method of ['GET', 'HEAD']) {
			const response = redirect('https://www.example.com/a/b?x=1', method)!;
			expect(response.status).toBe(301);
			expect(response.headers.get('location')).toBe('https://example.com/a/b?x=1');
		}
	});
	it('uses 308 for anything that is not a read, so the body survives', () => {
		for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
			expect(redirect('https://www.example.com/x', method)!.status).toBe(308);
		}
	});
	it('forces https and drops a stray port', () => {
		expect(redirect('http://www.example.com:8080/x')!.headers.get('location')).toBe(
			'https://example.com/x'
		);
	});
	it('is case-insensitive about the host', () => {
		expect(redirect('https://WWW.Example.com/x')).not.toBeNull();
	});
	it('does nothing on the canonical host itself', () => {
		expect(redirect('https://example.com/x')).toBeNull();
	});
	it('does nothing on localhost, pages.dev, previews and tunnels', () => {
		for (const host of [
			'localhost:4277',
			'127.0.0.1:4277',
			'abc123.example.com',
			'preview.example.com',
			'foo.pages.dev',
			'www.foo.pages.dev',
			'quiet-rain.trycloudflare.com'
		]) {
			expect(redirect(`https://${host}/x`)).toBeNull();
		}
	});
	it('does nothing when the configured site is itself local or platform hosted', () => {
		expect(
			redirect('https://www.nebulakit.pages.dev/x', 'GET', 'https://nebulakit.pages.dev')
		).toBeNull();
		expect(redirect('https://www.localhost/x', 'GET', 'http://localhost:4277')).toBeNull();
		expect(redirect('https://1.2.3.4/x', 'GET', 'https://1.2.3.4')).toBeNull();
		expect(redirect('https://www.x.test/x', 'GET', 'not a url')).toBeNull();
	});
	it('does nothing when the canonical host is itself www', () => {
		expect(redirect('https://www.example.com/x', 'GET', 'https://www.example.com')).toBeNull();
	});
	it('exempts webhooks and cron, which cannot follow a redirect', () => {
		for (const prefix of REDIRECT_EXEMPT_PREFIXES) {
			expect(redirect(`https://www.example.com${prefix}`, 'POST')).toBeNull();
			expect(redirect(`https://www.example.com${prefix}/stripe`, 'POST')).toBeNull();
		}
		expect(redirect('https://www.example.com/api/cronical')).not.toBeNull();
	});
	it('takes the host from site.config, never a literal', () => {
		expect(canonicalHostname()).toBe(new URL(site.url).hostname);
		const wwwSite = `www.${new URL(site.url).hostname}`;
		// Default site.url is a pages.dev host, so the default config never redirects.
		expect(canonicalRedirect(new URL(`https://${wwwSite}/`), 'GET')).toBeNull();
	});
});

describe('noindex for non-canonical hosts', () => {
	it('marks every host except the canonical one', () => {
		expect(shouldNoindexHost('example.com', SITE)).toBe(false);
		expect(shouldNoindexHost('EXAMPLE.com', SITE)).toBe(false);
		expect(shouldNoindexHost('foo.pages.dev', SITE)).toBe(true);
		expect(shouldNoindexHost('staging.example.com', SITE)).toBe(true);
		expect(shouldNoindexHost('localhost', SITE)).toBe(true);
	});
	it('sets x-robots-tag, and copies a response with immutable headers', () => {
		const ok = withHostRobots(new Response('x'), 'foo.pages.dev', SITE);
		expect(ok.headers.get('x-robots-tag')).toBe('noindex, nofollow');
		const frozen = Response.redirect('https://example.com/', 302);
		const marked = withHostRobots(frozen, 'foo.pages.dev', SITE);
		expect(marked.status).toBe(302);
		expect(marked.headers.get('location')).toBe('https://example.com/');
		expect(marked.headers.get('x-robots-tag')).toBe('noindex, nofollow');
	});
	it('leaves canonical responses alone', () => {
		const response = new Response('x');
		expect(withHostRobots(response, 'example.com', SITE)).toBe(response);
		expect(response.headers.get('x-robots-tag')).toBeNull();
	});
});

describe('canonicalHostHandler', () => {
	const call = (url: string, method = 'GET') => {
		const resolve = vi.fn(async () => new Response('page'));
		return {
			resolve,
			promise: canonicalHostHandler({
				event: { url: new URL(url), request: new Request(url, { method }) } as never,
				resolve
			})
		};
	};
	it('marks a non-canonical host noindex and resolves normally', async () => {
		const { promise, resolve } = call('http://localhost:4277/');
		const response = await promise;
		expect(resolve).toHaveBeenCalledOnce();
		expect(await response.text()).toBe('page');
		expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
	});
	it('leaves the configured canonical host indexable', async () => {
		const { promise } = call(`${site.url}/`);
		expect((await promise).headers.get('x-robots-tag')).toBeNull();
	});
});
