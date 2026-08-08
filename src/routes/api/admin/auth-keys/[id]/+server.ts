import { requireAdmin } from '$lib/server/auth-guard';
import { authConfigKey, findProviderByKeyId } from '$lib/server/oauth-config';
import { error, json } from '@sveltejs/kit';
import type { KVNamespace } from '@cloudflare/workers-types';
import type { RequestHandler } from './$types';

/**
 * The GitHub OAuth config is written by the setup flow and is what login
 * depends on, so it stays read-only here regardless of caller.
 */
async function assertNotSetupKey(kv: KVNamespace, id: string, action: string): Promise<void> {
	const stored = await kv.get(authConfigKey('github'));
	if (!stored) return;

	let config: { id?: string };
	try {
		config = JSON.parse(stored);
	} catch (err) {
		// A malformed config must not be a way past the guard.
		console.error('Failed to parse GitHub auth config:', err);
		throw error(500, 'Stored GitHub authentication config is unreadable');
	}

	if (config?.id === id) {
		throw error(
			403,
			`Cannot ${action} setup authentication key. This key was configured during initial setup.`
		);
	}
}

// PUT - Update auth key
export const PUT: RequestHandler = async ({ params, request, platform, locals }) => {
	requireAdmin(locals);

	try {
		const { id } = params;
		const data = await request.json();

		if (!data.name || !data.clientId) {
			throw error(400, 'Missing required fields');
		}

		const kv = platform?.env?.KV;
		if (!kv) {
			throw error(500, 'KV storage not available');
		}

		await assertNotSetupKey(kv, id, 'edit');

		// Resolve the target from what is stored, not from `data.provider` —
		// trusting the body let a caller aim the write at a different config
		// than the one the guard above just checked.
		const target = await findProviderByKeyId(kv, id);
		if (!target) {
			throw error(404, 'Authentication key not found');
		}

		const authConfig = {
			...target.config,
			id,
			provider: target.provider,
			clientId: data.clientId,
			// Only update clientSecret if provided
			...(data.clientSecret && { clientSecret: data.clientSecret }),
			updatedAt: new Date().toISOString()
		};

		await kv.put(authConfigKey(target.provider), JSON.stringify(authConfig));
		console.log(`✓ Updated ${target.provider} OAuth config in KV`);

		return json({
			success: true,
			key: {
				id,
				name: data.name,
				provider: target.provider,
				type: data.type,
				clientId: data.clientId,
				updatedAt: authConfig.updatedAt
			}
		});
	} catch (err: unknown) {
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}
		console.error('Failed to update auth key:', err);
		throw error(500, 'Failed to update authentication key');
	}
};

// DELETE - Delete auth key
export const DELETE: RequestHandler = async ({ params, platform, locals }) => {
	requireAdmin(locals);

	try {
		const { id } = params;

		const kv = platform?.env?.KV;
		if (!kv) {
			throw error(500, 'KV storage not available');
		}

		await assertNotSetupKey(kv, id, 'delete');

		const target = await findProviderByKeyId(kv, id);
		if (!target) {
			throw error(404, 'Authentication key not found');
		}

		await kv.delete(authConfigKey(target.provider));
		console.log(`✓ Deleted ${target.provider} OAuth config from KV`);

		return json({ success: true });
	} catch (err: unknown) {
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}
		console.error('Failed to delete auth key:', err);
		throw error(500, 'Failed to delete authentication key');
	}
};
