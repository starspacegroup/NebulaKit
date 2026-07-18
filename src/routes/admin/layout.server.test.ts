import { describe, expect, it } from 'vitest';
import { load } from './+layout.server';

function event(opts: { user?: { isOwner?: boolean; isAdmin?: boolean } | null; cookie?: string }) {
	return {
		locals: { user: opts.user ?? undefined },
		cookies: { get: () => opts.cookie }
	};
}

describe('admin layout guard', () => {
	it('redirects anonymous users to login', async () => {
		await expect(load(event({ user: null }) as never)).rejects.toMatchObject({
			status: 302,
			location: '/auth/login?error=unauthorized'
		});
	});

	it('redirects non-admin, non-owner users away', async () => {
		await expect(load(event({ user: {} }) as never)).rejects.toMatchObject({
			status: 302,
			location: '/?error=forbidden'
		});
	});

	it('allows admins but does not let them reveal PII', async () => {
		const data = (await load(event({ user: { isAdmin: true }, cookie: '1' }) as never)) as {
			canRevealPii: boolean;
			piiRevealed: boolean;
		};
		expect(data.canRevealPii).toBe(false);
		expect(data.piiRevealed).toBe(false);
	});

	it('lets an owner reveal PII when the cookie is set', async () => {
		const data = (await load(event({ user: { isOwner: true }, cookie: '1' }) as never)) as {
			canRevealPii: boolean;
			piiRevealed: boolean;
		};
		expect(data.canRevealPii).toBe(true);
		expect(data.piiRevealed).toBe(true);
	});

	it('keeps an owner masked until the cookie is set', async () => {
		const data = (await load(event({ user: { isOwner: true } }) as never)) as {
			piiRevealed: boolean;
		};
		expect(data.piiRevealed).toBe(false);
	});
});
