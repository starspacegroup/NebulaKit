/**
 * End to end through the real route handlers and a real (in-memory) KV: what
 * lands in storage, what leaves in a response, and what an existing deployment
 * with plaintext values sees after upgrading.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSecretBox, generateEncryptionKey } from '../../src/lib/server/secret-box';
import { AUTO_KEY_KV_KEY } from '../../src/lib/server/secret-store';
import { getEnabledOpenAIKeys } from '../../src/lib/services/openai-chat';
import { getAuthProviderCredentials } from '../../src/lib/utils/auth-provider-config';
import { createFakeKV, type FakeKV } from '../helpers/fake-kv';

const owner = { user: { id: 'o', isOwner: true, isAdmin: true } };
const SECRET = 'sk-proj-VERYSECRETVALUE-wxyz';
const OAUTH_SECRET = 'oauth-client-secret-q1w2e3r4';

function env(kv: FakeKV, extra: Record<string, string> = {}) {
	return { env: { KV: kv, ...extra } } as any;
}

function req(body: unknown) {
	return { json: async () => body } as any;
}

async function body(res: Response) {
	return res.json();
}

afterEach(() => vi.restoreAllMocks());

describe('AI provider keys', () => {
	it('zero-env: encrypts on first save, never returns the secret, still serves it to chat', async () => {
		const kv = createFakeKV();
		const platform = env(kv);
		const { POST, GET } = await import('../../src/routes/api/admin/ai-keys/+server');

		const created = await body(
			await POST({
				request: req({ name: 'Prod', provider: 'openai', apiKey: SECRET, models: ['gpt-5'] }),
				platform,
				locals: owner
			} as any)
		);
		expect(created.key.apiKey).toBeUndefined();
		expect(created.key.apiKeyConfigured).toBe(true);
		expect(created.key.apiKeyLast4).toBe('wxyz');

		const everything = JSON.stringify(
			[...kv.data.entries()].filter(([k]) => k !== AUTO_KEY_KV_KEY)
		);
		expect(everything).not.toContain(SECRET);
		expect(everything).not.toContain('VERYSECRET');
		expect(kv.data.has(AUTO_KEY_KV_KEY)).toBe(true);

		const listed = await body(await GET({ platform, locals: owner } as any));
		expect(JSON.stringify(listed)).not.toContain('VERYSECRET');
		expect(listed.keys[0]).toMatchObject({
			apiKeyConfigured: true,
			apiKeyLast4: 'wxyz',
			apiKeyStatus: 'ok'
		});
		expect(listed.encryption).toEqual({ mode: 'auto', previousKeys: 0 });

		const forChat = await getEnabledOpenAIKeys(platform);
		expect(forChat).toHaveLength(1);
		expect(forChat[0].apiKey).toBe(SECRET);
	});

	it('operator key: nothing is written under encryption_key:auto and the key opens the value', async () => {
		const key = generateEncryptionKey();
		const kv = createFakeKV();
		const platform = env(kv, { ENCRYPTION_KEY: key });
		const { POST } = await import('../../src/routes/api/admin/ai-keys/+server');
		const created = await body(
			await POST({
				request: req({ name: 'n', provider: 'openai', apiKey: SECRET }),
				platform,
				locals: owner
			} as any)
		);
		expect(kv.data.has(AUTO_KEY_KV_KEY)).toBe(false);
		const stored = JSON.parse(kv.data.get(`ai_key:${created.key.id}`)!);
		expect(
			(await createSecretBox(key).open(stored.apiKey, 'ai-key', created.key.id)).plaintext
		).toBe(SECRET);
	});

	it('migrates an existing plaintext deployment on first read without losing the key', async () => {
		const kv = createFakeKV({
			ai_keys_list: JSON.stringify(['legacy']),
			'ai_key:legacy': JSON.stringify({
				id: 'legacy',
				name: 'Old',
				provider: 'openai',
				apiKey: SECRET,
				enabled: true
			})
		});
		const platform = env(kv);
		const { GET } = await import('../../src/routes/api/admin/ai-keys/+server');

		const listed = await body(await GET({ platform, locals: owner } as any));
		expect(listed.keys[0]).toMatchObject({
			id: 'legacy',
			apiKeyLast4: 'wxyz',
			apiKeyStatus: 'legacy'
		});
		expect(kv.data.get('ai_key:legacy')).not.toContain('VERYSECRET');

		// The chat path now reads the encrypted copy and still gets the original.
		expect((await getEnabledOpenAIKeys(platform))[0].apiKey).toBe(SECRET);
	});

	it('toggle and rename keep the secret and never leave plaintext behind', async () => {
		const kv = createFakeKV({
			'ai_key:k': JSON.stringify({
				id: 'k',
				name: 'n',
				provider: 'openai',
				apiKey: SECRET,
				enabled: true
			})
		});
		const platform = env(kv);
		const { PATCH } = await import('../../src/routes/api/admin/ai-keys/[id]/toggle/+server');
		const res = await body(
			await PATCH({
				params: { id: 'k' },
				request: req({ enabled: false }),
				platform,
				locals: owner
			} as any)
		);
		expect(res.key.apiKey).toBeUndefined();
		expect(kv.data.get('ai_key:k')).not.toContain('VERYSECRET');

		const { PUT } = await import('../../src/routes/api/admin/ai-keys/[id]/+server');
		const put = await body(
			await PUT({
				params: { id: 'k' },
				request: req({ name: 'renamed', provider: 'openai' }),
				platform,
				locals: owner
			} as any)
		);
		expect(put.key).toMatchObject({ name: 'renamed', apiKeyConfigured: true });
		expect(kv.data.get('ai_key:k')).not.toContain('VERYSECRET');
		kv.data.set('ai_keys_list', JSON.stringify(['k']));
		expect((await getEnabledOpenAIKeys(platform)).length).toBe(0); // toggled off
		await PUT({
			params: { id: 'k' },
			request: req({ name: 'renamed', provider: 'openai', enabled: true }),
			platform,
			locals: owner
		} as any);
		expect((await getEnabledOpenAIKeys(platform))[0].apiKey).toBe(SECRET);
	});

	it('replacing the key stores the new one sealed', async () => {
		const kv = createFakeKV({
			'ai_key:k': JSON.stringify({
				id: 'k',
				name: 'n',
				provider: 'openai',
				apiKey: SECRET,
				enabled: true
			}),
			ai_keys_list: JSON.stringify(['k'])
		});
		const platform = env(kv);
		const { PUT } = await import('../../src/routes/api/admin/ai-keys/[id]/+server');
		await PUT({
			params: { id: 'k' },
			request: req({ name: 'n', provider: 'openai', apiKey: 'sk-replacement-value-0000' }),
			platform,
			locals: owner
		} as any);
		expect(kv.data.get('ai_key:k')).not.toContain('replacement');
		expect((await getEnabledOpenAIKeys(platform))[0].apiKey).toBe('sk-replacement-value-0000');
	});

	it('a key sealed under a lost ENCRYPTION_KEY is skipped, not sent blank', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const envelope = await createSecretBox(generateEncryptionKey()).seal(SECRET, 'ai-key', 'k');
		const kv = createFakeKV({
			ai_keys_list: JSON.stringify(['k']),
			'ai_key:k': JSON.stringify({ id: 'k', provider: 'openai', apiKey: envelope, enabled: true })
		});
		const platform = env(kv, { ENCRYPTION_KEY: generateEncryptionKey() });
		expect(await getEnabledOpenAIKeys(platform)).toEqual([]);
		const { GET } = await import('../../src/routes/api/admin/ai-keys/+server');
		const listed = await body(await GET({ platform, locals: owner } as any));
		expect(listed.keys[0].apiKeyStatus).toBe('undecryptable');
	});

	it('the models endpoint can still find the key to call the provider', async () => {
		const kv = createFakeKV({
			ai_keys_list: JSON.stringify(['k']),
			'ai_key:k': JSON.stringify({ id: 'k', provider: 'openai', apiKey: SECRET, enabled: true })
		});
		const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });
		vi.stubGlobal('fetch', fetchMock);
		const { GET } = await import('../../src/routes/api/admin/ai-keys/models/+server');
		await GET({
			platform: env(kv),
			locals: owner,
			url: new URL('http://x/api/admin/ai-keys/models?keyId=k')
		} as any);
		expect(JSON.stringify(fetchMock.mock.calls)).toContain(SECRET);
		await GET({
			platform: env(kv),
			locals: owner,
			url: new URL('http://x/api/admin/ai-keys/models')
		} as any);
		expect(fetchMock).toHaveBeenCalledTimes(2);
		vi.unstubAllGlobals();
	});
});

describe('OAuth provider credentials', () => {
	it('POST /api/admin/auth-keys stores the client secret sealed; GET shows only last 4', async () => {
		const kv = createFakeKV();
		const platform = env(kv);
		const { POST, GET } = await import('../../src/routes/api/admin/auth-keys/+server');
		const created = await body(
			await POST({
				request: req({
					name: 'Discord',
					provider: 'discord',
					type: 'oauth',
					clientId: 'cid',
					clientSecret: OAUTH_SECRET
				}),
				platform,
				locals: owner
			} as any)
		);
		expect(JSON.stringify(created)).not.toContain(OAUTH_SECRET);
		expect(kv.data.get('auth_config:discord')).not.toContain(OAUTH_SECRET);

		expect(await getAuthProviderCredentials(platform, 'discord')).toEqual({
			clientId: 'cid',
			clientSecret: OAUTH_SECRET
		});

		const listed = await body(await GET({ platform, locals: owner } as any));
		expect(JSON.stringify(listed)).not.toContain(OAUTH_SECRET);
		expect(listed.keys[0]).toMatchObject({
			clientSecretConfigured: true,
			clientSecretLast4: 'e3r4',
			clientSecretStatus: 'ok'
		});
	});

	it('migrates a legacy plaintext auth_config the first time it is read', async () => {
		const kv = createFakeKV({
			'auth_config:github': JSON.stringify({
				id: 'g',
				provider: 'github',
				clientId: 'gid',
				clientSecret: OAUTH_SECRET
			})
		});
		const platform = env(kv);
		expect(await getAuthProviderCredentials(platform, 'github')).toEqual({
			clientId: 'gid',
			clientSecret: OAUTH_SECRET
		});
		const stored = JSON.parse(kv.data.get('auth_config:github')!);
		expect(stored.clientSecret).toMatch(/^v1\./);
		expect(stored.clientId).toBe('gid');
		expect((await getAuthProviderCredentials(platform, 'github')).clientSecret).toBe(OAUTH_SECRET);
	});

	it('environment credentials win and never touch KV', async () => {
		const kv = createFakeKV();
		const creds = await getAuthProviderCredentials(
			env(kv, { GITHUB_CLIENT_ID: 'a', GITHUB_CLIENT_SECRET: 'b' }),
			'github'
		);
		expect(creds).toEqual({ clientId: 'a', clientSecret: 'b' });
		expect(kv.data.size).toBe(0);
	});

	it('editing a non-setup key seals a replacement, and keeps the old secret when none is sent', async () => {
		const kv = createFakeKV({
			'auth_config:discord': JSON.stringify({
				id: 'd',
				provider: 'discord',
				clientId: 'old',
				clientSecret: OAUTH_SECRET
			})
		});
		const platform = env(kv);
		const { PUT } = await import('../../src/routes/api/admin/auth-keys/[id]/+server');

		await PUT({
			params: { id: 'd' },
			request: req({ name: 'n', clientId: 'new1' }),
			platform,
			locals: owner
		} as any);
		expect(kv.data.get('auth_config:discord')).not.toContain(OAUTH_SECRET);
		expect((await getAuthProviderCredentials(platform, 'discord')).clientSecret).toBe(OAUTH_SECRET);

		await PUT({
			params: { id: 'd' },
			request: req({ name: 'n', clientId: 'new2', clientSecret: 'replacement-secret-9999' }),
			platform,
			locals: owner
		} as any);
		expect(kv.data.get('auth_config:discord')).not.toContain('replacement');
		expect(await getAuthProviderCredentials(platform, 'discord')).toEqual({
			clientId: 'new2',
			clientSecret: 'replacement-secret-9999'
		});
	});

	it('swapping a sealed secret between providers is rejected', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const kv = createFakeKV();
		const platform = env(kv);
		const { POST } = await import('../../src/routes/api/admin/auth-keys/+server');
		for (const provider of ['github', 'discord']) {
			await POST({
				request: req({
					name: provider,
					provider,
					type: 'oauth',
					clientId: provider,
					clientSecret: `${provider}-secret-value`
				}),
				platform,
				locals: owner
			} as any);
		}
		const github = JSON.parse(kv.data.get('auth_config:github')!);
		const discord = JSON.parse(kv.data.get('auth_config:discord')!);
		kv.data.set(
			'auth_config:discord',
			JSON.stringify({ ...discord, clientSecret: github.clientSecret })
		);
		const creds = await getAuthProviderCredentials(platform, 'discord');
		expect(creds.clientSecret).toBeUndefined();
	});

	it('/api/setup stores the GitHub client secret sealed', async () => {
		const kv = createFakeKV();
		const platform = env(kv, { SETUP_SECRET: 'bootstrap' });
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 7, login: 'octo' }) })
		);
		const { POST } = await import('../../src/routes/api/setup/+server');
		const res = await POST({
			request: {
				headers: new Headers({ authorization: 'Bearer bootstrap' }),
				json: async () => ({
					clientId: 'gid',
					clientSecret: OAUTH_SECRET,
					adminGithubUsername: 'octo'
				})
			},
			platform,
			locals: {}
		} as any);
		expect((await res.json()).success).toBe(true);
		expect(kv.data.get('auth_config:github')).not.toContain(OAUTH_SECRET);
		expect((await getAuthProviderCredentials(platform, 'github')).clientSecret).toBe(OAUTH_SECRET);
		vi.unstubAllGlobals();
	});

	it('reset clears the OAuth config but keeps the encryption key that protects AI keys', async () => {
		const kv = createFakeKV();
		const platform = env(kv);
		platform.env.DB = { prepare: () => ({ run: async () => ({ success: true }) }) };
		const { POST: createAi } = await import('../../src/routes/api/admin/ai-keys/+server');
		await createAi({
			request: req({ name: 'n', provider: 'openai', apiKey: SECRET }),
			platform,
			locals: owner
		} as any);
		kv.data.set('auth_config:github', 'x');

		const { POST: reset } = await import('../../src/routes/api/reset/+server');
		await reset({
			platform,
			cookies: { get: () => undefined, delete: () => {} },
			locals: owner
		} as any);
		expect(kv.data.has('auth_config:github')).toBe(false);
		expect(kv.data.has(AUTO_KEY_KV_KEY)).toBe(true);
		expect((await getEnabledOpenAIKeys(platform))[0].apiKey).toBe(SECRET);
	});
});
