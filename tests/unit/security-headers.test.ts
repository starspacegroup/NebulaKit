import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SECURITY_HEADERS, withSecurityHeaders } from '../../src/lib/server/security-headers';
import { securityHeadersHandler } from '../../src/hooks.server';

describe('security headers', () => {
	it('adds every header and keeps one a route already set', () => {
		const response = withSecurityHeaders(
			new Response('x', { headers: { 'X-Frame-Options': 'DENY' } })
		);
		expect(response.headers.get('X-Frame-Options')).toBe('DENY');
		expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
		expect(response.headers.get('Strict-Transport-Security')).toBe('max-age=31536000');
		expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
	});

	it('copes with immutable headers (a fetch passthrough)', async () => {
		const upstream = await Promise.resolve(
			new Response('body', { status: 202, headers: { 'X-Test': '1' } })
		);
		Object.defineProperty(upstream.headers, 'set', {
			value: () => {
				throw new TypeError('immutable');
			}
		});
		const response = withSecurityHeaders(upstream);
		expect(response.status).toBe(202);
		expect(await response.text()).toBe('body');
		expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
		expect(response.headers.get('X-Test')).toBe('1');
	});

	it('is applied by the hook, redirects included', async () => {
		const redirect = Response.redirect('https://shop.test/x', 302);
		const response = await securityHeadersHandler({
			event: {} as never,
			resolve: async () => redirect
		});
		expect(response.status).toBe(302);
		expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
	});

	it('_headers repeats exactly the Worker headers', () => {
		const file = readFileSync('_headers', 'utf8');
		const block = file
			.split(/\n\n/)
			.find((part) => part.includes('\n/*\n') || part.startsWith('/*'));
		const lines = (block ?? '')
			.split('\n')
			.filter((line) => line.startsWith('  ') && line.includes(':'))
			.map((line) => line.trim().split(/:\s*/, 2) as [string, string]);
		expect(Object.fromEntries(lines)).toEqual(SECURITY_HEADERS);
	});
});
