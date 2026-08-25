import { describe, expect, it } from 'vitest';
import { requireAdmin, requireOwner, requireUser } from '../../src/lib/server/auth-guards';
import { canManageStatsConnection, canViewStats } from '../../src/lib/server/stats-guard';

const owner = { user: { id: '1', login: 'o', email: 'o@e.com', isOwner: true, isAdmin: true } };
const admin = { user: { id: '2', login: 'a', email: 'a@e.com', isOwner: false, isAdmin: true } };
const plain = { user: { id: '3', login: 'p', email: 'p@e.com', isOwner: false, isAdmin: false } };

describe('auth guards', () => {
	it('returns authenticated users at each accepted privilege level', () => {
		expect(requireUser(plain as never)).toBe(plain.user);
		expect(requireAdmin(admin as never)).toBe(admin.user);
		expect(requireAdmin(owner as never)).toBe(owner.user);
		expect(requireOwner(owner as never)).toBe(owner.user);
	});

	it('rejects unauthenticated callers', () => {
		expect(() => requireUser({} as never)).toThrowError(expect.objectContaining({ status: 401 }));
		expect(() => requireAdmin({} as never)).toThrowError(expect.objectContaining({ status: 401 }));
		expect(() => requireOwner({} as never)).toThrowError(expect.objectContaining({ status: 401 }));
	});

	it('rejects callers below the required privilege level', () => {
		expect(() => requireAdmin(plain as never)).toThrowError(
			expect.objectContaining({ status: 403 })
		);
		expect(() => requireOwner(admin as never)).toThrowError(
			expect.objectContaining({ status: 403 })
		);
	});
});

describe('superadmin tier', () => {
	// stats-guard.ts honours `isSuperAdmin` for downstream apps that add a tier
	// above owner/admin. These guards must agree, or such a user would pass the
	// stats checks while being refused by every admin API.
	const superadmin = { user: { id: '9', login: 's', email: 's@e.com', isSuperAdmin: true } };

	it('treats a superadmin as both admin and owner', () => {
		expect(requireAdmin(superadmin as never)).toBe(superadmin.user);
		expect(requireOwner(superadmin as never)).toBe(superadmin.user);
	});

	it('agrees with the stats guards for the same user', () => {
		expect(canViewStats(superadmin.user)).toBe(true);
		expect(canManageStatsConnection(superadmin.user)).toBe(true);
	});
});
