import { requireAdmin } from '$lib/server/auth-guard';
import { OAUTH_PROVIDERS, isSupportedOAuthProvider } from '$lib/server/oauth-config';
import { error, isHttpError, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// GET - List all auth keys
export const GET: RequestHandler = async ({ platform, locals }) => {
	requireAdmin(locals);

	try {
		const keys: any[] = [];

		// Fetch GitHub OAuth configuration from KV (saved during setup)
		if (platform?.env?.KV) {
			try {
				const authConfigStr = await platform.env.KV.get('auth_config:github');
				if (authConfigStr) {
					const authConfig = JSON.parse(authConfigStr);
					// Add GitHub OAuth as a key in the list
					keys.push({
						id: authConfig.id,
						name: 'GitHub OAuth (Setup)',
						provider: authConfig.provider,
						type: 'oauth',
						clientId: authConfig.clientId,
						createdAt: authConfig.createdAt,
						isSetupKey: true // Mark as setup key (read-only)
					});
				}
			} catch (err) {
				console.error('Failed to parse GitHub OAuth config:', err);
			}

			// Fetch Discord OAuth configuration from KV
			try {
				const discordConfigStr = await platform.env.KV.get('auth_config:discord');
				if (discordConfigStr) {
					const discordConfig = JSON.parse(discordConfigStr);
					keys.push({
						id: discordConfig.id,
						name: 'Discord OAuth (Setup)',
						provider: discordConfig.provider,
						type: 'oauth',
						clientId: discordConfig.clientId,
						createdAt: discordConfig.createdAt,
						isSetupKey: true
					});
				}
			} catch (err) {
				console.error('Failed to parse Discord OAuth config:', err);
			}
		}

		return json({ keys });
	} catch (err) {
		console.error('Failed to fetch auth keys:', err);
		throw error(500, 'Failed to fetch authentication keys');
	}
};

// POST - Create new auth key
export const POST: RequestHandler = async ({ request, platform, locals }) => {
	requireAdmin(locals);

	try {
		const data = await request.json();

		// Validate required fields
		if (!data.name || !data.clientId || !data.clientSecret) {
			throw error(400, 'Missing required fields');
		}

		// The provider becomes part of the KV key below, so it cannot be free
		// text — otherwise a caller chooses which `auth_config:*` entry to write.
		if (!isSupportedOAuthProvider(data.provider)) {
			throw error(400, `Provider must be one of: ${OAUTH_PROVIDERS.join(', ')}`);
		}

		// Generate unique ID
		const id = crypto.randomUUID();
		const createdAt = new Date().toISOString();

		const newKey = {
			id,
			name: data.name,
			provider: data.provider,
			type: data.type,
			clientId: data.clientId,
			createdAt
		};

		// Store in KV for OAuth providers (github, discord, etc.)
		if (platform?.env?.KV && data.provider) {
			const authConfig = {
				id,
				provider: data.provider,
				clientId: data.clientId,
				clientSecret: data.clientSecret,
				createdAt,
				updatedAt: new Date().toISOString()
			};
			await platform.env.KV.put(`auth_config:${data.provider}`, JSON.stringify(authConfig));
			console.log(`✓ Saved ${data.provider} OAuth config to KV`);
		}

		return json({ success: true, key: newKey });
	} catch (err) {
		// SvelteKit's HttpError is not an instance of Error, so the old
		// `err instanceof Error && 'status' in err` test never matched and every
		// deliberate 4xx raised inside this try was reported to the caller as a
		// 500 instead.
		if (isHttpError(err)) {
			throw err;
		}
		console.error('Failed to create auth key:', err);
		throw error(500, 'Failed to create authentication key');
	}
};
