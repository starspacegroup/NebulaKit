import { describe, expect, it } from 'vitest';
import {
	SecretBoxError,
	createSecretBox,
	fromBase64Url,
	generateEncryptionKey,
	isSecretEnvelope,
	parseEncryptionKey,
	secretHint,
	toBase64Url
} from '../../src/lib/server/secret-box';

const KEY_A = generateEncryptionKey();
const KEY_B = generateEncryptionKey();

describe('secret-box keys', () => {
	it('generates 32-byte base64 keys that differ each time', () => {
		expect(parseEncryptionKey(KEY_A)).toHaveLength(32);
		expect(KEY_A).not.toBe(KEY_B);
	});

	it('accepts base64url and surrounding whitespace', () => {
		const url = KEY_A.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
		expect(parseEncryptionKey(` ${url}\n`)).toEqual(parseEncryptionKey(KEY_A));
	});

	it('rejects keys of the wrong length with a helpful message', () => {
		expect(() => parseEncryptionKey(btoa('too short'))).toThrow(/32 bytes/);
		expect(() => createSecretBox('')).toThrow(SecretBoxError);
	});

	it('rejects text that is not base64', () => {
		expect(() => parseEncryptionKey('%%%not base64%%%')).toThrow(/valid base64/);
	});

	it('round-trips arbitrary bytes through base64url', () => {
		const bytes = Uint8Array.from([0, 250, 251, 252, 253, 254, 255, 62, 63]);
		expect(fromBase64Url(toBase64Url(bytes))).toEqual(bytes);
		expect(toBase64Url(bytes)).not.toMatch(/[+/=]/);
		const big = new Uint8Array(70_000).fill(7);
		expect(fromBase64Url(toBase64Url(big))).toEqual(big);
	});
});

describe('secret-box seal/open', () => {
	it('round-trips, including unicode and empty strings', async () => {
		const box = createSecretBox(KEY_A);
		for (const text of ['sk-live-abc123', '', 'pässwörd 🔑 日本語', 'x'.repeat(10_000)]) {
			const envelope = await box.seal(text, 'ai-key', 'rec-1');
			const opened = await box.open(envelope, 'ai-key', 'rec-1');
			expect(opened).toEqual({ plaintext: text, rotated: false });
		}
	});

	it('produces a versioned envelope that never contains the plaintext', async () => {
		const envelope = await createSecretBox(KEY_A).seal('sk-super-secret', 'ai-key', 'r');
		expect(isSecretEnvelope(envelope)).toBe(true);
		expect(envelope.startsWith('v1.')).toBe(true);
		expect(envelope.split('.')).toHaveLength(3);
		expect(envelope).not.toContain('sk-super-secret');
	});

	it('uses a fresh IV every time', async () => {
		const box = createSecretBox(KEY_A);
		const [one, two] = [await box.seal('same', 'p', 'r'), await box.seal('same', 'p', 'r')];
		expect(one).not.toBe(two);
	});

	it('detects tampering with the ciphertext, the IV, or the tag', async () => {
		const box = createSecretBox(KEY_A);
		const [v, iv, ct] = (await box.seal('sk-secret-value', 'ai-key', 'r')).split('.');
		const flip = (s: string, at: number) =>
			s.slice(0, at) + (s[at] === 'A' ? 'B' : 'A') + s.slice(at + 1);

		for (const forged of [
			`${v}.${iv}.${flip(ct, 0)}`,
			`${v}.${iv}.${flip(ct, ct.length - 3)}`,
			`${v}.${flip(iv, 2)}.${ct}`,
			`${v}.${iv}.${ct.slice(0, -4)}AAAA`
		]) {
			await expect(box.open(forged, 'ai-key', 'r')).rejects.toMatchObject({
				code: 'decrypt-failed'
			});
		}
	});

	it('rejects a ciphertext moved to another record (AAD binding)', async () => {
		const box = createSecretBox(KEY_A);
		const envelope = await box.seal('sk-for-record-one', 'ai-key', 'record-1');
		await expect(box.open(envelope, 'ai-key', 'record-2')).rejects.toMatchObject({
			code: 'decrypt-failed'
		});
	});

	it('rejects a ciphertext moved to another purpose (subkey separation)', async () => {
		const box = createSecretBox(KEY_A);
		const envelope = await box.seal('shared-looking', 'ai-key', 'github');
		await expect(box.open(envelope, 'auth-config', 'github')).rejects.toMatchObject({
			code: 'decrypt-failed'
		});
	});

	it('does not confuse purpose and record id that concatenate alike', async () => {
		const box = createSecretBox(KEY_A);
		const envelope = await box.seal('x', 'a', 'b:c');
		await expect(box.open(envelope, 'a:b', 'c')).rejects.toThrow();
	});

	it('fails with the wrong key', async () => {
		const envelope = await createSecretBox(KEY_A).seal('secret', 'p', 'r');
		await expect(createSecretBox(KEY_B).open(envelope, 'p', 'r')).rejects.toMatchObject({
			code: 'decrypt-failed'
		});
	});

	it('refuses things that are not envelopes', async () => {
		const box = createSecretBox(KEY_A);
		for (const bad of ['sk-plain', 'v2.abc.def', 'v1.short.x', '', 'v1..']) {
			await expect(box.open(bad, 'p', 'r')).rejects.toMatchObject({ code: 'bad-envelope' });
		}
		expect(isSecretEnvelope(42)).toBe(false);
		expect(isSecretEnvelope('sk-proj-abc_DEF-123')).toBe(false);
	});
});

describe('secret-box rotation', () => {
	it('opens with a previous key and flags it for re-sealing', async () => {
		const old = await createSecretBox(KEY_A).seal('rotate-me', 'ai-key', 'r');
		const rotated = createSecretBox(KEY_B, [KEY_A]);

		const opened = await rotated.open(old, 'ai-key', 'r');
		expect(opened).toEqual({ plaintext: 'rotate-me', rotated: true });

		const resealed = await rotated.seal(opened.plaintext, 'ai-key', 'r');
		expect(await rotated.open(resealed, 'ai-key', 'r')).toEqual({
			plaintext: 'rotate-me',
			rotated: false
		});
		// Once retired, the old key alone no longer opens the new value.
		await expect(createSecretBox(KEY_A).open(resealed, 'ai-key', 'r')).rejects.toThrow();
	});

	it('seals only with the current key', async () => {
		const sealed = await createSecretBox(KEY_B, [KEY_A]).seal('v', 'p', 'r');
		expect((await createSecretBox(KEY_B).open(sealed, 'p', 'r')).plaintext).toBe('v');
	});

	it('fails once the previous key is dropped', async () => {
		const old = await createSecretBox(KEY_A).seal('v', 'p', 'r');
		await expect(createSecretBox(KEY_B).open(old, 'p', 'r')).rejects.toThrow(/any configured key/);
	});

	it('rejects a malformed previous key up front', () => {
		expect(() => createSecretBox(KEY_A, ['nope'])).toThrow(SecretBoxError);
	});
});

describe('secretHint', () => {
	it('shows the last four characters of long secrets only', () => {
		expect(secretHint('sk-proj-abcdefgh1234')).toBe('1234');
		expect(secretHint('short')).toBeNull();
		expect(secretHint('x'.repeat(11))).toBeNull();
		expect(secretHint('x'.repeat(12))).toBe('xxxx');
	});
});
