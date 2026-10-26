import { actorRole, loadTarget, rankOf } from '$lib/server/admin-target';
import { requirePermission } from '$lib/server/auth-guards';
import {
	canEditPermissions,
	DEFAULT_ADMIN_PERMISSIONS,
	parsePermissions,
	type Permission
} from '$lib/access/permissions';
import {
	canAssignRole,
	canDeleteUser,
	isAssignableRole,
	type AssignableRole
} from '$lib/access/roles';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Change a user's role and, for admins, their granted areas.
 *
 * The ladder (roles.ts) is enforced HERE, on the server, from the stored row:
 * the actor must outrank the target, and may only hand out a role strictly
 * below their own. The owner is configuration, so it ranks above everyone and
 * no request can reach it. Granting permissions is owner/superadmin only.
 *
 * Body: `{ role?: 'user'|'admin'|'superadmin', isAdmin?: boolean, permissions?: string[] }`.
 * `isAdmin` is the older shape and maps to role admin/user.
 */
export const PATCH: RequestHandler = async ({ platform, locals, params, request }) => {
	const actor = requirePermission(locals, 'users-manage');

	const userId = params.id;
	const body = await request.json();
	const { isAdmin, role: requestedRole, permissions: requestedPermissions } = body;

	if (requestedRole !== undefined && !isAssignableRole(requestedRole)) {
		throw error(400, 'role must be one of user, admin, superadmin');
	}
	if (requestedPermissions !== undefined && !Array.isArray(requestedPermissions)) {
		throw error(400, 'permissions must be an array');
	}
	if (requestedRole === undefined && requestedPermissions === undefined) {
		if (typeof isAdmin !== 'boolean') {
			throw error(400, 'isAdmin must be a boolean');
		}
	}

	try {
		const db = platform?.env?.DB;
		if (!db) {
			throw error(500, 'Database not available');
		}

		const targetUser = await loadTarget(db, userId);

		// Check if trying to modify self
		if (userId === actor.id) {
			throw error(400, 'Cannot modify your own admin status');
		}

		const actorRank = actorRole(actor);
		const targetRank = await rankOf(platform, targetUser);

		// Rank first: acting on somebody at or above you is refused outright,
		// whatever the change is. This is what stops an admin touching the owner.
		const nextRole: AssignableRole =
			requestedRole ??
			(typeof isAdmin === 'boolean'
				? isAdmin
					? 'admin'
					: 'user'
				: (targetRank as AssignableRole));
		const decision = canAssignRole(actorRank, targetRank, nextRole);
		if (!decision.ok) {
			throw error(403, decision.reason ?? 'Not allowed');
		}

		const becomesAdmin = nextRole === 'admin' && targetRank !== 'admin';
		let permissions: Permission[] | null = null;
		if (requestedPermissions !== undefined) {
			const editable = canEditPermissions(actorRank, nextRole);
			if (!editable.ok) {
				throw error(403, editable.reason ?? 'Not allowed');
			}
			permissions = parsePermissions(requestedPermissions);
		} else if (becomesAdmin) {
			permissions = DEFAULT_ADMIN_PERMISSIONS;
		}

		const statements = [
			db
				.prepare(
					'UPDATE users SET role = ?, is_admin = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
				)
				.bind(nextRole, nextRole === 'user' ? 0 : 1, userId)
		];
		// Anyone who is not an admin holds no per-area grants: a demotion must not
		// leave rows behind that would reopen a door on the next promotion.
		if (nextRole !== 'admin') {
			permissions = [];
		}
		if (permissions) {
			statements.push(db.prepare('DELETE FROM user_permissions WHERE user_id = ?').bind(userId));
			for (const permission of permissions) {
				statements.push(
					db
						.prepare(
							'INSERT INTO user_permissions (user_id, permission, granted_by) VALUES (?, ?, ?)'
						)
						.bind(userId, permission, actor.id)
				);
			}
			// `can_view_stats` (0009) is the same grant as the `stats` permission.
			statements.push(
				db
					.prepare('UPDATE users SET can_view_stats = ? WHERE id = ?')
					.bind(permissions.includes('stats') ? 1 : 0, userId)
			);
		}
		// Force the target to authenticate again after any authorization change.
		statements.push(db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId));
		await db.batch(statements);

		return json({
			success: true,
			role: nextRole,
			permissions: permissions ?? undefined,
			message: roleMessage(targetRank, nextRole)
		});
	} catch (err: any) {
		console.error('Failed to update user:', err);
		if (err.status) {
			throw err;
		}
		throw error(500, 'Failed to update user');
	}
};

function roleMessage(from: string, to: AssignableRole): string {
	if (from === to) return 'User permissions updated';
	if (to === 'user') return 'User demoted from admin';
	return to === 'admin' ? 'User promoted to admin' : 'User promoted to superadmin';
}

export const DELETE: RequestHandler = async ({ platform, locals, params }) => {
	const actor = requirePermission(locals, 'users-manage');

	const userId = params.id;

	try {
		const db = platform?.env?.DB;
		if (!db) {
			throw error(500, 'Database not available');
		}

		// Check if trying to delete self
		if (userId === actor.id) {
			throw error(400, 'Cannot delete your own account');
		}

		const targetUser = await loadTarget(db, userId);
		const decision = canDeleteUser(actorRole(actor), await rankOf(platform, targetUser));
		if (!decision.ok) {
			throw error(403, decision.reason ?? 'Not allowed');
		}

		// Delete user (cascades to sessions, oauth_accounts and permissions)
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
