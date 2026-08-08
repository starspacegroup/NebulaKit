import { describe, expect, it, vi } from 'vitest';

describe('authentication provider configuration', () => {
	it('resolves environment credentials without reading KV', async () => {
		const kv = { get: vi.fn() };
		const { getAuthProviderCredentials } = await import(
			'../../src/lib/utils/auth-provider-config'
		);

		await expect(
			getAuthProviderCredentials(
				{
					env: {
						GITHUB_CLIENT_ID: 'env-id',
						GITHUB_CLIENT_SECRET: 'env-secret',
						KV: kv
					}
				} as never,
				'github'
			)
		).resolves.toEqual({ clientId: 'env-id', clientSecret: 'env-secret' });
		expect(kv.get).not.toHaveBeenCalled();
	});

	it('fills missing credentials from the provider KV record', async () => {
		const kv = {
			get: vi.fn().mockResolvedValue(
				JSON.stringify({ clientId: 'stored-id', clientSecret: 'stored-secret' })
			)
		};
		const { getAuthProviderCredentials } = await import(
			'../../src/lib/utils/auth-provider-config'
		);

		await expect(
			getAuthProviderCredentials({ env: { KV: kv } } as never, 'discord')
		).resolves.toEqual({ clientId: 'stored-id', clientSecret: 'stored-secret' });
		expect(kv.get).toHaveBeenCalledWith('auth_config:discord');
	});

	it('fails closed for malformed KV data and validates provider names', async () => {
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
		const { getAuthProviderCredentials, isAuthProvider } = await import(
			'../../src/lib/utils/auth-provider-config'
		);
		const platform = {
			env: { KV: { get: vi.fn().mockResolvedValue('{invalid') } }
		} as never;

		await expect(getAuthProviderCredentials(platform, 'github')).resolves.toEqual({});
		expect(isAuthProvider('github')).toBe(true);
		expect(isAuthProvider('discord')).toBe(true);
		expect(isAuthProvider('google')).toBe(false);
		consoleError.mockRestore();
	});
});
