import { webcrypto } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('Auth Session Utilities', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.stubGlobal('crypto', webcrypto as Crypto);
	});

	it('creates a session user from GitHub-backed data', async () => {
		const { createSessionUser } = await import('../../src/lib/utils/session');

		expect(
			createSessionUser({
				id: 'user-1',
				email: 'primary@example.com',
				name: 'Primary User',
				github_login: 'octocat',
				github_avatar_url: 'https://example.com/avatar.png',
				is_admin: 1,
				isOwner: true
			})
		).toEqual({
			id: 'user-1',
			login: 'octocat',
			email: 'primary@example.com',
			name: 'Primary User',
			avatarUrl: 'https://example.com/avatar.png',
			isOwner: true,
			isAdmin: true,
			githubLogin: 'octocat'
		});
	});

	it('derives fallback login and name from email when GitHub login is absent', async () => {
		const { createSessionUser } = await import('../../src/lib/utils/session');

		const sessionUser = createSessionUser({
			id: 'user-2',
			email: 'fallback@example.com',
			name: null,
			is_admin: false
		});

		expect(sessionUser.login).toBe('fallback');
		expect(sessionUser.name).toBe('fallback');
		expect(sessionUser.isAdmin).toBe(false);
	});

	it('verifies signed session cookies and rejects unsigned or tampered payloads', async () => {
		const { decodeSessionCookie, encodeSession } = await import('../../src/lib/utils/session');
		const secret = 'test-session-secret';

		const encoded = await encodeSession(
			{
				id: 'user-1',
				login: 'octocat',
				email: 'primary@example.com',
				name: 'Primary User',
				isOwner: false,
				isAdmin: true,
				githubLogin: 'octocat'
			},
			secret
		);

		expect((await decodeSessionCookie(encoded, secret))?.login).toBe('octocat');
		expect(await decodeSessionCookie()).toBeNull();
		expect(await decodeSessionCookie('not-valid-base64', secret)).toBeNull();
		expect(await decodeSessionCookie(encoded.split('.')[0], secret)).toBeNull();
		expect(await decodeSessionCookie(`${encoded.slice(0, -1)}x`, secret)).toBeNull();
	});

	it('refuses to issue sessions without a production secret', async () => {
		vi.stubEnv('PROD', true);
		vi.stubEnv('DEV', false);
		const { encodeSession } = await import('../../src/lib/utils/session');

		await expect(
			encodeSession(
				{
					id: 'user-1',
					login: 'octocat',
					email: 'primary@example.com',
					isOwner: false
				},
				undefined
			)
		).rejects.toThrow('SESSION_SECRET');
	});

	it('adds the Secure attribute for https cookies only', async () => {
		const { buildSessionCookieHeader } = await import('../../src/lib/utils/session');

		const sessionUser = {
			id: 'user-1',
			login: 'octocat',
			email: 'primary@example.com',
			name: 'Primary User',
			isOwner: false,
			isAdmin: false
		};

		expect(
			await buildSessionCookieHeader(
				sessionUser,
				new URL('https://localhost/profile'),
				'test-session-secret'
			)
		).toContain('Secure');
		expect(
			await buildSessionCookieHeader(
				sessionUser,
				new URL('http://localhost/profile'),
				'test-session-secret'
			)
		).not.toContain('Secure');
	});

	it('signs opaque database session tokens and rejects unsigned tokens', async () => {
		const { buildDatabaseSessionCookieHeader, decodeDatabaseSessionCookie } =
			await import('../../src/lib/utils/session');
		const header = await buildDatabaseSessionCookieHeader(
			'opaque-token',
			new URL('https://example.com'),
			'test-session-secret'
		);
		const cookie = header.match(/^session=([^;]+)/)?.[1];

		await expect(decodeDatabaseSessionCookie(cookie, 'test-session-secret')).resolves.toBe(
			'opaque-token'
		);
		await expect(
			decodeDatabaseSessionCookie('opaque-token', 'test-session-secret')
		).resolves.toBeNull();
	});
});

describe('Password Utilities', () => {
	it('validates, hashes, and verifies passwords', async () => {
		const { hashPassword, validatePassword, verifyPassword } =
			await import('../../src/lib/utils/passwords');

		expect(validatePassword('short')).toBe('Password must be at least 10 characters long.');
		expect(validatePassword('StrongPass123!')).toBeNull();

		const hash = await hashPassword('StrongPass123!');

		expect(hash.startsWith('pbkdf2_sha256$')).toBe(true);
		await expect(verifyPassword('StrongPass123!', hash)).resolves.toBe(true);
		await expect(verifyPassword('WrongPass123!', hash)).resolves.toBe(false);
	});

	it('rejects malformed stored password hashes', async () => {
		const { verifyPassword } = await import('../../src/lib/utils/passwords');

		await expect(verifyPassword('StrongPass123!', 'bad-format')).resolves.toBe(false);
		await expect(verifyPassword('StrongPass123!', 'pbkdf2_sha256$NaN$00$11')).resolves.toBe(false);
		await expect(verifyPassword('StrongPass123!', 'argon2$1$00$11')).resolves.toBe(false);
		await expect(verifyPassword('StrongPass123!', 'pbkdf2_sha256$1$0$11')).rejects.toThrow(
			'Invalid hex string length'
		);
	});
});
import '../helpers/server-response';
