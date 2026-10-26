/**
 * What an admin may touch, per area.
 *
 * `roles.ts` answers who outranks whom. This answers what somebody holds, and
 * the two are separate on purpose: rank decides who may GRANT, the grant
 * decides what an admin may DO.
 *
 *   owner, superadmin   everything, always, and not revocable (a permission a
 *                       superadmin can lose is one a compromised session could
 *                       take from them).
 *   admin               exactly what was granted.
 *   user                nothing, whatever stale rows say.
 *
 * Names follow the admin areas the template has. To add an area: add its name
 * here (and a label), guard its routes with `requirePermission` from
 * `auth-guards.ts`, and give it a `permission` in the admin nav. Owner-only
 * areas (settings, auth keys, AI keys, analytics connection, setup, reset) are
 * not permissions: they stay with the owner and superadmins.
 */

import { effectiveRole, type RoleSubject } from './roles';

export const PERMISSIONS = [
	'cms',
	'pages',
	'users',
	'users-manage',
	'stats',
	'pii',
	'api-keys',
	'contact',
	'lighthouse'
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** Shown in the admin UI; `detail` says what handing it over costs. */
export const PERMISSION_LABELS: Record<Permission, { label: string; detail: string }> = {
	cms: { label: 'Content', detail: 'Create, edit and publish CMS content on the live site.' },
	pages: { label: 'Pages', detail: 'Edit builder pages.' },
	users: { label: 'View users', detail: 'See the user list and search GitHub to invite people.' },
	'users-manage': {
		label: 'Manage users',
		detail: 'Change roles and delete accounts, only for people below their own role.'
	},
	stats: {
		label: 'Stats',
		detail: 'Visitor numbers, routes, referrers. Aggregate, never a person.'
	},
	pii: {
		label: 'Reveal personal data',
		detail: 'Unmask names, emails and ids in admin views.'
	},
	'api-keys': {
		label: 'API keys',
		detail: 'Create and revoke site API keys. A key can carry site:admin.'
	},
	contact: {
		label: 'Contact forms',
		detail: 'Submissions from the public form. Names and emails.'
	},
	lighthouse: { label: 'Lighthouse', detail: 'Performance audits of the public site.' }
};

/**
 * What a newly promoted admin gets when no list is given: the areas a plain
 * admin could reach before permissions existed. Matches the backfill in
 * migration 0021. Owner-only areas are never defaulted.
 */
export const DEFAULT_ADMIN_PERMISSIONS: Permission[] = [
	'cms',
	'pages',
	'users',
	'contact',
	'lighthouse'
];

export function isPermission(value: unknown): value is Permission {
	return typeof value === 'string' && (PERMISSIONS as readonly string[]).includes(value);
}

/** Keep only real permission names, in canonical order. Unknown names grant nothing. */
export function parsePermissions(values: unknown): Permission[] {
	if (!Array.isArray(values)) return [];
	return PERMISSIONS.filter((p) => values.includes(p));
}

export type PermissionSubject = RoleSubject & { permissions?: readonly string[] | null };

/** Whether this user holds `permission`. */
export function can(user: PermissionSubject | null | undefined, permission: Permission): boolean {
	if (!user) return false;
	const role = effectiveRole(user);
	if (role === 'owner' || role === 'superadmin') return true;
	if (role !== 'admin') return false;
	return Array.isArray(user.permissions) && user.permissions.includes(permission);
}

/** Everything this user effectively holds, for the nav and the UI. */
export function heldPermissions(user: PermissionSubject | null | undefined): Permission[] {
	return PERMISSIONS.filter((p) => can(user, p));
}

/**
 * Whether `actor` may edit the permission list of someone who is (or is about
 * to be) `target`. Only owner and superadmin, and only for an admin: the owner
 * and superadmins hold everything, and granting areas to a plain user would
 * read as access that was never really given.
 */
export function canEditPermissions(
	actor: ReturnType<typeof effectiveRole>,
	target: ReturnType<typeof effectiveRole>
): { ok: boolean; reason?: string } {
	if (actor !== 'owner' && actor !== 'superadmin') {
		return { ok: false, reason: 'Only the owner or a superadmin can change what an admin may do.' };
	}
	if (target === 'owner' || target === 'superadmin') {
		return {
			ok: false,
			reason: 'The owner and superadmins hold every permission, and it cannot be taken away.'
		};
	}
	if (target !== 'admin') {
		return { ok: false, reason: 'Make them an admin first: permissions only apply to admins.' };
	}
	return { ok: true };
}
