/**
 * Reading the person an admin action points at.
 *
 * Every route that acts on another account needs the row, what that person
 * actually RANKS as, and what the person acting ranks as. The owner's row claims
 * nothing special (it is resolved from configuration, exactly as the session
 * hook does), so ranking lives here once rather than drifting across routes.
 */

import { error } from '@sveltejs/kit';
import { resolveOwnerStatus } from '$lib/utils/auth-identity';
import { effectiveRole, type Role } from '$lib/access/roles';

export type Db = NonNullable<App.Platform['env']['DB']>;

export interface TargetRow {
	id: string;
	email: string;
	name: string | null;
	github_login: string | null;
	role: string | null;
	is_admin: number;
}

export async function loadTarget(db: Db, id: string): Promise<TargetRow> {
	const row = await db
		.prepare('SELECT id, email, name, github_login, role, is_admin FROM users WHERE id = ?')
		.bind(id)
		.first<TargetRow>();
	if (!row) throw error(404, 'User not found');
	return row;
}

/** What the person being acted on actually is. */
export async function rankOf(platform: App.Platform | undefined, row: TargetRow): Promise<Role> {
	const isOwner = await resolveOwnerStatus(platform, {
		id: row.id,
		github_login: row.github_login
	});
	return effectiveRole({ isOwner, role: row.role, isAdmin: row.is_admin === 1 });
}

/** What the signed-in person is. */
export function actorRole(user: App.Locals['user']): Role {
	return effectiveRole(user);
}
