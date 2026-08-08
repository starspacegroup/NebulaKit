import { requireOwner } from '$lib/server/auth-guards';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ platform, locals, params, request }) => {
	const owner = requireOwner(locals);

	const userId = params.id;
	const body = await request.json();
	const { isAdmin } = body;

	if (typeof isAdmin !== 'boolean') {
		throw error(400, 'isAdmin must be a boolean');
	}

	try {
		const db = platform?.env?.DB;
		if (!db) {
			throw error(500, 'Database not available');
		}

		// Get the target user
		const targetUser = await db
			.prepare('SELECT id, email, github_login FROM users WHERE id = ?')
			.bind(userId)
			.first<{ id: string; email: string; github_login: string }>();

		if (!targetUser) {
			throw error(404, 'User not found');
		}

		// Check if trying to modify self
		if (userId === owner.id) {
			throw error(400, 'Cannot modify your own admin status');
		}

		// Update user admin status
		await db
			.prepare('UPDATE users SET is_admin = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
			.bind(isAdmin ? 1 : 0, userId)
			.run();

		// Force the target to authenticate again after any authorization change.
		await db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId).run();

		return json({
			success: true,
			message: isAdmin ? 'User promoted to admin' : 'User demoted from admin'
		});
	} catch (err: any) {
		console.error('Failed to update user:', err);
		if (err.status) {
			throw err;
		}
		throw error(500, 'Failed to update user');
	}
};

export const DELETE: RequestHandler = async ({ platform, locals, params }) => {
	const owner = requireOwner(locals);

	const userId = params.id;

	try {
		const db = platform?.env?.DB;
		if (!db) {
			throw error(500, 'Database not available');
		}

		// Check if trying to delete self
		if (userId === owner.id) {
			throw error(400, 'Cannot delete your own account');
		}

		// Get the target user
		const targetUser = await db
			.prepare('SELECT id, email FROM users WHERE id = ?')
			.bind(userId)
			.first<{ id: string; email: string }>();

		if (!targetUser) {
			throw error(404, 'User not found');
		}

		// Delete user (cascades to sessions and oauth_accounts)
		await db.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();

		return json({
			success: true,
			message: 'User deleted successfully'
		});
	} catch (err: any) {
		console.error('Failed to delete user:', err);
		if (err.status) {
			throw err;
		}
		throw error(500, 'Failed to delete user');
	}
};
