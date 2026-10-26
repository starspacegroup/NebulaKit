import { describe, expect, it } from 'vitest';
import {
	can,
	canEditPermissions,
	DEFAULT_ADMIN_PERMISSIONS,
	heldPermissions,
	isPermission,
	parsePermissions,
	PERMISSION_LABELS,
	PERMISSIONS
} from '../../src/lib/access/permissions';
import { requirePermission } from '../../src/lib/server/auth-guards';

describe('permissions', () => {
	it('every permission has a label, and the defaults are real and owner-only-free', () => {
		for (const p of PERMISSIONS) expect(PERMISSION_LABELS[p].label).toBeTruthy();
		for (const p of DEFAULT_ADMIN_PERMISSIONS) expect(isPermission(p)).toBe(true);
		expect(DEFAULT_ADMIN_PERMISSIONS).not.toContain('api-keys');
		expect(DEFAULT_ADMIN_PERMISSIONS).not.toContain('pii');
		expect(DEFAULT_ADMIN_PERMISSIONS).not.toContain('users-manage');
	});

	it('parsePermissions drops unknown names and non-arrays', () => {
		expect(parsePermissions(['cms', 'bogus', 'stats', 7])).toEqual(['cms', 'stats']);
		expect(parsePermissions('cms')).toEqual([]);
		expect(parsePermissions(undefined)).toEqual([]);
		expect(isPermission('cms')).toBe(true);
		expect(isPermission('bogus')).toBe(false);
		expect(isPermission(3)).toBe(false);
	});

	it('owner and superadmin hold everything, always', () => {
		for (const p of PERMISSIONS) {
			expect(can({ isOwner: true }, p)).toBe(true);
			expect(can({ role: 'superadmin', permissions: [] }, p)).toBe(true);
		}
		expect(heldPermissions({ isOwner: true })).toEqual([...PERMISSIONS]);
	});

	it('an admin holds exactly what was granted', () => {
		const admin = { role: 'admin', permissions: ['cms', 'stats'] };
		expect(can(admin, 'cms')).toBe(true);
		expect(can(admin, 'stats')).toBe(true);
		expect(can(admin, 'users-manage')).toBe(false);
		expect(heldPermissions(admin)).toEqual(['cms', 'stats']);
		// A legacy admin with no grant list holds nothing: fail closed.
		expect(can({ isAdmin: true }, 'cms')).toBe(false);
		expect(can({ isAdmin: true, permissions: null }, 'cms')).toBe(false);
	});

	it('a plain user holds nothing even with stale grant rows', () => {
		expect(can({ role: 'user', permissions: ['cms'] }, 'cms')).toBe(false);
		expect(can(null, 'cms')).toBe(false);
		expect(can(undefined, 'cms')).toBe(false);
	});

	it('canEditPermissions: only owner/superadmin, only for an admin target', () => {
		expect(canEditPermissions('owner', 'admin')).toEqual({ ok: true });
		expect(canEditPermissions('superadmin', 'admin')).toEqual({ ok: true });
		expect(canEditPermissions('admin', 'admin').reason).toMatch(/only the owner or a superadmin/i);
		expect(canEditPermissions('user', 'admin').ok).toBe(false);
		expect(canEditPermissions('owner', 'superadmin').reason).toMatch(/cannot be taken away/i);
		expect(canEditPermissions('owner', 'owner').ok).toBe(false);
		expect(canEditPermissions('owner', 'user').reason).toMatch(/make them an admin first/i);
	});

	it('requirePermission: 401 anonymous, 403 without the grant, returns the user otherwise', () => {
		expect(() => requirePermission({} as App.Locals, 'cms')).toThrowError(
			expect.objectContaining({ status: 401 })
		);
		const admin = { id: 'a', isAdmin: true, role: 'admin', permissions: ['cms'] };
		expect(requirePermission({ user: admin } as unknown as App.Locals, 'cms')).toBe(admin);
		expect(() => requirePermission({ user: admin } as unknown as App.Locals, 'pii')).toThrowError(
			expect.objectContaining({ status: 403 })
		);
	});
});
