/**
 * Direct tests for the server-side authorization and OAuth-state primitives.
 *
 * These are small, but everything that gates an admin endpoint or a login now
 * routes through them, so their branches are worth pinning individually rather
 * than only incidentally via the route tests.
 */
import { describe, expect, it, vi } from 'vitest';
import {
	isAdminUser,
	isOwnerUser,
	requireAdmin,
	requireOwner
} from '../../src/lib/server/auth-guard';
import {
	OAUTH_PROVIDERS,
	authConfigKey,
	findProviderByKeyId,
	isSupportedOAuthProvider
} from '../../src/lib/server/oauth-config';
import { consumeOAuthState, issueOAuthState } from '../../src/lib/server/oauth-state';

const owner = { user: { id: '1', login: 'o', email: 'o@e.com', isOwner: true, isAdmin: true } };
const admin = { user: { id: '2', login: 'a', email: 'a@e.com', isOwner: false, isAdmin: true } };
const plain = { user: { id: '3', login: 'p', email: 'p@e.com', isOwner: false, isAdmin: false } };

describe('requireAdmin', () => {
	it('accepts an owner and an admin', () => {
		expect(() => requireAdmin(owner as any)).not.toThrow();
		expect(() => requireAdmin(admin as any)).not.toThrow();
	});

	it('401s with no locals at all', () => {
		expect(() => requireAdmin(undefined)).toThrowError(expect.objectContaining({ status: 401 }));
	});

	it('401s when locals carries no user', () => {
		expect(() => requireAdmin({} as any)).toThrowError(expect.objectContaining({ status: 401 }));
	});

	it('403s an authenticated non-admin', () => {
		expect(() => requireAdmin(plain as any)).toThrowError(expect.objectContaining({ status: 403 }));
	});

	it('403s a user whose isAdmin is simply absent', () => {
		const noFlags = { user: { id: '4', login: 'n', email: 'n@e.com', isOwner: false } };
		expect(() => requireAdmin(noFlags as any)).toThrowError(
			expect.objectContaining({ status: 403 })
		);
	});
});

describe('requireOwner', () => {
	it('accepts the owner', () => {
		expect(() => requireOwner(owner as any)).not.toThrow();
	});

	it('401s with no locals and no user', () => {
		expect(() => requireOwner(undefined)).toThrowError(expect.objectContaining({ status: 401 }));
		expect(() => requireOwner({} as any)).toThrowError(expect.objectContaining({ status: 401 }));
	});

	it('403s an admin who is not the owner', () => {
		// The distinction matters: /api/reset wipes the owner identity, so admin
		// is deliberately not enough.
		expect(() => requireOwner(admin as any)).toThrowError(expect.objectContaining({ status: 403 }));
	});
});

describe('oauth-config', () => {
	it('recognises exactly the supported providers', () => {
		for (const p of OAUTH_PROVIDERS) {
			expect(isSupportedOAuthProvider(p)).toBe(true);
		}
		expect(isSupportedOAuthProvider('reset_route_disabled')).toBe(false);
		expect(isSupportedOAuthProvider('')).toBe(false);
		expect(isSupportedOAuthProvider(undefined)).toBe(false);
		expect(isSupportedOAuthProvider(42)).toBe(false);
	});

	it('namespaces provider configs', () => {
		expect(authConfigKey('github')).toBe('auth_config:github');
	});

	it('finds the provider holding an id', async () => {
		const kv = {
			get: vi.fn((key: string) =>
				Promise.resolve(
					key === 'auth_config:discord' ? JSON.stringify({ id: 'k1', provider: 'discord' }) : null
				)
			)
		};

		const found = await findProviderByKeyId(kv as any, 'k1');
		expect(found?.provider).toBe('discord');
	});

	it('returns null when no provider claims the id', async () => {
		const kv = { get: vi.fn().mockResolvedValue(null) };
		expect(await findProviderByKeyId(kv as any, 'nope')).toBeNull();
	});

	it('steps over an unreadable provider config and keeps looking', async () => {
		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const kv = {
			get: vi.fn((key: string) =>
				Promise.resolve(
					key === 'auth_config:github'
						? 'not json'
						: key === 'auth_config:discord'
							? JSON.stringify({ id: 'k1', provider: 'discord' })
							: null
				)
			)
		};

		const found = await findProviderByKeyId(kv as any, 'k1');
		expect(found?.provider).toBe('discord');
		expect(consoleSpy).toHaveBeenCalled();
		consoleSpy.mockRestore();
	});
});

describe('oauth state', () => {
	const makeJar = (stored?: string) => ({
		get: vi.fn(() => stored),
		set: vi.fn(),
		delete: vi.fn()
	});

	it('issues an HttpOnly, SameSite=Lax cookie and returns the value', () => {
		const jar = makeJar();
		const state = issueOAuthState(jar as any, 'github', true);

		expect(state).toEqual(expect.any(String));
		expect(jar.set).toHaveBeenCalledWith(
			'oauth_state_github',
			state,
			expect.objectContaining({ httpOnly: true, sameSite: 'lax', secure: true, path: '/' })
		);
	});

	it('leaves the cookie insecure over plain http so local dev still works', () => {
		const jar = makeJar();
		issueOAuthState(jar as any, 'discord', false);
		expect(jar.set).toHaveBeenCalledWith(
			'oauth_state_discord',
			expect.any(String),
			expect.objectContaining({ secure: false })
		);
	});

	it('accepts a matching state and burns the cookie', () => {
		const jar = makeJar('abc123');
		expect(consumeOAuthState(jar as any, 'github', 'abc123')).toBe(true);
		expect(jar.delete).toHaveBeenCalledWith('oauth_state_github', { path: '/' });
	});

	it('rejects a mismatched state of equal length', () => {
		const jar = makeJar('abc123');
		expect(consumeOAuthState(jar as any, 'github', 'abc124')).toBe(false);
	});

	it('rejects a state of a different length', () => {
		const jar = makeJar('abc123');
		expect(consumeOAuthState(jar as any, 'github', 'abc')).toBe(false);
	});

	it('rejects when no cookie was stored', () => {
		const jar = makeJar(undefined);
		expect(consumeOAuthState(jar as any, 'github', 'anything')).toBe(false);
	});

	it('rejects when the callback carried no state', () => {
		const jar = makeJar('abc123');
		expect(consumeOAuthState(jar as any, 'github', null)).toBe(false);
	});

	it('clears the cookie even on rejection, so a state cannot be retried', () => {
		const jar = makeJar('abc123');
		consumeOAuthState(jar as any, 'github', 'wrong!');
		expect(jar.delete).toHaveBeenCalledWith('oauth_state_github', { path: '/' });
	});
});

describe('superadmin tier', () => {
	// stats-guard.ts honours `isSuperAdmin` for downstream apps that add a tier
	// above owner/admin. These guards must agree, or such a user would pass the
	// stats checks while being refused by every admin API.
	const superadmin = { user: { id: '9', login: 's', email: 's@e.com', isSuperAdmin: true } };

	it('treats a superadmin as both admin and owner', () => {
		expect(() => requireAdmin(superadmin as any)).not.toThrow();
		expect(() => requireOwner(superadmin as any)).not.toThrow();
	});

	it('exposes the same policy as predicates', () => {
		expect(isAdminUser({ isSuperAdmin: true })).toBe(true);
		expect(isOwnerUser({ isSuperAdmin: true })).toBe(true);
		expect(isAdminUser({ isAdmin: true })).toBe(true);
		expect(isOwnerUser({ isAdmin: true })).toBe(false);
		expect(isAdminUser({})).toBe(false);
		expect(isOwnerUser({})).toBe(false);
	});

	it('returns false for a missing user rather than throwing', () => {
		expect(isAdminUser(null)).toBe(false);
		expect(isAdminUser(undefined)).toBe(false);
		expect(isOwnerUser(null)).toBe(false);
		expect(isOwnerUser(undefined)).toBe(false);
	});
});
