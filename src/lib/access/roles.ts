/**
 * The role ladder: owner > superadmin > admin > user.
 *
 * ONE RULE DOES THE WORK. You may only act on someone strictly below you, and
 * you may only hand out a role strictly below your own. So nobody can promote
 * themselves (nobody is below themselves), an admin cannot mint another admin,
 * and a superadmin cannot touch the owner.
 *
 * OWNER IS NOT A VALUE ANY OF THIS CAN ASSIGN. It lives in configuration
 * (GITHUB_OWNER_ID, else KV), never in `users.role`, so no code path writes it
 * and no compromised admin session can demote it. `ASSIGNABLE_ROLES` leaves it
 * out on purpose and the `role` column's CHECK constraint refuses it.
 *
 * Pure functions only: the database and the owner lookup stay in
 * `admin-target.ts`, so this file is trivial to test exhaustively.
 */

export type Role = 'user' | 'admin' | 'superadmin' | 'owner';

/** Roles that can be stored on a user row. `owner` is deliberately absent. */
export const ASSIGNABLE_ROLES = ['user', 'admin', 'superadmin'] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

const RANK: Record<Role, number> = { user: 0, admin: 1, superadmin: 2, owner: 3 };

/** Numeric rank, higher is more powerful. */
export function rank(role: Role): number {
	return RANK[role];
}

export function isAssignableRole(value: unknown): value is AssignableRole {
	return typeof value === 'string' && (ASSIGNABLE_ROLES as readonly string[]).includes(value);
}

/** A stored role string, defensively: anything unknown is the least power. */
export function storedRole(value: unknown): AssignableRole {
	return isAssignableRole(value) ? value : 'user';
}

/** The role-bearing fields of a session user or a users row. */
export type RoleSubject = {
	isOwner?: boolean;
	isSuperAdmin?: boolean;
	isAdmin?: boolean;
	role?: string | null;
};

/**
 * Effective role. Owner wins over whatever the row says (the row is not where
 * owner is decided). A legacy `isAdmin` with no role is an admin, so sessions
 * and rows from before the ladder lose nothing.
 */
export function effectiveRole(subject: RoleSubject | null | undefined): Role {
	if (!subject) return 'user';
	if (subject.isOwner) return 'owner';
	const stored = storedRole(subject.role);
	if (stored === 'superadmin' || subject.isSuperAdmin) return 'superadmin';
	if (stored === 'admin' || subject.isAdmin) return 'admin';
	return 'user';
}

/** Whether `actor` may act on `target` at all: strictly above, never equal. */
export function canActOn(actor: Role, target: Role): boolean {
	return rank(actor) > rank(target);
}

/** Whether `actor` may hand out `role`: strictly below their own. */
export function canGrant(actor: Role, role: Role): boolean {
	return rank(actor) > rank(role);
}

export interface RoleDecision {
	ok: boolean;
	/** Phrased for the person who attempted it. */
	reason?: string;
}

/** Whether `actor` may change `target` to the role `next`. */
export function canAssignRole(actor: Role, target: Role, next: AssignableRole): RoleDecision {
	if (!canActOn(actor, target)) {
		return {
			ok: false,
			reason:
				target === 'owner'
					? 'The owner cannot be changed from inside the site.'
					: 'You can only change the role of someone below your own role.'
		};
	}
	if (!canGrant(actor, next)) {
		return { ok: false, reason: 'You cannot grant a role at or above your own.' };
	}
	return { ok: true };
}

/** Whether `actor` may delete `target`'s account. */
export function canDeleteUser(actor: Role, target: Role): RoleDecision {
	if (canActOn(actor, target)) return { ok: true };
	return {
		ok: false,
		reason:
			target === 'owner'
				? 'The owner cannot be removed from inside the site.'
				: 'You can only remove someone below your own role.'
	};
}

/** For the UI: the roles this actor may hand out, lowest first. */
export function assignableBy(actor: Role): AssignableRole[] {
	return ASSIGNABLE_ROLES.filter((r) => canGrant(actor, r));
}
