import { authConfigSpec, readRecordWithSecret } from '$lib/server/secret-store';
import type { OAuthProvider } from './oauth-state';

export interface AuthProviderConfig {
	github: boolean;
	discord: boolean;
}

export interface AuthProviderCredentials {
	clientId?: string;
	clientSecret?: string;
}

export const AUTH_PROVIDERS = ['github', 'discord'] as const satisfies readonly OAuthProvider[];

export function isAuthProvider(value: unknown): value is OAuthProvider {
	return value === 'github' || value === 'discord';
}

export async function getAuthProviderCredentials(
	platform: App.Platform | undefined,
	provider: OAuthProvider
): Promise<AuthProviderCredentials> {
	const credentials: AuthProviderCredentials =
		provider === 'github'
			? {
					clientId: platform?.env?.GITHUB_CLIENT_ID,
					clientSecret: platform?.env?.GITHUB_CLIENT_SECRET
				}
			: {
					clientId: platform?.env?.DISCORD_CLIENT_ID,
					clientSecret: platform?.env?.DISCORD_CLIENT_SECRET
				};

	if ((!credentials.clientId || !credentials.clientSecret) && platform?.env?.KV) {
		try {
			// The client secret is encrypted at rest; legacy plaintext is migrated here.
			const stored = await readRecordWithSecret<AuthProviderCredentials & Record<string, unknown>>(
				platform,
				`auth_config:${provider}`,
				authConfigSpec(provider)
			);
			if (stored) {
				credentials.clientId ||= stored.record.clientId;
				credentials.clientSecret ||= stored.record.clientSecret;
			}
		} catch (error) {
			console.error('Failed to fetch from KV:', error);
		}
	}

	return credentials;
}

export async function getConfiguredAuthProviders(
	platform: App.Platform | undefined
): Promise<AuthProviderConfig> {
	const [githubCredentials, discordCredentials] = await Promise.all([
		getAuthProviderCredentials(platform, 'github'),
		getAuthProviderCredentials(platform, 'discord')
	]);

	return {
		github: !!(githubCredentials.clientId && githubCredentials.clientSecret),
		discord: !!(discordCredentials.clientId && discordCredentials.clientSecret)
	};
}
