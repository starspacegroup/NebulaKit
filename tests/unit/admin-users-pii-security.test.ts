import { describe, expect, it, vi } from 'vitest';

const storedUser = {
	id: 'user-123456',
	email: 'person@example.com',
	name: 'Private Person',
	is_admin: 0,
	github_login: 'private-person',
	github_avatar_url: 'https://avatars.example/private.png',
	created_at: '2026-01-01',
	github_id: '987654321'
};

function platform() {
	return {
		env: {
			DB: {
				prepare: vi.fn(() => ({
					all: vi.fn().mockResolvedValue({ results: [storedUser] })
				}))
			}
		}
	};
}

function searchFetch() {
	return vi.fn().mockResolvedValue({
		ok: true,
		json: vi.fn().mockResolvedValue({
			items: [
				{
					login: storedUser.github_login,
					id: Number(storedUser.github_id),
					avatar_url: storedUser.github_avatar_url,
					html_url: `https://github.com/${storedUser.github_login}`
				}
			]
		})
	});
}

function invitePlatform() {
	return {
		env: {
			DB: {
				prepare: vi.fn(() => ({
					bind: vi.fn(() => ({ run: vi.fn().mockResolvedValue({ success: true }) }))
				}))
			}
		}
	};
}

describe('admin users API PII policy', () => {
	it.each([
		['anonymous callers', null, 401],
		['normal users', { id: 'user-1', isOwner: false, isAdmin: false }, 403]
	])('denies %s', async (_label, user, status) => {
		const { GET } = await import('../../src/routes/api/admin/users/+server');
		await expect(
			GET({
				platform: platform(),
				locals: { user },
				cookies: { get: vi.fn() }
			} as never)
		).rejects.toMatchObject({ status });
	});

	it('masks PII before returning users to a plain admin', async () => {
		const { GET } = await import('../../src/routes/api/admin/users/+server');
		const response = await GET({
			platform: platform(),
			locals: { user: { id: 'admin-1', isOwner: false, isAdmin: true } },
			cookies: { get: vi.fn(() => undefined) }
		} as never);
		const { users } = await response.json();

		expect(users[0]).toMatchObject({
			id: 'us*******56',
			email: 'p*****@example.com',
			name: 'P****** P*****',
			github_login: 'pr**********on',
			github_avatar_url: null,
			github_id: '98*****21'
		});
	});

	it('returns raw PII only when an owner has explicitly enabled reveal', async () => {
		const { GET } = await import('../../src/routes/api/admin/users/+server');
		const response = await GET({
			platform: platform(),
			locals: { user: { id: 'owner-1', isOwner: true, isAdmin: true } },
			cookies: { get: vi.fn(() => '1') }
		} as never);
		const { users } = await response.json();

		expect(users[0]).toEqual(storedUser);
	});

	it('keeps owners masked until they explicitly enable reveal', async () => {
		const { GET } = await import('../../src/routes/api/admin/users/+server');
		const response = await GET({
			platform: platform(),
			locals: { user: { id: 'owner-1', isOwner: true, isAdmin: true } },
			cookies: { get: vi.fn(() => undefined) }
		} as never);
		const { users } = await response.json();

		expect(users[0].email).toBe('p*****@example.com');
		expect(users[0].github_avatar_url).toBeNull();
	});

	it('masks GitHub search results for normal admins', async () => {
		const { GET } = await import('../../src/routes/api/admin/users/search/+server');
		const response = await GET({
			url: new URL('https://example.com/api/admin/users/search?q=private'),
			locals: { user: { id: 'admin-1', isOwner: false, isAdmin: true } },
			cookies: { get: vi.fn(() => '1') },
			fetch: searchFetch()
		} as never);
		const { users } = await response.json();

		expect(users[0]).toEqual({
			login: 'pr**********on',
			id: '98*****21',
			avatar_url: null,
			html_url: null
		});
	});

	it('reveals GitHub search results only for an opted-in owner', async () => {
		const { GET } = await import('../../src/routes/api/admin/users/search/+server');
		const response = await GET({
			url: new URL('https://example.com/api/admin/users/search?q=private'),
			locals: { user: { id: 'owner-1', isOwner: true, isAdmin: true } },
			cookies: { get: vi.fn(() => '1') },
			fetch: searchFetch()
		} as never);
		const { users } = await response.json();

		expect(users[0]).toEqual({
			login: storedUser.github_login,
			id: Number(storedUser.github_id),
			avatar_url: storedUser.github_avatar_url,
			html_url: `https://github.com/${storedUser.github_login}`
		});
	});

	it('masks invited-user PII in a normal admin response', async () => {
		const { POST } = await import('../../src/routes/api/admin/users/+server');
		const response = await POST({
			platform: invitePlatform(),
			locals: { user: { id: 'admin-1', isOwner: false, isAdmin: true } },
			cookies: { get: vi.fn(() => '1') },
			request: {
				json: vi.fn().mockResolvedValue({
					githubLogin: storedUser.github_login,
					email: storedUser.email
				})
			}
		} as never);
		const { user } = await response.json();

		expect(user.email).toBe('p*****@example.com');
		expect(user.github_login).toBe('pr**********on');
		expect(user.id).toContain('*');
	});

	it('returns invited-user PII to an opted-in owner', async () => {
		const { POST } = await import('../../src/routes/api/admin/users/+server');
		const response = await POST({
			platform: invitePlatform(),
			locals: { user: { id: 'owner-1', isOwner: true, isAdmin: true } },
			cookies: { get: vi.fn(() => '1') },
			request: {
				json: vi.fn().mockResolvedValue({
					githubLogin: storedUser.github_login,
					email: storedUser.email
				})
			}
		} as never);
		const { user } = await response.json();

		expect(user.email).toBe(storedUser.email);
		expect(user.github_login).toBe(storedUser.github_login);
		expect(user.id).not.toContain('*');
	});
});
