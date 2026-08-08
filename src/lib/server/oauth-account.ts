import { mergeAccounts } from '$lib/services/account-merge';
import { findUserByEmailOrAlias } from '$lib/utils/auth-identity';
import type { OAuthProvider } from '$lib/utils/oauth-state';
import type { D1Database } from '@cloudflare/workers-types';

interface ReconcileOAuthAccountOptions {
	db: D1Database;
	provider: OAuthProvider;
	providerAccountId: string;
	legacyUserId: string;
	email?: string | null;
	linkingUserId?: string;
	createUser(userId: string): Promise<void>;
	updateUser(userId: string, match: 'link' | 'email' | 'legacy'): Promise<void>;
}

interface ReconciledOAuthAccount {
	userId: string;
	linkedProvider?: OAuthProvider;
}

async function findLinkedUserId(
	db: D1Database,
	provider: OAuthProvider,
	providerAccountId: string
): Promise<string | null> {
	const account = await db
		.prepare('SELECT user_id FROM oauth_accounts WHERE provider = ? AND provider_account_id = ?')
		.bind(provider, providerAccountId)
		.first<{ user_id: string }>();
	return account?.user_id ?? null;
}

async function ensureOAuthAccount(
	db: D1Database,
	userId: string,
	provider: OAuthProvider,
	providerAccountId: string
): Promise<void> {
	const existing = await db
		.prepare('SELECT id FROM oauth_accounts WHERE user_id = ? AND provider = ?')
		.bind(userId, provider)
		.first<{ id: string }>();
	if (existing) return;

	await db
		.prepare(
			`INSERT INTO oauth_accounts (id, user_id, provider, provider_account_id, created_at)
			 VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`
		)
		.bind(crypto.randomUUID(), userId, provider, providerAccountId)
		.run();
}

export async function reconcileOAuthAccount({
	db,
	provider,
	providerAccountId,
	legacyUserId,
	email,
	linkingUserId,
	createUser,
	updateUser
}: ReconcileOAuthAccountOptions): Promise<ReconciledOAuthAccount> {
	const linkedUserId = await findLinkedUserId(db, provider, providerAccountId);

	if (linkingUserId) {
		if (linkedUserId && linkedUserId !== linkingUserId) {
			await mergeAccounts(db, linkedUserId, linkingUserId);
		} else if (!linkedUserId) {
			await ensureOAuthAccount(db, linkingUserId, provider, providerAccountId);
		}
		await updateUser(linkingUserId, 'link');
		return { userId: linkingUserId, linkedProvider: provider };
	}

	if (linkedUserId) {
		const linkedUser = await db
			.prepare('SELECT id FROM users WHERE id = ?')
			.bind(linkedUserId)
			.first<{ id: string }>();
		if (linkedUser) return { userId: linkedUser.id };
	}

	const [matchedUser, legacyUser] = await Promise.all([
		findUserByEmailOrAlias(db, email),
		db.prepare('SELECT id FROM users WHERE id = ?').bind(legacyUserId).first<{ id: string }>()
	]);

	if (matchedUser) {
		if (legacyUser && legacyUser.id !== matchedUser.id) {
			await mergeAccounts(db, legacyUser.id, matchedUser.id);
		}
		await ensureOAuthAccount(db, matchedUser.id, provider, providerAccountId);
		await updateUser(matchedUser.id, 'email');
		return { userId: matchedUser.id };
	}

	if (legacyUser) {
		await ensureOAuthAccount(db, legacyUser.id, provider, providerAccountId);
		await updateUser(legacyUser.id, 'legacy');
		return { userId: legacyUser.id };
	}

	await createUser(legacyUserId);
	await ensureOAuthAccount(db, legacyUserId, provider, providerAccountId);
	return { userId: legacyUserId };
}
