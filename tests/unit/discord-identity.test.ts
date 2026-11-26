import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
	discordAvatarUrl,
	discordDisplayName,
	discordEmailPolicy,
	isPlaceholderEmail
} from '../../src/lib/utils/discord-identity';

const anything = fc.anything();
const snowflake = fc.bigInt({ min: 10000n, max: 9_999_999_999_999_999_999n }).map(String);
const hash = fc
	.array(fc.constantFrom(...'0123456789abcdef'.split('')), { minLength: 16, maxLength: 40 })
	.map((a) => a.join(''));

describe('discordAvatarUrl', () => {
	it('is null or a discordapp CDN URL, whatever it is given', () => {
		fc.assert(
			fc.property(anything, anything, (id, avatar) => {
				const url = discordAvatarUrl({ id, avatar });
				expect(url === null || url.startsWith('https://cdn.discordapp.com/')).toBe(true);
			})
		);
	});
	it('uses the avatar hash when it looks like one', () => {
		fc.assert(
			fc.property(snowflake, hash, (id, h) => {
				expect(discordAvatarUrl({ id, avatar: h })).toBe(
					`https://cdn.discordapp.com/avatars/${id}/${h}.png?size=128`
				);
			})
		);
	});
	it('falls back to one of the six defaults, and never to a hash that does not look right', () => {
		fc.assert(
			fc.property(snowflake, fc.string(), (id, junk) => {
				fc.pre(!/^(a_)?[0-9a-f]{16,40}$/.test(junk));
				expect(discordAvatarUrl({ id, avatar: junk })).toMatch(/embed\/avatars\/[0-5]\.png$/);
			})
		);
	});
	it('returns null without a usable id', () => {
		expect(discordAvatarUrl({})).toBeNull();
		expect(discordAvatarUrl({ id: '../x', avatar: 'abcdef0123456789' })).toBeNull();
	});
});

describe('discordDisplayName', () => {
	it('prefers the display name, then the username, and is never empty', () => {
		expect(discordDisplayName({ global_name: ' Ada ', username: 'ada1' })).toBe('Ada');
		expect(discordDisplayName({ global_name: null, username: 'ada1' })).toBe('ada1');
		fc.assert(
			fc.property(
				anything,
				anything,
				(g, u) => discordDisplayName({ global_name: g, username: u }).length > 0
			)
		);
	});
});

describe('discordEmailPolicy', () => {
	it('never matches or marks an address Discord has not verified', () => {
		fc.assert(
			fc.property(
				fc.emailAddress(),
				fc.constantFrom(false, undefined, null, 'true', 1),
				(email, verified) => {
					const p = discordEmailPolicy({ id: '12345678', username: 'u', email, verified });
					expect(p.matchEmail).toBeNull();
					expect(p.replacementEmail).toBeNull();
					expect(p.verified).toBe(false);
				}
			)
		);
	});
	it('offers a verified address, lower-cased, for matching and for replacing a placeholder', () => {
		fc.assert(
			fc.property(fc.emailAddress(), (email) => {
				fc.pre(!isPlaceholderEmail(email));
				const p = discordEmailPolicy({ id: '12345678', username: 'u', email, verified: true });
				expect(p.matchEmail).toBe(email.trim().toLowerCase());
				expect(p.replacementEmail).toBe(p.matchEmail);
				expect(p.verified).toBe(true);
			})
		);
	});
	it('never treats a placeholder address as verified, even when Discord says verified', () => {
		const p = discordEmailPolicy({
			id: '1',
			username: 'u',
			email: 'x@discord.local',
			verified: true
		});
		expect(p.verified).toBe(false);
		expect(p.matchEmail).toBeNull();
	});
	it('gives a new account a placeholder when Discord sent no address', () => {
		expect(discordEmailPolicy({ id: '12345678', username: 'ada' }).newAccountEmail).toBe(
			'ada@discord.local'
		);
		expect(isPlaceholderEmail('ada@discord.local')).toBe(true);
		expect(isPlaceholderEmail('ada@example.com')).toBe(false);
	});
});
