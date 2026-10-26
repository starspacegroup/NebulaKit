import { error } from '@sveltejs/kit';
import { can, PERMISSION_LABELS, type Permission } from '$lib/access/permissions';

export type AuthenticatedUser = NonNullable<App.Locals['user']>;

export function requireUser(locals: App.Locals): AuthenticatedUser {
	if (!locals.user) throw error(401, 'Authentication required');
	return locals.user;
}

/**
 * `isSuperAdmin` is honoured here for the same reason `stats-guard.ts` honours
 * it: downstream apps that add a superadmin tier sit ABOVE owner/admin, and
 * would otherwise pass the stats checks while being refused by every admin API.
 * These two files must agree. NebulaKit itself never sets the flag.
 */
export function requireAdmin(locals: App.Locals): AuthenticatedUser {
	const user = requireUser(locals);
	if (!user.isOwner && !user.isAdmin && !user.isSuperAdmin)
		throw error(403, 'Administrator access required');
	return user;
}

export function requireOwner(locals: App.Locals): AuthenticatedUser {
	const user = requireUser(locals);
	if (!user.isOwner && !user.isSuperAdmin) throw error(403, 'Owner access required');
	return user;
}

/**
 * Guard an admin area by named permission (owner and superadmin hold all).
 * Every load and action that serves an area calls this itself: hiding a nav
 * link is not authorization, and a `+page.server.ts` load also runs on a
 * client-side navigation or a direct `__data.json` fetch, which the layout's
 * redirect does not cover.
 */
export function requirePermission(locals: App.Locals, permission: Permission): AuthenticatedUser {
	const user = requireUser(locals);
	if (!can(user, permission)) {
		throw error(403, `You do not have access to ${PERMISSION_LABELS[permission].label}.`);
	}
	return user;
}
