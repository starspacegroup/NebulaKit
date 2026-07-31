import { describe, expect, it } from 'vitest';
import {
	canViewStats,
	canManageStatsConnection,
	assertCanViewStats
} from '../../src/lib/server/stats-guard';

describe('canViewStats', () => {
	it('is false for null/undefined and plain users', () => {
		expect(canViewStats(null)).toBe(false);
		expect(canViewStats(undefined)).toBe(false);
		expect(canViewStats({})).toBe(false);
		expect(canViewStats({ isAdmin: true })).toBe(false); // admin alone is not enough
	});

	it('is true for owner, superadmin, or a granted admin', () => {
		expect(canViewStats({ isOwner: true })).toBe(true);
		expect(canViewStats({ isSuperAdmin: true })).toBe(true);
		expect(canViewStats({ isAdmin: true, canViewStats: true })).toBe(true);
	});
});

describe('canManageStatsConnection', () => {
	it('is limited to owner/superadmin', () => {
		expect(canManageStatsConnection(null)).toBe(false);
		expect(canManageStatsConnection({ isAdmin: true, canViewStats: true })).toBe(false);
		expect(canManageStatsConnection({ isOwner: true })).toBe(true);
		expect(canManageStatsConnection({ isSuperAdmin: true })).toBe(true);
	});
});

describe('assertCanViewStats', () => {
	it('throws 403 when not permitted', () => {
		expect(() => assertCanViewStats({ isAdmin: true })).toThrow();
		try {
			assertCanViewStats(null);
		} catch (e) {
			expect((e as { status?: number }).status).toBe(403);
		}
	});

	it('does not throw for a permitted user', () => {
		expect(() => assertCanViewStats({ isSuperAdmin: true })).not.toThrow();
		expect(() => assertCanViewStats({ canViewStats: true })).not.toThrow();
	});
});
