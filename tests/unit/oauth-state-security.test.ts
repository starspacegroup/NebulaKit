import { webcrypto } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type OAuthProvider = 'github' | 'discord';

function importOAuthInitiation(provider: OAuthProvider) {
	return provider === 'github'
		? import('../../src/routes/api/auth/github/+server')
		: import('../../src/routes/api/auth/discord/+server');
}

function importOAuthCallback(provider: OAuthProvider) {
	return provider === 'github'
		? import('../../src/routes/api/auth/github/callback/+server')
		: import('../../src/routes/api/auth/discord/callback/+server');
}

describe('OAuth state security', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.restoreAllMocks();
		vi.stubGlobal('crypto', webcrypto as Crypto);
	});

	it('signs provider and link intent and rejects missing or mismatched state', async () => {
		const { createOAuthState, verifyOAuthState } = await import('../../src/lib/utils/oauth-state');
		const issued = await createOAuthState('github', 'link', 'user-1', 'session-secret');

		await expect(
			verifyOAuthState('github', issued.state, issued.cookie, 'session-secret')
		).resolves.toMatchObject({ provider: 'github', intent: 'link', userId: 'user-1' });
		await expect(
			verifyOAuthState('github', undefined, issued.cookie, 'session-secret')
		).resolves.toBeNull();
		await expect(
			verifyOAuthState('github', 'wrong-state', issued.cookie, 'session-secret')
		).resolves.toBeNull();
		await expect(
			verifyOAuthState('discord', issued.state, issued.cookie, 'session-secret')
		).resolves.toBeNull();
	});

	it('rejects malformed, expired, and future-dated signed state payloads', async () => {
		const { signValue, verifyOAuthState } = await import('../../src/lib/utils/oauth-state');
		const state = 'browser-state';
		const now = Date.now();
		const invalidPayloads = [
			{ provider: 'github', state, intent: 'invalid', issuedAt: now },
			{ provider: 'github', state, intent: 'login', issuedAt: 'now' },
			{ provider: 'github', state, intent: 'login', issuedAt: now - 11 * 60 * 1000 },
			{ provider: 'github', state, intent: 'login', issuedAt: now + 2 * 60 * 1000 },
			{ provider: 'github', state, intent: 'link', issuedAt: now }
		];

		for (const payload of invalidPayloads) {
			await expect(
				verifyOAuthState(
					'github',
					state,
					await signValue(payload, 'session-secret'),
					'session-secret'
				)
			).resolves.toBeNull();
		}

		await expect(
			verifyOAuthState('github', state, undefined, 'session-secret')
		).resolves.toBeNull();
	});

	it('consumes the callback cookie before returning verified state', async () => {
		const { consumeOAuthState, createOAuthState, oauthStateCookieName } =
			await import('../../src/lib/utils/oauth-state');
		const issued = await createOAuthState('github', 'login', undefined, 'session-secret');
		const remove = vi.fn();
		const payload = await consumeOAuthState(
			'github',
			issued.state,
			{
				get: vi.fn((name: string) =>
					name === oauthStateCookieName('github') ? issued.cookie : undefined
				),
				delete: remove
			},
			'session-secret'
		);

		expect(payload?.intent).toBe('login');
		expect(remove).toHaveBeenCalledWith('oauth_state_github', {
			path: '/api/auth/github/callback'
		});
	});

	it('persists state and atomically rejects a replay even with a copied cookie', async () => {
		const { consumeOAuthTransaction, createOAuthTransaction, oauthStateCookieName } =
			await import('../../src/lib/utils/oauth-state');
		const first = vi
			.fn()
			.mockResolvedValueOnce({ intent: 'login', user_id: null, session_id: null })
			.mockResolvedValueOnce(null);
		const prepare = vi.fn((sql: string) => ({
			bind: vi.fn(() =>
				sql.includes('INSERT INTO oauth_transactions')
					? { run: vi.fn().mockResolvedValue({ success: true }) }
					: { first }
			)
		}));
		const db = { prepare };
		const issued = await createOAuthTransaction(
			db as never,
			'github',
			'login',
			undefined,
			undefined,
			'session-secret'
		);
		const copiedCookie = () => ({
			get: vi.fn((name: string) =>
				name === oauthStateCookieName('github') ? issued.cookie : undefined
			),
			delete: vi.fn()
		});

		await expect(
			consumeOAuthTransaction(db as never, 'github', issued.state, copiedCookie(), 'session-secret')
		).resolves.toMatchObject({ intent: 'login' });
		await expect(
			consumeOAuthTransaction(db as never, 'github', issued.state, copiedCookie(), 'session-secret')
		).resolves.toBeNull();
		expect(prepare).toHaveBeenCalledWith(expect.stringContaining('consumed_at IS NULL'));
	});

	it('validates an unexpired transaction without consuming it before provider authentication', async () => {
		const { createOAuthState, oauthStateCookieName, verifyOAuthTransaction } =
			await import('../../src/lib/utils/oauth-state');
		const issued = await createOAuthState('github', 'login', undefined, 'session-secret');
		const remove = vi.fn();
		const prepare = vi.fn((sql: string) => ({
			bind: vi.fn(() => ({
				first: vi.fn().mockResolvedValue({ intent: 'login', user_id: null, session_id: null })
			}))
		}));

		await expect(
			verifyOAuthTransaction(
				{ prepare } as never,
				'github',
				issued.state,
				{
					get: vi.fn((name: string) =>
						name === oauthStateCookieName('github') ? issued.cookie : undefined
					),
					delete: remove
				},
				'session-secret'
			)
		).resolves.toMatchObject({ intent: 'login' });

		expect(remove).not.toHaveBeenCalled();
		expect(prepare).toHaveBeenCalledWith(expect.stringContaining('datetime(expires_at)'));
		expect(prepare).toHaveBeenCalledWith(expect.not.stringContaining('SET consumed_at'));
	});

	it('requires and verifies the exact user and session for link transactions', async () => {
		const { consumeOAuthTransaction, createOAuthTransaction, oauthStateCookieName } =
			await import('../../src/lib/utils/oauth-state');
		const { hashSessionToken } = await import('../../src/lib/utils/db');
		const sessionToken = 'bound-session-token';
		const sessionId = await hashSessionToken(sessionToken);

		await expect(
			createOAuthTransaction({} as never, 'github', 'link', undefined, undefined, 'session-secret')
		).rejects.toThrow(/authenticated user and session/i);
		await expect(
			createOAuthTransaction({} as never, 'github', 'link', 'user-1', undefined, 'session-secret')
		).rejects.toThrow(/authenticated user and session/i);

		async function runLink(
			stored: { intent: 'login' | 'link'; user_id: string | null; session_id: string | null },
			boundToken?: string
		) {
			const db = transactionDatabase(stored);
			const issued = await createOAuthTransaction(
				db as never,
				'github',
				'link',
				'user-1',
				sessionToken,
				'session-secret'
			);
			return consumeOAuthTransaction(
				db as never,
				'github',
				issued.state,
				{
					get: vi.fn((name: string) =>
						name === oauthStateCookieName('github') ? issued.cookie : undefined
					),
					delete: vi.fn()
				},
				'session-secret',
				boundToken
			);
		}

		await expect(
			runLink({ intent: 'link', user_id: 'user-1', session_id: sessionId }, sessionToken)
		).resolves.toMatchObject({ intent: 'link', userId: 'user-1' });
		await expect(
			runLink({ intent: 'link', user_id: 'user-2', session_id: sessionId }, sessionToken)
		).resolves.toBeNull();
		await expect(
			runLink({ intent: 'link', user_id: 'user-1', session_id: sessionId }, 'wrong-token')
		).resolves.toBeNull();
		await expect(
			runLink({ intent: 'link', user_id: 'user-1', session_id: sessionId })
		).resolves.toBeNull();
		await expect(
			runLink({ intent: 'login', user_id: 'user-1', session_id: sessionId }, sessionToken)
		).resolves.toBeNull();
	});

	it('rejects login transactions carrying unexpected identity bindings', async () => {
		const { consumeOAuthTransaction, createOAuthTransaction, oauthStateCookieName } =
			await import('../../src/lib/utils/oauth-state');

		async function consume(stored: {
			intent: 'login';
			user_id: string | null;
			session_id: string | null;
		}) {
			const db = transactionDatabase(stored);
			const issued = await createOAuthTransaction(
				db as never,
				'github',
				'login',
				undefined,
				undefined,
				'session-secret'
			);
			return consumeOAuthTransaction(
				db as never,
				'github',
				issued.state,
				{
					get: vi.fn((name: string) =>
						name === oauthStateCookieName('github') ? issued.cookie : undefined
					),
					delete: vi.fn()
				},
				'session-secret'
			);
		}

		await expect(
			consume({ intent: 'login', user_id: 'unexpected-user', session_id: null })
		).resolves.toBeNull();
		await expect(
			consume({ intent: 'login', user_id: null, session_id: 'unexpected-session' })
		).resolves.toBeNull();
	});

	it('requires both an authenticated user and session when creating link state', async () => {
		const { createOAuthTransaction } = await import('../../src/lib/utils/oauth-state');
		const db = database();

		await expect(
			createOAuthTransaction(db as never, 'github', 'link', undefined, undefined, 'session-secret')
		).rejects.toThrow('authenticated user and session');
		await expect(
			createOAuthTransaction(db as never, 'github', 'link', 'user-1', undefined, 'session-secret')
		).rejects.toThrow('authenticated user and session');
	});

	it('accepts link state only for its bound user and session', async () => {
		const { consumeOAuthTransaction, createOAuthTransaction, oauthStateCookieName } =
			await import('../../src/lib/utils/oauth-state');
		const stored = vi.fn().mockResolvedValue({
			intent: 'link',
			user_id: 'user-1',
			session_id: await (await import('../../src/lib/utils/db')).hashSessionToken('session-token')
		});
		const db = {
			prepare: vi.fn((sql: string) => ({
				bind: vi.fn(() =>
					sql.includes('INSERT INTO oauth_transactions')
						? { run: vi.fn().mockResolvedValue({ success: true }) }
						: { first: stored }
				)
			}))
		};
		const issued = await createOAuthTransaction(
			db as never,
			'github',
			'link',
			'user-1',
			'session-token',
			'session-secret'
		);
		const cookies = () => ({
			get: vi.fn((name: string) =>
				name === oauthStateCookieName('github') ? issued.cookie : undefined
			),
			delete: vi.fn()
		});

		await expect(
			consumeOAuthTransaction(
				db as never,
				'github',
				issued.state,
				cookies(),
				'session-secret',
				'session-token'
			)
		).resolves.toMatchObject({ intent: 'link', userId: 'user-1' });
		await expect(
			consumeOAuthTransaction(
				db as never,
				'github',
				issued.state,
				cookies(),
				'session-secret',
				'wrong-session'
			)
		).resolves.toBeNull();
	});

	it.each(['github', 'discord'] as const)(
		'sets a signed HttpOnly state cookie for %s initiation',
		async (provider) => {
			const { GET } = await importOAuthInitiation(provider);
			const set = vi.fn();
			const url = new URL(`https://example.com/api/auth/${provider}`);
			const env = {
				SESSION_SECRET: 'session-secret',
				DB: database(),
				GITHUB_CLIENT_ID: provider === 'github' ? 'client-id' : undefined,
				DISCORD_CLIENT_ID: provider === 'discord' ? 'client-id' : undefined
			};

			await expect(
				GET({ url, platform: { env }, cookies: { set }, locals: {} } as never)
			).rejects.toMatchObject({ status: 302 });

			expect(set).toHaveBeenCalledWith(
				`oauth_state_${provider}`,
				expect.stringContaining('.'),
				expect.objectContaining({
					httpOnly: true,
					sameSite: 'lax',
					secure: true,
					path: `/api/auth/${provider}/callback`
				})
			);
		}
	);

	it.each(['github', 'discord'] as const)(
		'requires an authenticated opaque session for %s link initiation',
		async (provider) => {
			const { GET } = await importOAuthInitiation(provider);
			const url = new URL(`https://example.com/api/auth/${provider}?mode=link`);
			const env = {
				SESSION_SECRET: 'session-secret',
				DB: database(),
				GITHUB_CLIENT_ID: provider === 'github' ? 'client-id' : undefined,
				DISCORD_CLIENT_ID: provider === 'discord' ? 'client-id' : undefined
			};

			await expect(
				GET({
					url,
					platform: { env },
					cookies: { get: vi.fn(), set: vi.fn() },
					locals: {}
				} as never)
			).rejects.toMatchObject({
				status: 302,
				location: '/auth/login?error=authentication_required'
			});

			await expect(
				GET({
					url,
					platform: { env },
					cookies: { get: vi.fn(), set: vi.fn() },
					locals: { user: authenticatedUser() }
				} as never)
			).rejects.toMatchObject({
				status: 302,
				location: '/auth/login?error=authentication_required'
			});
		}
	);

	it.each(['github', 'discord'] as const)(
		'binds %s link state to the current opaque session',
		async (provider) => {
			const { GET } = await importOAuthInitiation(provider);
			const db = database();
			const set = vi.fn();
			const url = new URL(`https://example.com/api/auth/${provider}?mode=link`);
			const env = {
				SESSION_SECRET: 'session-secret',
				DB: db,
				GITHUB_CLIENT_ID: provider === 'github' ? 'client-id' : undefined,
				DISCORD_CLIENT_ID: provider === 'discord' ? 'client-id' : undefined
			};
			// The merged scheme's cookie is the opaque token itself; the initiation
			// route validates it against the sessions table before binding.
			const sessionCookie = 'current-session-token';

			await expect(
				GET({
					url,
					platform: { env },
					cookies: { get: vi.fn(() => sessionCookie), set },
					locals: { user: authenticatedUser() }
				} as never)
			).rejects.toMatchObject({ status: 302 });

			const transactionInsert = db.bindings.find(({ sql }) =>
				sql.includes('INSERT INTO oauth_transactions')
			);
			expect(transactionInsert?.values.slice(1, 5)).toEqual([
				provider,
				'link',
				'user-1',
				expect.stringMatching(/^[A-Za-z0-9_-]+$/)
			]);
			expect(set).toHaveBeenCalled();
		}
	);

	it.each(['github', 'discord'] as const)(
		'preserves %s state when provider authentication cannot start',
		async (provider) => {
			const { createOAuthState, oauthStateCookieName } =
				await import('../../src/lib/utils/oauth-state');
			const issued = await createOAuthState(provider, 'login', undefined, 'session-secret');
			const store = new Map([[oauthStateCookieName(provider), issued.cookie]]);
			const cookies = {
				get: vi.fn((name: string) => store.get(name)),
				delete: vi.fn((name: string) => store.delete(name))
			};
			const callback = await importOAuthCallback(provider);
			const event = {
				url: new URL(
					`https://example.com/api/auth/${provider}/callback?code=code&state=${issued.state}`
				),
				cookies,
				platform: { env: { SESSION_SECRET: 'session-secret' } }
			};

			await expect(callback.GET(event as never)).rejects.toMatchObject({
				status: 302,
				location: '/auth/login?error=oauth_failed'
			});
			expect(cookies.delete).not.toHaveBeenCalled();
			await expect(callback.GET(event as never)).rejects.toMatchObject({
				status: 302,
				location: '/auth/login?error=oauth_failed'
			});
		}
	);

	it.each(['github', 'discord'] as const)(
		'accepts valid %s state and issues a server-side opaque session',
		async (provider) => {
			const { createOAuthTransaction, oauthStateCookieName } =
				await import('../../src/lib/utils/oauth-state');
			const db = database();
			const issued = await createOAuthTransaction(
				db as never,
				provider,
				'login',
				undefined,
				undefined,
				'session-secret'
			);
			const cookies = {
				get: vi.fn((name: string) =>
					name === oauthStateCookieName(provider) ? issued.cookie : undefined
				),
				delete: vi.fn()
			};
			const env = {
				SESSION_SECRET: 'session-secret',
				DB: db,
				GITHUB_CLIENT_ID: provider === 'github' ? 'client-id' : undefined,
				GITHUB_CLIENT_SECRET: provider === 'github' ? 'client-secret' : undefined,
				GITHUB_OWNER_ID: provider === 'github' ? '999' : undefined,
				DISCORD_CLIENT_ID: provider === 'discord' ? 'client-id' : undefined,
				DISCORD_CLIENT_SECRET: provider === 'discord' ? 'client-secret' : undefined
			};
			const providerUser =
				provider === 'github'
					? {
							id: 123,
							login: 'octocat',
							name: 'Octo Cat',
							email: 'octo@example.com',
							avatar_url: null
						}
					: {
							id: '456',
							username: 'discord-user',
							global_name: 'Discord User',
							email: 'discord@example.com',
							avatar: null,
							discriminator: '0'
						};
			vi.stubGlobal(
				'fetch',
				vi
					.fn()
					.mockResolvedValueOnce({
						ok: true,
						json: vi.fn().mockResolvedValue({ access_token: 'provider-token' })
					})
					.mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue(providerUser) })
			);
			const callback = await importOAuthCallback(provider);
			const response = await callback.GET({
				url: new URL(
					`https://example.com/api/auth/${provider}/callback?code=code&state=${issued.state}`
				),
				cookies,
				platform: { env }
			} as never);
			const cookieValue = response.headers.get('Set-Cookie')?.match(/^session=([^;]+)/)?.[1];

			expect(response.status).toBe(302);
			// Opaque scheme: the cookie is a bare base64url token (no payload, no
			// signature dot) and the trusted payload was written server-side.
			expect(cookieValue).toMatch(/^[A-Za-z0-9_-]+$/);
			expect(cookieValue).not.toContain('.');
			const oauthInsert = db.bindings.find(({ sql }) => sql.includes('INSERT INTO oauth_accounts'));
			expect(oauthInsert?.values).toHaveLength(4);
			expect(oauthInsert?.values).not.toContain('provider-token');
			const sessionInsert = db.bindings.find(({ sql }) => sql.includes('INSERT INTO sessions'));
			expect(sessionInsert?.sql).toContain('data');
			// The stored id must be a DIGEST of the cookie token, never the token.
			expect(sessionInsert?.values).not.toContain(cookieValue);
		}
	);
});

function database() {
	const bindings: Array<{ sql: string; values: unknown[] }> = [];
	return {
		bindings,
		prepare: vi.fn((sql: string) => ({
			bind: vi.fn((...values: unknown[]) => {
				bindings.push({ sql, values });
				return {
					first: vi.fn().mockResolvedValue(
						sql.includes('FROM sessions')
							? { id: 'session-digest', user_id: 'user-1', expires_at: '2099-01-01T00:00:00.000Z' }
							: sql.includes('oauth_transactions')
								? { intent: 'login', user_id: null, session_id: null }
								: sql.includes('SELECT id, email, name, github_login')
									? {
											id: values[0],
											email: `${values[0]}@example.com`,
											name: 'OAuth User',
											github_login: values[0] === '123' ? 'octocat' : null,
											github_avatar_url: null,
											is_admin: 0
										}
									: null
					),
					all: vi.fn().mockResolvedValue({ results: [] }),
					run: vi.fn().mockResolvedValue({ success: true })
				};
			})
		}))
	};
}

function transactionDatabase(stored: {
	intent: 'login' | 'link';
	user_id: string | null;
	session_id: string | null;
}) {
	return {
		prepare: vi.fn((sql: string) => ({
			bind: vi.fn(() =>
				sql.includes('INSERT INTO oauth_transactions')
					? { run: vi.fn().mockResolvedValue({ success: true }) }
					: { first: vi.fn().mockResolvedValue(stored) }
			)
		}))
	};
}

describe('OAuth transaction retention', () => {
	it('prunes consumed and expired rows without touching live ones', async () => {
		const { pruneOAuthTransactions } = await import('../../src/lib/utils/oauth-state');
		const run = vi.fn().mockResolvedValue({ success: true });
		const prepare = vi.fn((_sql: string) => ({ run }));

		await pruneOAuthTransactions({ prepare } as never);

		const sql = prepare.mock.calls[0][0];
		expect(sql).toContain('DELETE FROM oauth_transactions');
		expect(sql).toContain('consumed_at IS NOT NULL');
		expect(sql).toContain('datetime(expires_at) <= CURRENT_TIMESTAMP');
		expect(run).toHaveBeenCalledTimes(1);
	});

	it('never lets a failed prune break the sign-in it runs alongside', async () => {
		const { pruneOAuthTransactions } = await import('../../src/lib/utils/oauth-state');
		const prepare = vi.fn(() => ({
			run: vi.fn().mockRejectedValue(new Error('D1 unavailable'))
		}));

		await expect(pruneOAuthTransactions({ prepare } as never)).resolves.toBeUndefined();
	});
});

function authenticatedUser() {
	return {
		id: 'user-1',
		login: 'owner',
		email: 'owner@example.com',
		isOwner: true,
		isAdmin: true
	};
}
import '../helpers/server-response';
