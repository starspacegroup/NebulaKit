import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	createSecretBox,
	generateEncryptionKey,
	SecretBoxError
} from '../../src/lib/server/secret-box';
import {
	AUTO_KEY_KV_KEY,
	aiKeySpec,
	authConfigSpec,
	ensureRecordSealed,
	getEncryptionStatus,
	getSecretBox,
	readRecordWithSecret,
	redactRecord,
	revealSecret,
	sealSecret
} from '../../src/lib/server/secret-store';
import { createFakeKV } from '../helpers/fake-kv';

const OP_KEY = generateEncryptionKey();
const OLD_KEY = generateEncryptionKey();

function platform(kv = createFakeKV(), env: Record<string, string> = {}) {
	return { env: { KV: kv, ...env } } as any;
}

afterEach(() => vi.restoreAllMocks());

describe('key resolution', () => {
	it('uses ENCRYPTION_KEY and never creates a KV key', async () => {
		const kv = createFakeKV();
		const p = platform(kv, { ENCRYPTION_KEY: OP_KEY });
		const envelope = await sealSecret(p, 'ai-key', 'a', 'sk-secret-value-1234');
		expect(kv.data.has(AUTO_KEY_KV_KEY)).toBe(false);
		expect((await createSecretBox(OP_KEY).open(envelope, 'ai-key', 'a')).plaintext).toBe(
			'sk-secret-value-1234'
		);
		expect(await getEncryptionStatus(p)).toEqual({ mode: 'operator', previousKeys: 0 });
	});

	it('without ENCRYPTION_KEY generates one KV-held key on first save and reuses it', async () => {
		const kv = createFakeKV();
		const p = platform(kv);
		expect(await getEncryptionStatus(p)).toEqual({ mode: 'none', previousKeys: 0 });

		const first = await sealSecret(p, 'ai-key', 'a', 'value-one-123456');
		const stored = kv.data.get(AUTO_KEY_KV_KEY)!;
		expect(Buffer.from(stored, 'base64')).toHaveLength(32);
		const second = await sealSecret(p, 'ai-key', 'b', 'value-two-123456');
		expect(kv.data.get(AUTO_KEY_KV_KEY)).toBe(stored);

		expect((await revealSecret(p, 'ai-key', 'a', first)).value).toBe('value-one-123456');
		expect((await revealSecret(p, 'ai-key', 'b', second)).value).toBe('value-two-123456');
		expect(await getEncryptionStatus(p)).toEqual({ mode: 'auto', previousKeys: 0 });
	});

	it('survives a KV that has not yet caught up with the key it just wrote', async () => {
		const kv = createFakeKV();
		const get = kv.get;
		kv.get = vi.fn(async (key: string) => (key === AUTO_KEY_KV_KEY ? null : get(key)));
		const envelope = await sealSecret(platform(kv), 'p', 'r', 'some-secret-value');
		const stored = kv.data.get(AUTO_KEY_KV_KEY)!;
		expect((await createSecretBox(stored).open(envelope, 'p', 'r')).plaintext).toBe(
			'some-secret-value'
		);
	});

	it('a read never mints a key', async () => {
		const kv = createFakeKV();
		expect(await getSecretBox(platform(kv), { create: false })).toBeNull();
		expect(kv.data.size).toBe(0);
	});

	it('refuses to seal when ENCRYPTION_KEY is malformed instead of falling back', async () => {
		const kv = createFakeKV();
		await expect(
			sealSecret(platform(kv, { ENCRYPTION_KEY: 'nope' }), 'p', 'r', 'x')
		).rejects.toBeInstanceOf(SecretBoxError);
		expect(kv.data.size).toBe(0);
	});

	it('refuses to seal with no platform or no KV and no operator key', async () => {
		await expect(sealSecret(undefined, 'p', 'r', 'x')).rejects.toThrow(/Platform/);
		await expect(sealSecret({ env: {} } as any, 'p', 'r', 'x')).rejects.toThrow(/KV/);
	});

	it('does not overwrite a corrupt auto key', async () => {
		const kv = createFakeKV({ [AUTO_KEY_KV_KEY]: 'garbage' });
		await expect(sealSecret(platform(kv), 'p', 'r', 'x')).rejects.toBeInstanceOf(SecretBoxError);
		expect(kv.data.get(AUTO_KEY_KV_KEY)).toBe('garbage');
	});

	it('ignores a corrupt auto key when an operator key is set', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const kv = createFakeKV({ [AUTO_KEY_KV_KEY]: 'garbage' });
		const p = platform(kv, { ENCRYPTION_KEY: OP_KEY });
		const envelope = await sealSecret(p, 'p', 'r', 'fine-value-123456');
		expect((await revealSecret(p, 'p', 'r', envelope)).value).toBe('fine-value-123456');
	});

	it('reports previous keys in status', async () => {
		const p = platform(createFakeKV(), {
			ENCRYPTION_KEY: OP_KEY,
			ENCRYPTION_KEY_PREVIOUS: `${OLD_KEY}, ${generateEncryptionKey()}`
		});
		expect(await getEncryptionStatus(p)).toEqual({ mode: 'operator', previousKeys: 2 });
		expect(await getEncryptionStatus(undefined)).toEqual({ mode: 'none', previousKeys: 0 });
	});
});

describe('revealSecret', () => {
	it('treats empty and non-string values as missing', async () => {
		const p = platform(createFakeKV(), { ENCRYPTION_KEY: OP_KEY });
		for (const value of [undefined, null, '', 42]) {
			expect(await revealSecret(p, 'p', 'r', value)).toEqual({
				value: null,
				status: 'missing',
				rewrite: false
			});
		}
	});

	it('returns legacy plaintext and asks for a rewrite, even with no key at all', async () => {
		expect(await revealSecret(platform(), 'p', 'r', 'sk-legacy-plaintext')).toEqual({
			value: 'sk-legacy-plaintext',
			status: 'legacy',
			rewrite: true
		});
	});

	it('reports undecryptable (and does not throw) when the key is gone', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const envelope = await createSecretBox(OLD_KEY).seal('lost', 'p', 'r');
		const gone = await revealSecret(
			platform(createFakeKV(), { ENCRYPTION_KEY: OP_KEY }),
			'p',
			'r',
			envelope
		);
		expect(gone).toEqual({ value: null, status: 'undecryptable', rewrite: false });
		const noKey = await revealSecret(platform(), 'p', 'r', envelope);
		expect(noKey.status).toBe('undecryptable');
	});

	it('never logs the secret or the envelope', async () => {
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const envelope = await createSecretBox(OLD_KEY).seal('super-secret-plain', 'p', 'r');
		await revealSecret(platform(createFakeKV(), { ENCRYPTION_KEY: OP_KEY }), 'p', 'r', envelope);
		const logged = JSON.stringify(spy.mock.calls);
		expect(logged).not.toContain('super-secret-plain');
		expect(logged).not.toContain(envelope);
	});

	it('opens a previous-key value and flags it for rewrite', async () => {
		const envelope = await createSecretBox(OLD_KEY).seal('rotate-me-1234', 'p', 'r');
		const p = platform(createFakeKV(), {
			ENCRYPTION_KEY: OP_KEY,
			ENCRYPTION_KEY_PREVIOUS: OLD_KEY
		});
		expect(await revealSecret(p, 'p', 'r', envelope)).toEqual({
			value: 'rotate-me-1234',
			status: 'ok',
			rewrite: true
		});
	});
});

describe('readRecordWithSecret', () => {
	const spec = aiKeySpec('k1');

	it('returns null for a missing record or missing KV', async () => {
		expect(await readRecordWithSecret(platform(), 'ai_key:k1', spec)).toBeNull();
		expect(await readRecordWithSecret(undefined, 'ai_key:k1', spec)).toBeNull();
	});

	it('migrates legacy plaintext: returns it, rewrites KV encrypted, adds a hint', async () => {
		const kv = createFakeKV({
			'ai_key:k1': JSON.stringify({ id: 'k1', name: 'Prod', apiKey: 'sk-live-ABCDEFGH9999' })
		});
		const p = platform(kv);
		const result = await readRecordWithSecret<any>(p, 'ai_key:k1', spec);

		expect(result?.status).toBe('legacy');
		expect(result?.record.apiKey).toBe('sk-live-ABCDEFGH9999');
		expect(result?.record.apiKeyLast4).toBe('9999');

		const raw = kv.data.get('ai_key:k1')!;
		expect(raw).not.toContain('sk-live-ABCDEFGH9999');
		const stored = JSON.parse(raw);
		expect(stored.name).toBe('Prod');
		expect(stored.apiKeyLast4).toBe('9999');

		const again = await readRecordWithSecret<any>(p, 'ai_key:k1', spec);
		expect(again?.status).toBe('ok');
		expect(again?.record.apiKey).toBe('sk-live-ABCDEFGH9999');
		expect(kv.data.get('ai_key:k1')).toBe(raw);
	});

	it('still returns the secret when the rewrite fails, and retries next time', async () => {
		const err = vi.spyOn(console, 'error').mockImplementation(() => {});
		const kv = createFakeKV({
			'ai_key:k1': JSON.stringify({ id: 'k1', apiKey: 'legacy-secret-value' })
		});
		kv.put = vi.fn().mockRejectedValue(new Error('KV down'));
		const result = await readRecordWithSecret<any>(platform(kv), 'ai_key:k1', spec);
		expect(result?.record.apiKey).toBe('legacy-secret-value');
		expect(err).toHaveBeenCalled();
		expect(JSON.parse(kv.data.get('ai_key:k1')!).apiKey).toBe('legacy-secret-value');
	});

	it('re-encrypts on read after rotation, then the old key can be dropped', async () => {
		const kv = createFakeKV();
		const before = platform(kv, { ENCRYPTION_KEY: OLD_KEY });
		kv.data.set(
			'ai_key:k1',
			JSON.stringify({
				id: 'k1',
				apiKey: await sealSecret(before, 'ai-key', 'k1', 'rotating-secret-1')
			})
		);
		const old = kv.data.get('ai_key:k1')!;

		const rotating = platform(kv, { ENCRYPTION_KEY: OP_KEY, ENCRYPTION_KEY_PREVIOUS: OLD_KEY });
		const first = await readRecordWithSecret<any>(rotating, 'ai_key:k1', spec);
		expect(first?.record.apiKey).toBe('rotating-secret-1');
		expect(kv.data.get('ai_key:k1')).not.toBe(old);

		const retired = platform(kv, { ENCRYPTION_KEY: OP_KEY });
		const second = await readRecordWithSecret<any>(retired, 'ai_key:k1', spec);
		expect(second?.record.apiKey).toBe('rotating-secret-1');
		expect(second?.status).toBe('ok');
	});

	it('upgrades from the KV-held key to an operator key without losing values', async () => {
		const kv = createFakeKV();
		const zeroEnv = platform(kv);
		kv.data.set(
			'ai_key:k1',
			JSON.stringify({
				id: 'k1',
				apiKey: await sealSecret(zeroEnv, 'ai-key', 'k1', 'zero-env-secret-1')
			})
		);
		const upgraded = platform(kv, { ENCRYPTION_KEY: OP_KEY });
		const read = await readRecordWithSecret<any>(upgraded, 'ai_key:k1', spec);
		expect(read?.record.apiKey).toBe('zero-env-secret-1');
		// Now sealed with the operator key: it opens without the KV key present.
		kv.data.delete(AUTO_KEY_KV_KEY);
		const standalone = await readRecordWithSecret<any>(
			platform(kv, { ENCRYPTION_KEY: OP_KEY }),
			'ai_key:k1',
			spec
		);
		expect(standalone?.record.apiKey).toBe('zero-env-secret-1');
	});

	it('rejects a sealed value copied from another record (AAD swap)', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const kv = createFakeKV();
		const p = platform(kv, { ENCRYPTION_KEY: OP_KEY });
		const sealedForA = await sealSecret(p, 'ai-key', 'A', 'secret-of-record-A');
		kv.data.set('ai_key:A', JSON.stringify({ id: 'A', apiKey: sealedForA }));
		kv.data.set('ai_key:B', JSON.stringify({ id: 'B', name: 'attacker', apiKey: sealedForA }));

		const b = await readRecordWithSecret<any>(p, 'ai_key:B', aiKeySpec('B'));
		expect(b?.status).toBe('undecryptable');
		expect(b?.record.apiKey).toBeUndefined();
		const a = await readRecordWithSecret<any>(p, 'ai_key:A', aiKeySpec('A'));
		expect(a?.record.apiKey).toBe('secret-of-record-A');
	});

	it('does not let an auth secret be used as an AI key', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const kv = createFakeKV();
		const p = platform(kv, { ENCRYPTION_KEY: OP_KEY });
		const authSealed = await sealSecret(p, 'auth-config', 'github', 'oauth-client-secret');
		kv.data.set('ai_key:github', JSON.stringify({ id: 'github', apiKey: authSealed }));
		const result = await readRecordWithSecret<any>(p, 'ai_key:github', aiKeySpec('github'));
		expect(result?.status).toBe('undecryptable');
	});

	it('detects a tampered record in KV', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const kv = createFakeKV();
		const p = platform(kv, { ENCRYPTION_KEY: OP_KEY });
		const sealed = await sealSecret(p, 'ai-key', 'k1', 'tamper-target-12');
		const tampered = sealed.slice(0, -2) + (sealed.endsWith('AA') ? 'BB' : 'AA');
		kv.data.set('ai_key:k1', JSON.stringify({ id: 'k1', apiKey: tampered }));
		expect((await readRecordWithSecret<any>(p, 'ai_key:k1', spec))?.status).toBe('undecryptable');
	});

	it('keeps an undecryptable record readable without its secret', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const envelope = await createSecretBox(OLD_KEY).seal('gone-forever-1', 'ai-key', 'k1');
		const kv = createFakeKV({
			'ai_key:k1': JSON.stringify({
				id: 'k1',
				name: 'Still here',
				apiKey: envelope,
				apiKeyLast4: 'er-1'
			})
		});
		const result = await readRecordWithSecret<any>(
			platform(kv, { ENCRYPTION_KEY: OP_KEY }),
			'ai_key:k1',
			spec
		);
		expect(result?.record.name).toBe('Still here');
		expect(result?.record.apiKey).toBeUndefined();
		expect(result?.record.apiKeyLast4).toBe('er-1');
	});
});

describe('record helpers', () => {
	it('ensureRecordSealed seals plaintext, keeps envelopes, ignores empty', async () => {
		const p = platform(createFakeKV(), { ENCRYPTION_KEY: OP_KEY });
		const spec = authConfigSpec('github');

		const sealed: any = await ensureRecordSealed(
			p,
			{ clientId: 'c', clientSecret: 'plain-oauth-secret' },
			spec
		);
		expect(sealed.clientSecret).not.toBe('plain-oauth-secret');
		expect(sealed.clientSecretLast4).toBe('cret');
		expect((await revealSecret(p, 'auth-config', 'github', sealed.clientSecret)).value).toBe(
			'plain-oauth-secret'
		);

		expect(await ensureRecordSealed(p, sealed, spec)).toBe(sealed);
		const empty = { clientId: 'c' };
		expect(await ensureRecordSealed(p, empty, spec)).toBe(empty);
	});

	it('redactRecord removes the secret and says only whether it is set', () => {
		const spec = aiKeySpec('k');
		expect(redactRecord({ id: 'k', apiKey: 'v1.xxx', apiKeyLast4: 'abcd' }, spec)).toEqual({
			id: 'k',
			apiKeyLast4: 'abcd',
			apiKeyConfigured: true
		});
		expect(redactRecord({ id: 'k' }, spec)).toEqual({ id: 'k', apiKeyConfigured: false });
	});
});
