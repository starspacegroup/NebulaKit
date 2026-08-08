import { error, json } from '@sveltejs/kit';
import { buildSessionCookieHeader } from '$lib/utils/session';
import type { RequestHandler } from './$types';

interface OAuthAccount {
	id: string;
	user_id: string;
	provider: string;
	provider_account_id: string;
	created_at: string;
}

// GET - Get list of connected accounts for the current user
export const GET: RequestHandler = async ({ locals, platform }) => {
	// Require authentication
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	try {
		const connections: OAuthAccount[] = [];

		if (platform?.env?.DB) {
			const result = await platform.env.DB.prepare(
				'SELECT provider, provider_account_id, created_at FROM oauth_accounts WHERE user_id = ?'
			)
				.bind(locals.user.id)
				.all<OAuthAccount>();

			if (result.results) {
				connections.push(...result.results);
			}
		}

		if (locals.user.isPretend && locals.user.simulatedConnections?.length) {
			const knownProviders = new Set(connections.map((connection) => connection.provider));
			for (const provider of locals.user.simulatedConnections) {
				if (!knownProviders.has(provider)) {
					connections.push({
						id: `${locals.user.id}:${provider}`,
						user_id: locals.user.id,
						provider,
						provider_account_id: locals.user.login,
						created_at: new Date().toISOString()
					});
				}
			}
		}

		return json({ connections });
	} catch (err) {
		console.error('Failed to fetch connected accounts:', err);
		throw error(500, 'Failed to fetch connected accounts');
	}
};

// DELETE - Unlink a connected account
export const DELETE: RequestHandler = async ({ locals, platform, request, url }) => {
	// Require authentication
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	try {
		const body = await request.json();
		const { provider } = body;

		if (!provider) {
			throw error(400, 'Provider is required');
		}

		if (locals.user.isPretend) {
			const existingConnections = locals.user.simulatedConnections || [];
			const simulatedConnections = existingConnections.filter((value) => value !== provider);

			return json(
				{ success: true, connections: simulatedConnections.map((name) => ({ provider: name })) },
				{
					headers: {
						'Set-Cookie': await buildSessionCookieHeader(
							{
								...locals.user,
								simulatedConnections
							},
							url,
							platform?.env?.SESSION_SECRET
						)
					}
				}
			);
		}

		if (!platform?.env?.DB) {
			throw error(500, 'Database not available');
		}

		// Check if user has a password (can still log in without social accounts)
		const userRecord = await platform.env.DB.prepare('SELECT password_hash FROM users WHERE id = ?')
			.bind(locals.user.id)
			.first<{ password_hash: string | null }>();

		const hasPassword =
			userRecord?.password_hash !== null && userRecord?.password_hash !== undefined;

		// Check how many accounts the user has linked
		const accountsResult = await platform.env.DB.prepare(
			'SELECT provider FROM oauth_accounts WHERE user_id = ?'
		)
			.bind(locals.user.id)
			.all<{ provider: string }>();

		const linkedAccounts = accountsResult.results || [];

		// Don't allow unlinking the only connection if user has no password
		if (!hasPassword && linkedAccounts.length <= 1) {
			throw error(
				400,
				'Cannot unlink your only login method. Set a password first or link another account.'
			);
		}

		// Remove the connection
		await platform.env.DB.prepare('DELETE FROM oauth_accounts WHERE user_id = ? AND provider = ?')
			.bind(locals.user.id, provider)
			.run();

		return json({ success: true });
	} catch (err) {
		if (err instanceof Response || (err as any).status) {
			throw err;
		}
		console.error('Failed to unlink account:', err);
		throw error(500, 'Failed to unlink account');
	}
};
