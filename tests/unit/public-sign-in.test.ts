import fc from 'fast-check';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	AUTH_ROBOTS_TAG,
	isAuthPath,
	publicSignInEnabled,
	robotsTagFor
} from '../../src/lib/public-sign-in';

const segment = fc.stringMatching(/^[a-z0-9._-]{1,12}$/);
const path = fc.array(segment, { maxLength: 4 }).map((parts) => `/${parts.join('/')}`);

describe('publicSignInEnabled', () => {
	it('is off only for an explicit false; unset keeps old sites unchanged', () => {
		fc.assert(
			fc.property(fc.option(fc.boolean(), { nil: undefined }), (flag) => {
				expect(publicSignInEnabled({ publicSignIn: flag })).toBe(flag !== false);
			})
		);
		expect(publicSignInEnabled({})).toBe(true);
	});
});

describe('isAuthPath', () => {
	it('matches every path under /auth and /api/auth', () => {
		fc.assert(
			fc.property(fc.constantFrom('/auth', '/api/auth'), path, (prefix, rest) => {
				expect(isAuthPath(rest === '/' ? prefix : `${prefix}${rest}`)).toBe(true);
			})
		);
	});

	it('never matches a path outside them, including look-alike segments', () => {
		fc.assert(
			fc.property(path, (p) => {
				const inside =
					p === '/auth' ||
					p.startsWith('/auth/') ||
					p === '/api/auth' ||
					p.startsWith('/api/auth/');
				expect(isAuthPath(p)).toBe(inside);
			})
		);
		for (const p of ['/authors', '/auth.md', '/api/authz', '/shop/auth', '/']) {
			expect(isAuthPath(p)).toBe(false);
		}
	});

	it('robotsTagFor agrees with isAuthPath', () => {
		fc.assert(
			fc.property(path, (p) => {
				expect(robotsTagFor(p)).toBe(isAuthPath(p) ? AUTH_ROBOTS_TAG : null);
			})
		);
		expect(robotsTagFor('/api/auth/discord/callback')).toContain('noindex');
	});
});

describe('authRobotsHandler', () => {
	const run = async (pathname: string, response: Response) => {
		const { authRobotsHandler } = await import('../../src/hooks.server');
		return authRobotsHandler({
			event: { url: new URL(`https://shop.test${pathname}`) } as never,
			resolve: async () => response
		});
	};

	it('tags auth responses, redirects included, and leaves the rest alone', async () => {
		const callback = await run(
			'/api/auth/discord/callback',
			Response.redirect('https://shop.test/', 302)
		);
		expect(callback.status).toBe(302);
		expect(callback.headers.get('X-Robots-Tag')).toBe(AUTH_ROBOTS_TAG);
		expect((await run('/auth/login', new Response('x'))).headers.get('X-Robots-Tag')).toBe(
			AUTH_ROBOTS_TAG
		);
		expect((await run('/shop', new Response('x'))).headers.get('X-Robots-Tag')).toBeNull();
	});
});

describe('sign-up with publicSignIn: false', () => {
	afterEach(() => {
		vi.doUnmock('$lib/site.config');
		vi.resetModules();
	});

	const withFlag = async (publicSignIn: boolean) => {
		vi.resetModules();
		const real = await vi.importActual<typeof import('../../src/lib/site.config')>(
			'../../src/lib/site.config'
		);
		vi.doMock('$lib/site.config', () => ({ ...real, site: { ...real.site, publicSignIn } }));
	};

	it('the sign-up page is a 404', async () => {
		await withFlag(false);
		const { load } = await import('../../src/routes/auth/signup/+page.server');
		await expect(
			load({ locals: {}, url: new URL('https://shop.test/auth/signup'), platform: {} } as never)
		).rejects.toMatchObject({ status: 404 });
	});

	it('the sign-up API is a 404 before it reads the body', async () => {
		await withFlag(false);
		const { POST } = await import('../../src/routes/api/auth/signup/+server');
		const request = { json: vi.fn() };
		await expect(
			POST({
				platform: { env: { DB: {} } },
				request,
				url: new URL('https://shop.test/api/auth/signup')
			} as never)
		).rejects.toMatchObject({ status: 404 });
		expect(request.json).not.toHaveBeenCalled();
	});

	it('auth.md stops advertising sign-up', async () => {
		await withFlag(false);
		const off = await (
			await import('../../src/routes/auth.md/+server')
		).GET({
			url: new URL('https://shop.test/auth.md')
		} as never);
		expect(await off.text()).not.toContain('/api/auth/signup');

		await withFlag(true);
		const on = await (
			await import('../../src/routes/auth.md/+server')
		).GET({
			url: new URL('https://shop.test/auth.md')
		} as never);
		expect(await on.text()).toContain('/api/auth/signup');
	});
});
