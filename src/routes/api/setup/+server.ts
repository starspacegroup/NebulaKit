import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// GET - Check if OAuth configuration exists
export const GET: RequestHandler = async ({ platform }) => {
	try {
		if (!platform?.env?.KV) {
			return json({
				hasConfig: false,
				hasAdmin: false
			});
		}

		// Check if auth config exists
		const authConfigStr = await platform.env.KV.get('auth_config:github');
		const hasConfig = !!authConfigStr;

		// Check if admin is set
		const ownerId = await platform.env.KV.get('github_owner_id');
		const hasAdmin = !!ownerId;

		// Check if setup is locked (admin has logged in at least once)
		const setupLocked = !!(await platform.env.KV.get('admin_first_login_completed'));

		return json({
			hasConfig,
			hasAdmin,
			setupLocked
		});
	} catch (err) {
		console.error('Failed to check setup status:', err);
		// Return false values on error to allow setup
		return json({
			hasConfig: false,
			hasAdmin: false,
			setupLocked: false
		});
	}
};

// POST - Save initial GitHub OAuth configuration
export const POST: RequestHandler = async ({ request, platform }) => {
	try {
		// This endpoint sets site ownership, so it is unauthenticated by
		// necessity — it runs before an owner exists. Everything below is
		// therefore fail-closed: any doubt about whether setup is still open
		// must resolve to "no".
		if (!platform?.env?.KV) {
			// Without KV the lock cannot be read, and an unreadable lock used to
			// mean "proceed".
			throw error(500, 'KV storage not available');
		}

		// Check if setup is locked (admin has already logged in)
		const setupLocked = await platform.env.KV.get('admin_first_login_completed');
		if (setupLocked) {
			throw error(
				403,
				'Setup is locked. The admin user has already logged in. Setup can only be performed once.'
			);
		}

		// Second, independent lock: if an owner is already recorded, setup is
		// over regardless of the first-login flag. Otherwise losing that single
		// flag is enough to let an anonymous caller re-own the site. Clearing
		// both is what the owner-gated /api/reset is for.
		const existingOwnerId = await platform.env.KV.get('github_owner_id');
		const existingOwnerUsername = await platform.env.KV.get('github_owner_username');
		if (existingOwnerId || existingOwnerUsername) {
			throw error(
				403,
				'Setup is locked. An owner is already configured for this site. Use the reset endpoint as the owner to start over.'
			);
		}

		const data = await request.json();

		// Check if config already exists
		let existingConfig: any = null;
		if (platform?.env?.KV) {
			const existingConfigStr = await platform.env.KV.get('auth_config:github');
			if (existingConfigStr) {
				existingConfig = JSON.parse(existingConfigStr);
			}
		}

		// If config exists, clientId and clientSecret are optional
		// If config doesn't exist, they're required
		if (!existingConfig) {
			if (!data.clientId || !data.clientSecret) {
				throw error(400, 'Client ID and Client Secret are required');
			}
		}

		if (!data.adminGithubUsername || !data.adminGithubUsername.trim()) {
			throw error(400, 'Admin GitHub Username is required');
		}

		// Validate admin GitHub username format
		const trimmedUsername = data.adminGithubUsername.trim();
		const usernameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/;

		if (!usernameRegex.test(trimmedUsername)) {
			throw error(400, 'Invalid GitHub username format');
		}

		// Default to GitHub if provider not specified
		const provider = data.provider || 'github';

		// Prepare auth config - use existing or create new
		let authConfig;
		let id: string;

		if (existingConfig && !data.clientId && !data.clientSecret) {
			// Keep existing credentials
			authConfig = existingConfig;
			id = existingConfig.id;
		} else {
			// Create new config or update existing
			id = existingConfig?.id || crypto.randomUUID();
			const createdAt = existingConfig?.createdAt || new Date().toISOString();

			authConfig = {
				id,
				provider,
				clientId: data.clientId || existingConfig?.clientId,
				clientSecret: data.clientSecret || existingConfig?.clientSecret,
				createdAt,
				updatedAt: new Date().toISOString()
			};
		}
		let adminGithubId: string;
		let adminGithubUsername: string;

		// Fetch GitHub user ID from username
		try {
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
				throw error(500, 'Failed to fetch GitHub user information');
			}

			const githubUser = await userResponse.json();
			adminGithubId = githubUser.id.toString();
			adminGithubUsername = githubUser.login;

			console.log(`✓ Resolved admin GitHub user: ${adminGithubUsername} (ID: ${adminGithubId})`);
		} catch (err) {
			// Re-throw error responses (validation errors)
			if (err instanceof Response) {
				throw err;
			}
			console.error('Failed to fetch GitHub user:', err);
			throw error(500, 'Failed to verify GitHub username');
		}

		// KV presence was asserted at the top of this handler — the old
		// "KV unavailable" fallback branch was unreachable from here and
		// echoed the submitted client secret into the logs on its way out.
		await platform.env.KV.put(`auth_config:${provider}`, JSON.stringify(authConfig));
		console.log('✓ Saved auth config to KV:', { id, provider, clientId: data.clientId });

		// Store admin owner ID
		await platform.env.KV.put('github_owner_id', adminGithubId);
		await platform.env.KV.put('github_owner_username', adminGithubUsername);
		console.log(`✓ Saved admin owner to KV: ${adminGithubUsername} (ID: ${adminGithubId})`);

		return json({
			success: true,
			message: `Configuration saved! Admin user set to @${adminGithubUsername}. You can now log in.`,
			adminUsername: adminGithubUsername,
			adminId: adminGithubId
		});
	} catch (err) {
		if (err instanceof Error && 'status' in err) {
			throw err;
		}
		console.error('Failed to save setup configuration:', err);
		throw error(500, 'Failed to save configuration');
	}
};
