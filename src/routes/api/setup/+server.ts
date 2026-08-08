import { requireOwner } from '$lib/server/auth-guards';
import { error, isHttpError, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ platform }) => {
	try {
		const kv = platform?.env?.KV;
		if (!kv) throw error(500, 'KV storage not available');

		const [authConfig, ownerId, setupLocked] = await Promise.all([
			kv.get('auth_config:github'),
			kv.get('github_owner_id'),
			kv.get('admin_first_login_completed')
		]);

		return json({
			hasConfig: !!authConfig,
			hasAdmin: !!ownerId,
			setupLocked: !!setupLocked
		});
	} catch (err) {
		if (isHttpError(err)) throw err;
		console.error('Failed to check setup status');
		throw error(500, 'Failed to check setup status');
	}
};

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	try {
		const kv = platform?.env?.KV;
		if (!kv) throw error(500, 'KV storage not available');

		const [existingConfig, existingOwnerId, existingOwnerUsername, setupLocked] = await Promise.all(
			[
				kv.get('auth_config:github'),
				kv.get('github_owner_id'),
				kv.get('github_owner_username'),
				kv.get('admin_first_login_completed')
			]
		);

		// An owner must explicitly reset all setup state before this endpoint can
		// assign ownership again. Partial or unreadable setup state fails closed.
		if (existingConfig || existingOwnerId || existingOwnerUsername || setupLocked) {
			requireOwner(locals);
			throw error(
				403,
				'Setup is locked. Use the owner-only reset endpoint before configuring it again.'
			);
		}

		const setupSecret = platform.env.SETUP_SECRET;
		if (!setupSecret) throw error(503, 'SETUP_SECRET is not configured');
		if (request.headers.get('authorization') !== `Bearer ${setupSecret}`) {
			throw error(401, 'Invalid setup credentials');
		}

		const data = await request.json();
		if (!data.clientId || !data.clientSecret) {
			throw error(400, 'Client ID and Client Secret are required');
		}
		if (!data.adminGithubUsername?.trim()) {
			throw error(400, 'Admin GitHub Username is required');
		}

		const trimmedUsername = data.adminGithubUsername.trim();
		const usernamePattern = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/;
		if (!usernamePattern.test(trimmedUsername)) {
			throw error(400, 'Invalid GitHub username format');
		}
		if (data.provider && data.provider !== 'github') {
			throw error(400, 'Initial setup only supports GitHub');
		}

		const userResponse = await fetch(`https://api.github.com/users/${trimmedUsername}`, {
			headers: {
				Accept: 'application/vnd.github.v3+json',
				'User-Agent': 'NebulaKit'
			}
		});
		if (!userResponse.ok) {
			if (userResponse.status === 404) {
				throw error(404, `GitHub user '${trimmedUsername}' not found`);
			}
			throw error(502, 'Failed to fetch GitHub user information');
		}

		const githubUser = await userResponse.json();
		const adminGithubId = String(githubUser.id);
		const adminGithubUsername = String(githubUser.login);
		const now = new Date().toISOString();
		const authConfig = {
			id: crypto.randomUUID(),
			provider: 'github',
			clientId: data.clientId,
			clientSecret: data.clientSecret,
			createdAt: now,
			updatedAt: now
		};

		await kv.put('auth_config:github', JSON.stringify(authConfig));
		await kv.put('github_owner_id', adminGithubId);
		await kv.put('github_owner_username', adminGithubUsername);

		return json({
			success: true,
			message: `Configuration saved! Admin user set to @${adminGithubUsername}. You can now log in.`,
			adminUsername: adminGithubUsername,
			adminId: adminGithubId
		});
	} catch (err) {
		if (isHttpError(err)) throw err;
		console.error('Failed to save setup configuration');
		throw error(500, 'Failed to save configuration');
	}
};
