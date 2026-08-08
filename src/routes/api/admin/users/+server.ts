import { requireAdmin } from '$lib/server/auth-guards';
import {
	isPiiRevealed,
	maskEmail,
	maskGeneric,
	maskName,
	PII_REVEAL_COOKIE
} from '$lib/server/pii-mask';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ platform, locals, cookies }) => {
	const viewer = requireAdmin(locals);

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

		const revealed = isPiiRevealed(viewer, cookies?.get(PII_REVEAL_COOKIE));
		const users = (result.results || []).map((entry: Record<string, unknown>) =>
			revealed
				? entry
				: {
						...entry,
						id: maskGeneric(entry.id as string | null | undefined),
						email: maskEmail(entry.email as string | null | undefined),
						name: maskName(entry.name as string | null | undefined),
						github_login: maskGeneric(entry.github_login as string | null | undefined),
						github_avatar_url: null,
						github_id: maskGeneric(entry.github_id as string | null | undefined)
					}
		);

		return json({ users });
	} catch (err) {
		console.error('Failed to fetch users:', err);
		throw error(500, 'Failed to fetch users');
	}
};

export const POST: RequestHandler = async ({ platform, locals, request, cookies }) => {
	const viewer = requireAdmin(locals);

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

		const user = {
			id: userId,
			email,
			github_login: githubLogin,
			is_admin: 0
		};
		const revealed = isPiiRevealed(viewer, cookies?.get(PII_REVEAL_COOKIE));

		return json({
			success: true,
			message: 'User invited successfully',
			user: revealed
				? user
				: {
						...user,
						id: maskGeneric(user.id),
						email: maskEmail(user.email),
						github_login: maskGeneric(user.github_login)
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
