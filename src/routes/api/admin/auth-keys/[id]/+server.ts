import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// PUT - Update auth key
export const PUT: RequestHandler = async ({ params, request, platform }) => {
	try {
		const { id } = params;
		const data = await request.json();

		// Prevent editing of GitHub OAuth setup key
		if (platform?.env?.KV) {
			try {
				const authConfigStr = await platform.env.KV.get('auth_config:github');
				if (authConfigStr) {
					const authConfig = JSON.parse(authConfigStr);
					if (authConfig.id === id) {
						throw error(
							403,
							'Cannot edit setup authentication key. This key was configured during initial setup and cannot be modified here.'
						);
					}
				}
			} catch (err: unknown) {
				// If it's an HttpError (has status property), re-throw it
				if (err && typeof err === 'object' && 'status' in err) {
					throw err;
				}
				// Otherwise, log and continue (allow edit if check fails)
				console.error('Failed to check setup key status:', err);
			}
		}

		// Validate required fields
		if (!data.name || !data.clientId) {
			throw error(400, 'Missing required fields');
		}

		const updatedKey = {
			id,
			name: data.name,
			provider: data.provider,
			type: data.type,
			clientId: data.clientId,
			updatedAt: new Date().toISOString()
		};

		// In production, update in KV:
		// const existing = await platform.env.KV.get(`auth_key:${id}`);
		// if (!existing) throw error(404, 'Key not found');
		// await platform.env.KV.put(`auth_key:${id}`, JSON.stringify({
		//   ...JSON.parse(existing),
		//   ...updatedKey,
		//   ...(data.clientSecret && { clientSecret: data.clientSecret })
		// }));

		return json({ success: true, key: updatedKey });
	} catch (err: unknown) {
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}
		console.error('Failed to update auth key:', err);
		throw error(500, 'Failed to update authentication key');
	}
};

// DELETE - Delete auth key
export const DELETE: RequestHandler = async ({ params, platform }) => {
	try {
		const { id } = params;

		// Prevent deletion of GitHub OAuth setup key
		if (platform?.env?.KV) {
			try {
				const authConfigStr = await platform.env.KV.get('auth_config:github');
				if (authConfigStr) {
					const authConfig = JSON.parse(authConfigStr);
					if (authConfig.id === id) {
						throw error(
							403,
							'Cannot delete setup authentication key. This key was configured during initial setup and is required for authentication.'
						);
					}
				}
			} catch (err: unknown) {
				// If it's an HttpError (has status property), re-throw it
				if (err && typeof err === 'object' && 'status' in err) {
					throw err;
				}
				// Otherwise, log and continue (allow deletion if check fails)
				console.error('Failed to check setup key status:', err);
			}
		}

		// In production, delete from KV:
		// await platform.env.KV.delete(`auth_key:${id}`);

		return json({ success: true });
	} catch (err: unknown) {
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}
		console.error('Failed to delete auth key:', err);
		throw error(500, 'Failed to delete authentication key');
	}
};
