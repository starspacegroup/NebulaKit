/**
 * Account Merge Service
 *
 * Handles merging two user accounts together when a social account
 * that's already linked to one user is connected to another user.
 * Instead of showing an error, we seamlessly merge the accounts.
 */

interface D1Database {
	prepare(query: string): D1PreparedStatement;
	batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

interface D1PreparedStatement {
	bind(...values: unknown[]): D1PreparedStatement;
	first<T = unknown>(): Promise<T | null>;
	run(): Promise<D1Result>;
	all<T = unknown>(): Promise<D1Result<T>>;
}

interface D1Result<T = unknown> {
	success: boolean;
	results?: T[];
	error?: string;
}

/**
 * Merges the source user's data into the target user, then deletes the source user.
 *
 * This function:
 * 1. Checks if the source user is an admin (to preserve admin status)
 * 2. Transfers all oauth_accounts from source to target
 * 3. Transfers all chat_messages from source to target
 * 4. Transfers all sessions from source to target
 * 5. Updates target user's admin status if source was admin
 * 6. Deletes the source user
 *
 * @param db - The D1 database instance
 * @param sourceUserId - The user ID being merged FROM (will be deleted)
 * @param targetUserId - The user ID being merged INTO (will remain)
 */
export async function mergeAccounts(
	db: D1Database,
	sourceUserId: string,
	targetUserId: string
): Promise<void> {
	console.log(`[Account Merge] Merging user ${sourceUserId} into ${targetUserId}`);

	const sourceUser = await db
		.prepare('SELECT id, email, name, password_hash, is_admin FROM users WHERE id = ?')
		.bind(sourceUserId)
		.first<{
			id: string;
			email: string;
			name: string | null;
			password_hash: string | null;
			is_admin: number;
		}>();

	const targetUser = await db
		.prepare('SELECT password_hash, name, email FROM users WHERE id = ?')
		.bind(targetUserId)
		.first<{ password_hash: string | null; name: string | null; email: string }>();

	if (!sourceUser || !targetUser) {
		throw new Error('Source or target user not found');
	}

	const sourceIsAdmin = sourceUser?.is_admin === 1;

	// Prepare batch statements for atomic transfer of all data
	const statements: D1PreparedStatement[] = [];

	// Transfer oauth_accounts (except for ones that would cause duplicates)
	// We update user_id where it won't conflict with existing links
	statements.push(
		db
			.prepare('UPDATE oauth_accounts SET user_id = ? WHERE user_id = ?')
			.bind(targetUserId, sourceUserId)
	);

	// Transfer chat_messages
	statements.push(
		db
			.prepare('UPDATE chat_messages SET user_id = ? WHERE user_id = ?')
			.bind(targetUserId, sourceUserId)
	);

	// Transfer sessions
	statements.push(
		db.prepare('UPDATE sessions SET user_id = ? WHERE user_id = ?').bind(targetUserId, sourceUserId)
	);

	// Transfer existing aliases to the target account.
	statements.push(
		db
			.prepare('UPDATE user_login_aliases SET user_id = ? WHERE user_id = ?')
			.bind(targetUserId, sourceUserId)
	);

	// Preserve the source primary email as an additional login alias on the target account.
	if (sourceUser.email !== targetUser.email) {
		statements.push(
			db
				.prepare(
					'INSERT OR IGNORE INTO user_login_aliases (id, user_id, email, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)'
				)
				.bind(crypto.randomUUID(), targetUserId, sourceUser.email)
		);
	}

	if (sourceUser.password_hash && !targetUser.password_hash) {
		statements.push(
			db
				.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
				.bind(sourceUser.password_hash, targetUserId)
		);
	}

	if (sourceUser.name && !targetUser.name) {
		statements.push(
			db
				.prepare('UPDATE users SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
				.bind(sourceUser.name, targetUserId)
		);
	}

	// If source user was admin, make target user admin too
	if (sourceIsAdmin) {
		statements.push(db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').bind(targetUserId));
	}

	// Delete the source user (CASCADE will clean up any remaining references)
	statements.push(db.prepare('DELETE FROM users WHERE id = ?').bind(sourceUserId));

	// Execute all statements in a batch for atomicity
	await db.batch(statements);

	console.log(`[Account Merge] Successfully merged user ${sourceUserId} into ${targetUserId}`);
}
