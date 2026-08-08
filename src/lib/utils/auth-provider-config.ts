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
			const stored = await platform.env.KV.get(`auth_config:${provider}`);
			if (stored) {
				const config = JSON.parse(stored) as AuthProviderCredentials;
				credentials.clientId ||= config.clientId;
				credentials.clientSecret ||= config.clientSecret;
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
