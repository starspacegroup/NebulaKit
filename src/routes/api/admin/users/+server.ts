import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ platform, locals }) => {
	// Check if user is authenticated and is admin
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	if (!locals.user.isOwner && !locals.user.isAdmin) {
		throw error(403, 'Forbidden');
	}

	try {
		const db = platform?.env?.DB;
		if (!db) {
			throw error(500, 'Database not available');
		}

		// Get all users with their OAuth info
		const result = await db
			.prepare(
				`
			SELECT 
				u.id,
				u.email,
				u.name,
				u.is_admin,
				u.github_login,
				u.github_avatar_url,
				u.created_at,
				oa.provider_account_id as github_id
			FROM users u
			LEFT JOIN oauth_accounts oa ON u.id = oa.user_id AND oa.provider = 'github'
			ORDER BY u.created_at DESC
		`
			)
			.all();

		return json({
			users: result.results || []
		});
	} catch (err) {
		console.error('Failed to fetch users:', err);
		throw error(500, 'Failed to fetch users');
	}
};

export const POST: RequestHandler = async ({ platform, locals, request }) => {
	// Check if user is authenticated and is admin
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	if (!locals.user.isOwner && !locals.user.isAdmin) {
		throw error(403, 'Forbidden');
	}

	try {
		const db = platform?.env?.DB;
		if (!db) {
			throw error(500, 'Database not available');
		}

		const body = await request.json();
		const { githubLogin, email } = body;

		if (!githubLogin || !email) {
			throw error(400, 'GitHub login and email are required');
		}

		// Create a placeholder user that will be completed on first login
		const userId = crypto.randomUUID();
		await db
			.prepare(
				`
			INSERT INTO users (id, email, github_login, is_admin, created_at)
			VALUES (?, ?, ?, 0, CURRENT_TIMESTAMP)
		`
			)
			.bind(userId, email, githubLogin)
			.run();

		return json({
			success: true,
			message: 'User invited successfully',
			user: {
				id: userId,
				email,
				github_login: githubLogin,
				is_admin: 0
			}
		});
	} catch (err: any) {
		console.error('Failed to invite user:', err);
		if (err.message?.includes('UNIQUE constraint')) {
			throw error(400, 'User with this email or GitHub login already exists');
		}
		throw error(500, 'Failed to invite user');
	}
};
