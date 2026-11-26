import type { D1Database } from '@cloudflare/workers-types';
import {
	discordAvatarUrl,
	discordEmailPolicy,
	type DiscordUser
} from '$lib/utils/discord-identity';

/**
 * Bring an account up to date with what Discord just said, on every Discord sign-in. Each step is
 * independent and fails soft: a missing picture, or a column that has not been migrated yet, must
 * never stop someone signing in.
 */
export async function applyDiscordProfile(
	db: D1Database,
	userId: string,
	discordUser: DiscordUser
): Promise<void> {
	const policy = discordEmailPolicy(discordUser);

	// A placeholder address is swapped for the real one, only a verified one, and only over a
	// placeholder: never over an address the person chose.
	if (policy.replacementEmail) {
		try {
			await db
				.prepare("UPDATE users SET email = ? WHERE id = ? AND email LIKE '%@discord.local'")
				.bind(policy.replacementEmail, userId)
				.run();
		} catch {
			// Another account already uses that address; keep the placeholder.
		}
		// Discord's confirmation counts only for the address the account actually holds.
		try {
			await db
				.prepare(
					`UPDATE users SET email_verified_at = COALESCE(email_verified_at, datetime('now'))
					 WHERE id = ? AND lower(email) = ?`
				)
				.bind(userId, policy.replacementEmail)
				.run();
		} catch {
			// The column arrives with migration 0031.
		}
	}

	const avatar = discordAvatarUrl(discordUser);
	if (avatar) {
		try {
			await db
				.prepare('UPDATE users SET github_avatar_url = ? WHERE id = ?')
				.bind(avatar, userId)
				.run();
		} catch {
			// A missing picture must never stop someone signing in.
		}
	}
}
