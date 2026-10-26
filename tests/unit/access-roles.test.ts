import { describe, expect, it } from 'vitest';
import {
	ASSIGNABLE_ROLES,
	assignableBy,
	canActOn,
	canAssignRole,
	canDeleteUser,
	canGrant,
	effectiveRole,
	isAssignableRole,
	rank,
	storedRole,
	type Role
} from '../../src/lib/access/roles';

const LADDER: Role[] = ['user', 'admin', 'superadmin', 'owner'];

describe('role ladder', () => {
	it('ranks owner > superadmin > admin > user', () => {
		expect(LADDER.map(rank)).toEqual([0, 1, 2, 3]);
	});

	it('canActOn is strictly above, for every pair', () => {
		for (const actor of LADDER) {
			for (const target of LADDER) {
				expect(canActOn(actor, target)).toBe(rank(actor) > rank(target));
			}
		}
		// Never on an equal: nobody can act on themselves or a peer.
		for (const role of LADDER) expect(canActOn(role, role)).toBe(false);
	});

	it('canGrant is strictly below, so nobody can mint their own rank', () => {
		for (const actor of LADDER) {
			for (const role of LADDER) {
				expect(canGrant(actor, role)).toBe(rank(actor) > rank(role));
			}
		}
		expect(canGrant('admin', 'admin')).toBe(false);
		expect(canGrant('superadmin', 'superadmin')).toBe(false);
		expect(canGrant('owner', 'owner')).toBe(false);
	});

	it('the owner is never an assignable role', () => {
		expect(ASSIGNABLE_ROLES).not.toContain('owner');
		expect(isAssignableRole('owner')).toBe(false);
		expect(isAssignableRole('superadmin')).toBe(true);
		expect(isAssignableRole(undefined)).toBe(false);
		expect(storedRole('owner')).toBe('user');
		expect(storedRole('nonsense')).toBe('user');
		expect(storedRole('admin')).toBe('admin');
	});

	it('nobody can assign or demote the owner, even the owner', () => {
		for (const actor of LADDER) {
			for (const next of ASSIGNABLE_ROLES) {
				expect(canAssignRole(actor, 'owner', next).ok).toBe(false);
			}
			expect(canDeleteUser(actor, 'owner').ok).toBe(false);
		}
		expect(canAssignRole('superadmin', 'owner', 'user').reason).toMatch(/owner cannot be changed/i);
		expect(canDeleteUser('superadmin', 'owner').reason).toMatch(/owner cannot be removed/i);
	});

	it('canAssignRole needs both: outrank the person AND the new role', () => {
		expect(canAssignRole('owner', 'admin', 'superadmin')).toEqual({ ok: true });
		expect(canAssignRole('superadmin', 'admin', 'user')).toEqual({ ok: true });
		// Outranks the person, not the role being handed out.
		const mint = canAssignRole('superadmin', 'admin', 'superadmin');
		expect(mint.ok).toBe(false);
		expect(mint.reason).toMatch(/at or above your own/i);
		expect(canAssignRole('admin', 'user', 'admin').ok).toBe(false);
		// Does not outrank the person.
		expect(canAssignRole('admin', 'admin', 'user').reason).toMatch(/below your own/i);
		expect(canAssignRole('superadmin', 'superadmin', 'user').ok).toBe(false);
		expect(canAssignRole('user', 'user', 'user').ok).toBe(false);
	});

	it('canDeleteUser follows the same rank rule', () => {
		expect(canDeleteUser('owner', 'superadmin').ok).toBe(true);
		expect(canDeleteUser('superadmin', 'admin').ok).toBe(true);
		expect(canDeleteUser('admin', 'user').ok).toBe(true);
		expect(canDeleteUser('admin', 'admin')).toMatchObject({ ok: false });
		expect(canDeleteUser('admin', 'admin').reason).toMatch(/below your own/i);
		expect(canDeleteUser('user', 'user').ok).toBe(false);
	});

	it('assignableBy lists only roles strictly below the actor', () => {
		expect(assignableBy('owner')).toEqual(['user', 'admin', 'superadmin']);
		expect(assignableBy('superadmin')).toEqual(['user', 'admin']);
		expect(assignableBy('admin')).toEqual(['user']);
		expect(assignableBy('user')).toEqual([]);
	});

	describe('effectiveRole', () => {
		it('owner wins over whatever the row says', () => {
			expect(effectiveRole({ isOwner: true })).toBe('owner');
			expect(effectiveRole({ isOwner: true, role: 'user', isAdmin: false })).toBe('owner');
		});
		it('reads the stored role, defensively', () => {
			expect(effectiveRole({ role: 'superadmin' })).toBe('superadmin');
			expect(effectiveRole({ role: 'admin' })).toBe('admin');
			expect(effectiveRole({ role: 'wizard' })).toBe('user');
			expect(effectiveRole({ role: null })).toBe('user');
		});
		it('keeps legacy flags working: isAdmin alone is an admin, isSuperAdmin a superadmin', () => {
			expect(effectiveRole({ isAdmin: true })).toBe('admin');
			expect(effectiveRole({ isSuperAdmin: true })).toBe('superadmin');
			expect(effectiveRole({})).toBe('user');
		});
		it('treats no subject as the least power', () => {
			expect(effectiveRole(null)).toBe('user');
			expect(effectiveRole(undefined)).toBe('user');
		});
	});
});
