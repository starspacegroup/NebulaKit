import { requireOwner } from '$lib/server/auth-guards';
import { AUTH_PROVIDERS, isAuthProvider } from '$lib/utils/auth-provider-config';
import { error, isHttpError, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// GET - List all auth keys
export const GET: RequestHandler = async ({ platform, locals }) => {
	requireOwner(locals);
	try {
		if (!platform?.env?.KV) throw error(500, 'KV storage not available');
		const keys: any[] = [];

		// Fetch GitHub OAuth configuration from KV (saved during setup)
		for (const provider of AUTH_PROVIDERS) {
			const configString = await platform.env.KV.get(`auth_config:${provider}`);
			if (!configString) continue;
			const config = JSON.parse(configString);
			keys.push({
				id: config.id,
				name: `${provider === 'github' ? 'GitHub' : 'Discord'} OAuth (Setup)`,
				provider: config.provider,
				type: 'oauth',
				clientId: config.clientId,
				createdAt: config.createdAt,
				isSetupKey: true
			});
		}

		return json({ keys });
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) throw err;
		console.error('Failed to fetch auth keys');
		throw error(500, 'Failed to fetch authentication keys');
	}
};

// POST - Create new auth key
export const POST: RequestHandler = async ({ request, platform, locals }) => {
	requireOwner(locals);
	try {
		if (!platform?.env?.KV) throw error(500, 'KV storage not available');
		const data = await request.json();

		// Validate required fields
		if (!data.name || !data.provider || !data.clientId || !data.clientSecret) {
			throw error(400, 'Missing required fields');
		}
		if (!isAuthProvider(data.provider))
			throw error(400, 'Unsupported authentication provider');

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
		const authConfig = {
			id,
			provider: data.provider,
			clientId: data.clientId,
			clientSecret: data.clientSecret,
			createdAt,
			updatedAt: new Date().toISOString()
		};
		await platform.env.KV.put(`auth_config:${data.provider}`, JSON.stringify(authConfig));

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
