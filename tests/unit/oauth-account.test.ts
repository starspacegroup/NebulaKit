import { webcrypto } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/services/account-merge', () => ({ mergeAccounts: vi.fn() }));
vi.mock('$lib/utils/auth-identity', () => ({ findUserByEmailOrAlias: vi.fn() }));

import { mergeAccounts } from '$lib/services/account-merge';
import { findUserByEmailOrAlias } from '$lib/utils/auth-identity';
import { reconcileOAuthAccount } from '../../src/lib/server/oauth-account';

describe('OAuth account reconciliation', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubGlobal('crypto', webcrypto as Crypto);
	});

	it('returns an existing canonical account without mutating it', async () => {
		const db = database({
			linkedAccount: { user_id: 'canonical-user' },
			users: ['canonical-user']
		});
		const createUser = vi.fn();
		const updateUser = vi.fn();

		await expect(
			reconcileOAuthAccount({
				db: db as never,
				provider: 'github',
				providerAccountId: 'provider-1',
				legacyUserId: 'provider-1',
				email: 'user@example.com',
				createUser,
				updateUser
			})
		).resolves.toEqual({ userId: 'canonical-user' });
		expect(createUser).not.toHaveBeenCalled();
		expect(updateUser).not.toHaveBeenCalled();
	});

	it('merges an already-linked account into the authenticated linking user', async () => {
		const db = database({ linkedAccount: { user_id: 'old-user' } });
		const updateUser = vi.fn();

		await expect(
			reconcileOAuthAccount({
				db: db as never,
				provider: 'discord',
				providerAccountId: 'provider-2',
				legacyUserId: 'discord_provider-2',
				email: 'user@example.com',
				linkingUserId: 'current-user',
				createUser: vi.fn(),
				updateUser
			})
		).resolves.toEqual({ userId: 'current-user', linkedProvider: 'discord' });
		expect(mergeAccounts).toHaveBeenCalledWith(db, 'old-user', 'current-user');
		expect(updateUser).toHaveBeenCalledWith('current-user', 'link');
	});

	it('attaches a provider to an email-matched account', async () => {
		vi.mocked(findUserByEmailOrAlias).mockResolvedValueOnce({ id: 'email-user' } as never);
		const db = database({ users: [] });
		const updateUser = vi.fn();

		await expect(
			reconcileOAuthAccount({
				db: db as never,
				provider: 'github',
				providerAccountId: 'provider-3',
				legacyUserId: 'provider-3',
				email: 'same@example.com',
				createUser: vi.fn(),
				updateUser
			})
		).resolves.toEqual({ userId: 'email-user' });
		expect(updateUser).toHaveBeenCalledWith('email-user', 'email');
		expect(db.oauthInsert).toHaveBeenCalled();
	});
});

function database(options: { linkedAccount?: { user_id: string } | null; users?: string[] }) {
	const oauthInsert = vi.fn().mockResolvedValue({ success: true });
	return {
		oauthInsert,
		prepare: vi.fn((sql: string) => ({
			bind: vi.fn((...values: unknown[]) => ({
				first: vi.fn(async () => {
					if (sql.includes('provider_account_id')) return options.linkedAccount ?? null;
					if (sql === 'SELECT id FROM users WHERE id = ?') {
						return options.users?.includes(String(values[0])) ? { id: values[0] } : null;
					}
					if (sql.includes('WHERE user_id = ? AND provider = ?')) return null;
					return null;
				}),
				run: sql.includes('INSERT INTO oauth_accounts')
					? oauthInsert
					: vi.fn().mockResolvedValue({ success: true })
			}))
		}))
	};
}
