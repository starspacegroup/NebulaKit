export interface OAuthAccountConnection {
	provider: string;
	provider_account_id: string;
	created_at: string;
}

interface D1PreparedStatementResult<T = unknown> {
	first?: () => Promise<T | null>;
	all?: () => Promise<{ results?: T[] }>;
	run?: () => Promise<unknown>;
}

interface D1PreparedStatement {
	bind<T = unknown>(...values: unknown[]): D1PreparedStatementResult<T>;
}

interface D1DatabaseLike {
	prepare(query: string): D1PreparedStatement;
}

export interface UserAuthState {
	connectedAccounts: OAuthAccountConnection[];
	hasPassword: boolean;
	loginEmails: string[];
}

export async function getUserAuthState(
	db: D1DatabaseLike,
	userId: string,
	primaryEmail: string
): Promise<UserAuthState> {
	let hasPassword = false;
	let connectedAccounts: OAuthAccountConnection[] = [];
	let aliases: string[] = [];

	try {
		const passwordResult = await db
			.prepare('SELECT password_hash FROM users WHERE id = ?')
			.bind(userId)
			.first?.();

		hasPassword = Boolean(
			(passwordResult as { password_hash?: string | null } | null)?.password_hash
		);
	} catch {
		hasPassword = false;
	}

	try {
		const accountsResult = await db
			.prepare(
				'SELECT provider, provider_account_id, created_at FROM oauth_accounts WHERE user_id = ?'
			)
			.bind<OAuthAccountConnection>(userId)
			.all?.();

		connectedAccounts = accountsResult?.results || [];
	} catch {
		connectedAccounts = [];
	}

	try {
		const aliasResults = await db
			.prepare('SELECT email FROM user_login_aliases WHERE user_id = ? ORDER BY created_at ASC')
			.bind(userId)
			.all?.();

		aliases = (aliasResults?.results || []).map((entry) => (entry as { email: string }).email);
	} catch {
		aliases = [];
	}

	const loginEmails = [primaryEmail, ...aliases.filter((email) => email !== primaryEmail)];

	return {
		connectedAccounts,
		hasPassword,
		loginEmails
	};
}
