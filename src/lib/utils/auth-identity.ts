export interface AuthIdentityRecord {
	id: string;
	email: string;
	name: string | null;
	github_login: string | null;
	github_avatar_url: string | null;
	is_admin: number;
}

interface D1PreparedStatementResult<T = unknown> {
	first?: () => Promise<T | null>;
	all?: () => Promise<{ results?: T[] }>;
}

interface D1PreparedStatement {
	bind<T = unknown>(...values: unknown[]): D1PreparedStatementResult<T>;
}

interface D1DatabaseLike {
	prepare(query: string): D1PreparedStatement;
}

export async function findUserByEmailOrAlias(
	db: D1DatabaseLike,
	email: string | null | undefined
): Promise<AuthIdentityRecord | null> {
	const normalizedEmail = email?.trim().toLowerCase();
	if (!normalizedEmail) {
		return null;
	}

	try {
		const result = await db
			.prepare(
				`SELECT id, email, name, github_login, github_avatar_url, is_admin
				 FROM users
				 WHERE lower(email) = lower(?)
				 UNION
				 SELECT u.id, u.email, u.name, u.github_login, u.github_avatar_url, u.is_admin
				 FROM users u
				 INNER JOIN user_login_aliases ula ON ula.user_id = u.id
				 WHERE lower(ula.email) = lower(?)
				 LIMIT 2`
			)
			.bind<AuthIdentityRecord>(normalizedEmail, normalizedEmail)
			.all?.();

		const matches = result?.results || [];
		return matches.length === 1 ? matches[0] : null;
	} catch {
		return null;
	}
}

export async function resolveOwnerStatus(
	platform: App.Platform | undefined,
	user: Pick<AuthIdentityRecord, 'id' | 'github_login'>
): Promise<boolean> {
	let ownerId = platform?.env?.GITHUB_OWNER_ID;
	let ownerUsername: string | null = null;

	if (ownerId && Number.isNaN(Number.parseInt(ownerId, 10))) {
		ownerUsername = ownerId;
		ownerId = undefined;
	}

	if (platform?.env?.KV) {
		try {
			if (!ownerId) {
				ownerId = (await platform.env.KV.get('github_owner_id')) || undefined;
			}
			if (!ownerUsername) {
				ownerUsername = await platform.env.KV.get('github_owner_username');
			}
		} catch {
			// Ignore owner lookup failures.
		}
	}

	if (ownerUsername && user.github_login?.toLowerCase() === ownerUsername.toLowerCase()) {
		return true;
	}

	if (!ownerId || !platform?.env?.DB) {
		return false;
	}

	if (user.id === ownerId) {
		return true;
	}

	try {
		const githubLink = await platform.env.DB.prepare(
			'SELECT provider_account_id FROM oauth_accounts WHERE user_id = ? AND provider = ?'
		)
			.bind(user.id, 'github')
			.first<{ provider_account_id: string }>();

		return githubLink?.provider_account_id === ownerId;
	} catch {
		return false;
	}
}
