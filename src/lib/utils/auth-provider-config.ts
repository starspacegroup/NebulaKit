export interface AuthProviderConfig {
	github: boolean;
	discord: boolean;
}

async function isProviderConfigured(
	platform: App.Platform | undefined,
	provider: keyof AuthProviderConfig
): Promise<boolean> {
	if (provider === 'github') {
		if (platform?.env?.GITHUB_CLIENT_ID && platform?.env?.GITHUB_CLIENT_SECRET) {
			return true;
		}

		if (platform?.env?.KV) {
			try {
				const stored = await platform.env.KV.get('auth_config:github');
				if (stored) {
					const config = JSON.parse(stored);
					return !!(config.clientId && config.clientSecret);
				}
			} catch {
				// Ignore KV errors and fall through to false.
			}
		}
	}

	if (provider === 'discord') {
		if (platform?.env?.DISCORD_CLIENT_ID && platform?.env?.DISCORD_CLIENT_SECRET) {
			return true;
		}

		if (platform?.env?.KV) {
			try {
				const stored = await platform.env.KV.get('auth_config:discord');
				if (stored) {
					const config = JSON.parse(stored);
					return !!(config.clientId && config.clientSecret);
				}
			} catch {
				// Ignore KV errors and fall through to false.
			}
		}
	}

	return false;
}

export async function getConfiguredAuthProviders(
	platform: App.Platform | undefined
): Promise<AuthProviderConfig> {
	const [github, discord] = await Promise.all([
		isProviderConfigured(platform, 'github'),
		isProviderConfigured(platform, 'discord')
	]);

	return { github, discord };
}
