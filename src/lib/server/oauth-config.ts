/**
 * OAuth provider configs stored in KV under `auth_config:<provider>`.
 *
 * The provider name is part of the KV key, so it is never taken from request
 * input unchecked — an unvalidated provider lets a caller choose which config
 * entry to write.
 */
import type { KVNamespace } from '@cloudflare/workers-types';

export const OAUTH_PROVIDERS = ['github', 'discord', 'google', 'microsoft'] as const;

export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

export function isSupportedOAuthProvider(provider: unknown): provider is OAuthProvider {
	return typeof provider === 'string' && (OAUTH_PROVIDERS as readonly string[]).includes(provider);
}

export function authConfigKey(provider: OAuthProvider): string {
	return `auth_config:${provider}`;
}

/**
 * Find which provider's stored config carries this key id.
 *
 * Callers must resolve the provider from stored state rather than trusting a
 * `provider` field in the request body: the setup-key guard compares the path
 * id against the stored GitHub config, so trusting the body let a caller pass
 * an unrelated id (guard passes) alongside `provider: "github"` (write lands on
 * the GitHub config anyway).
 */
export async function findProviderByKeyId(
	kv: KVNamespace,
	id: string
): Promise<{ provider: OAuthProvider; config: Record<string, unknown> } | null> {
	for (const provider of OAUTH_PROVIDERS) {
		try {
			const stored = await kv.get(authConfigKey(provider));
			if (!stored) continue;

			const config = JSON.parse(stored);
			if (config?.id === id) {
				return { provider, config };
			}
		} catch (err) {
			console.error(`Failed to read ${provider} auth config:`, err);
		}
	}

	return null;
}
