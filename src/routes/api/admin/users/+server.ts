import { requirePermission } from '$lib/server/auth-guards';
import { rankOf } from '$lib/server/admin-target';
import {
	isPiiRevealed,
	maskEmail,
	maskGeneric,
	maskName,
	PII_REVEAL_COOKIE
} from '$lib/server/pii-mask';
import { parsePermissions } from '$lib/access/permissions';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ platform, locals, cookies }) => {
	const viewer = requirePermission(locals, 'users');

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
				u.role,
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

		// Each row's effective role (the owner is config, not a column) and its
		// granted areas, so the UI can offer only what the viewer may do.
		const grants = new Map<string, string[]>();
		try {
			const granted = await db.prepare('SELECT user_id, permission FROM user_permissions').all();
			for (const g of (granted.results || []) as { user_id: string; permission: string }[]) {
				if (!g || typeof g.user_id !== 'string') continue;
				grants.set(g.user_id, [...(grants.get(g.user_id) ?? []), g.permission]);
			}
		} catch {
			// Pre-0021 database: no grants to show.
		}
		const rows = await Promise.all(
			(result.results || []).map(async (entry: Record<string, unknown>) => {
				const row = entry as {
					id: string;
					email: string;
					github_login: string | null;
					role: string | null;
					is_admin: number;
				};
				const effective = await rankOf(platform, { ...row, name: null });
				return {
					...entry,
					effective_role: effective,
					permissions: effective === 'admin' ? parsePermissions(grants.get(row.id)) : []
				};
			})
		);

		const revealed = isPiiRevealed(viewer, cookies?.get(PII_REVEAL_COOKIE));
		const users = rows.map((entry: Record<string, unknown>) =>
			revealed
				? entry
				: {
						...entry,
						// Masked rows are display-only: the id here is a mask, so it can
						// never be a valid PATCH/DELETE target and the `user.id ===
						// viewer.id` self-action guard cannot match either. The admin UI
						// therefore disables those actions until PII is revealed, rather
						// than letting them fire and 404. See admin/users/+page.svelte.
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
	const viewer = requirePermission(locals, 'users');

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
