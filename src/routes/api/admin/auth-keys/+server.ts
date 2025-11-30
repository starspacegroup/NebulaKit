import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// GET - List all auth keys
export const GET: RequestHandler = async ({ platform }) => {
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
		}

		// In the future, additional auth keys could be fetched from KV here
		// e.g., await platform.env.KV.list({ prefix: 'auth_key:' })

		return json({ keys });
	} catch (err) {
		console.error('Failed to fetch auth keys:', err);
		throw error(500, 'Failed to fetch authentication keys');
	}
};

// POST - Create new auth key
export const POST: RequestHandler = async ({ request, platform }) => {
	try {
		const data = await request.json();

		// Validate required fields
		if (!data.name || !data.clientId || !data.clientSecret) {
			throw error(400, 'Missing required fields');
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

		// In production, store in KV:
		// await platform.env.KV.put(`auth_key:${id}`, JSON.stringify({
		//   ...newKey,
		//   clientSecret: data.clientSecret // Store encrypted
		// }));

		return json({ success: true, key: newKey });
	} catch (err) {
		if (err instanceof Error && 'status' in err) {
			throw err;
		}
		console.error('Failed to create auth key:', err);
		throw error(500, 'Failed to create authentication key');
	}
};
