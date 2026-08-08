/**
 * Authorization guards for server routes.
 *
 * Routes under /api/admin are NOT covered by the /admin layout — SvelteKit
 * layouts do not apply to API routes — so every admin endpoint has to assert
 * its own caller. These helpers exist so that assertion is one call and looks
 * the same everywhere, rather than being re-typed (or forgotten) per file.
 *
 * `isSuperAdmin` is honoured for the same reason stats-guard.ts honours it:
 * downstream apps that add a superadmin tier sit ABOVE owner/admin, and would
 * otherwise pass the stats checks while being refused by these.
 */
import { error } from '@sveltejs/kit';

type GuardUser =
	| {
			isOwner?: boolean;
			isAdmin?: boolean;
			isSuperAdmin?: boolean;
	  }
	| null
	| undefined;

// `locals` is optional-chained throughout: a caller that reaches these with no
// locals at all is unauthenticated, and should get a 401 rather than a
// TypeError that some upstream catch block might turn into a success path.

export function isAdminUser(user: GuardUser): boolean {
	if (!user) return false;
	return Boolean(user.isOwner || user.isAdmin || user.isSuperAdmin);
}

export function isOwnerUser(user: GuardUser): boolean {
	if (!user) return false;
	return Boolean(user.isOwner || user.isSuperAdmin);
}

/** Owner or admin. Throws 401 when unauthenticated, 403 when under-privileged. */
export function requireAdmin(locals: App.Locals | undefined): void {
	if (!locals?.user) {
		throw error(401, 'Unauthorized');
	}
	if (!isAdminUser(locals.user)) {
		throw error(403, 'Forbidden');
	}
}

/** Owner only — for actions that change how authentication itself works. */
export function requireOwner(locals: App.Locals | undefined): void {
	if (!locals?.user) {
		throw error(401, 'Unauthorized');
	}
	if (!isOwnerUser(locals.user)) {
		throw error(403, 'Forbidden');
	}
}
