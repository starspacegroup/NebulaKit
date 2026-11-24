/**
 * What a Discord sign-in is allowed to say about an account. Pure, so every rule is testable and the
 * callback only has to apply the answer. These rules came from running Discord login on PinFool and
 * the other sites built on NebulaKit; every one of them exists because the simpler version went wrong.
 */

export interface DiscordUser {
	id?: unknown;
	username?: unknown;
	global_name?: unknown;
	avatar?: unknown;
	email?: unknown;
	verified?: unknown;
}

/** The stand-in address for an account Discord gave no email for. Never a real mailbox. */
export const DISCORD_PLACEHOLDER_DOMAIN = 'discord.local';

const SNOWFLAKE = /^\d{5,25}$/;
const AVATAR_HASH = /^(a_)?[0-9a-f]{16,40}$/;

function text(value: unknown): string | null {
	return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** True for an address that is only a placeholder, such as `someone@discord.local`. */
export function isPlaceholderEmail(email: string | null | undefined): boolean {
	return (
		typeof email === 'string' &&
		email.trim().toLowerCase().endsWith(`@${DISCORD_PLACEHOLDER_DOMAIN}`)
	);
}

/**
 * The picture for a Discord account: their own avatar when they set one, otherwise one of the six
 * defaults Discord picks from the id. Always an https://cdn.discordapp.com URL: an id or hash that
 * does not look like Discord's own is not trusted, so a hostile profile cannot point the header
 * image anywhere else. `users.github_avatar_url` is the column every avatar is read from (the name is
 * older than the Discord login).
 */
export function discordAvatarUrl(user: Pick<DiscordUser, 'id' | 'avatar'>): string | null {
	const id = typeof user.id === 'string' && SNOWFLAKE.test(user.id) ? user.id : null;
	if (!id) return null;
	if (typeof user.avatar === 'string' && AVATAR_HASH.test(user.avatar)) {
		return `https://cdn.discordapp.com/avatars/${id}/${user.avatar}.png?size=128`;
	}
	const index = Number((BigInt(id) >> 22n) % 6n);
	return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

/** The name to show: the display name, then the username, then a neutral fallback. */
export function discordDisplayName(user: DiscordUser): string {
	return text(user.global_name) ?? text(user.username) ?? 'Discord user';
}

export interface DiscordEmailPolicy {
	/**
	 * The address another account may be matched on. Only an address Discord has verified: Discord
	 * returns unverified ones too, and matching one would let anyone who registers a Discord account
	 * with a victim's email take that account over.
	 */
	matchEmail: string | null;
	/** The address to store on a new account: the real one if Discord sent one, else a placeholder. */
	newAccountEmail: string;
	/** Whether the address on this account is one Discord has confirmed. */
	verified: boolean;
	/** A verified address that may replace a `@discord.local` placeholder, never a chosen address. */
	replacementEmail: string | null;
}

/** One place that decides how much to trust the address Discord sent. */
export function discordEmailPolicy(user: DiscordUser): DiscordEmailPolicy {
	const email = text(user.email)?.toLowerCase() ?? null;
	const verified = user.verified === true && email !== null && !isPlaceholderEmail(email);
	const username = text(user.username) ?? text(user.id) ?? 'user';
	return {
		matchEmail: verified ? email : null,
		newAccountEmail: email ?? `${username}@${DISCORD_PLACEHOLDER_DOMAIN}`,
		verified,
		replacementEmail: verified ? email : null
	};
}
