import { requireOwner } from '$lib/server/auth-guards';
import { AUTH_PROVIDERS } from '$lib/utils/auth-provider-config';
import { error, isHttpError, json } from '@sveltejs/kit';
import type { KVNamespace } from '@cloudflare/workers-types';
import type { RequestHandler } from './$types';

interface StoredAuthConfig {
	clientId?: string;
	clientSecret?: string;
	createdAt?: string;
	id?: string;
	provider?: string;
	updatedAt?: string;
}

async function findStoredConfig(
	kv: KVNamespace,
	id: string
): Promise<{ config: StoredAuthConfig; provider: (typeof AUTH_PROVIDERS)[number] } | null> {
	for (const provider of AUTH_PROVIDERS) {
		const stored = await kv.get(`auth_config:${provider}`);
		if (!stored) continue;
		const config = JSON.parse(stored) as StoredAuthConfig;
		if (config.id === id) return { config, provider };
	}
	return null;
}

function assertNotSetupKey(
	target: { provider: (typeof AUTH_PROVIDERS)[number] },
	action: string
): void {
	if (target.provider === 'github') {
		throw error(
			403,
			`Cannot ${action} setup authentication key. This key was configured during initial setup.`
		);
	}
}

export const PUT: RequestHandler = async ({ params, request, platform, locals }) => {
	requireOwner(locals);

	try {
		const kv = platform?.env?.KV;
		if (!kv) throw error(500, 'KV storage not available');

		const data = await request.json();
		if (!data.name || !data.clientId) throw error(400, 'Missing required fields');

		const target = await findStoredConfig(kv, params.id);
		if (!target) throw error(404, 'Authentication key not found');
		assertNotSetupKey(target, 'edit');

		const updatedAt = new Date().toISOString();
		const authConfig: StoredAuthConfig = {
			...target.config,
			id: params.id,
			provider: target.provider,
			clientId: data.clientId,
			...(data.clientSecret && { clientSecret: data.clientSecret }),
			updatedAt
		};
		await kv.put(`auth_config:${target.provider}`, JSON.stringify(authConfig));

		return json({
			success: true,
			key: {
				id: params.id,
				name: data.name,
				provider: target.provider,
				type: data.type,
				clientId: data.clientId,
				updatedAt
			}
		});
	} catch (err) {
		if (isHttpError(err)) throw err;
		console.error('Failed to update auth key:', err);
		throw error(500, 'Failed to update authentication key');
	}
};

export const DELETE: RequestHandler = async ({ params, platform, locals }) => {
	requireOwner(locals);

	try {
		const kv = platform?.env?.KV;
		if (!kv) throw error(500, 'KV storage not available');

		const target = await findStoredConfig(kv, params.id);
		if (!target) throw error(404, 'Authentication key not found');
		assertNotSetupKey(target, 'delete');

		await kv.delete(`auth_config:${target.provider}`);
		return json({ success: true });
	} catch (err) {
		if (isHttpError(err)) throw err;
		console.error('Failed to delete auth key:', err);
		throw error(500, 'Failed to delete authentication key');
	}
};
