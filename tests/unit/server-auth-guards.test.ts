import { describe, expect, it } from 'vitest';
import { requireAdmin, requireOwner, requireUser } from '../../src/lib/server/auth-guards';

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
