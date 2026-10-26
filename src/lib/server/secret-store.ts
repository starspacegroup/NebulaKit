/**
 * Where the encryption key comes from, and the helpers every secret-bearing KV
 * record goes through (AI provider keys, OAuth client secrets).
 *
 * Key sources, in order of preference:
 *  1. `ENCRYPTION_KEY` (Worker secret). KV alone then reveals nothing.
 *  2. A random key generated on first save and kept in KV under
 *     `encryption_key:auto`. This keeps the zero-environment promise: values are
 *     encrypted from the first save. It is weaker, since whoever can read the KV
 *     namespace reads the key beside the ciphertext. It still stops casual
 *     exposure (a single value in a log, an export, a support paste) and the
 *     operator can upgrade at any time: set `ENCRYPTION_KEY` and the auto key is
 *     used as a "previous" key, so existing values open and are re-sealed on read.
 *
 * A malformed `ENCRYPTION_KEY` is an error, never a reason to fall back to
 * plaintext or to a different key.
 */
import {
	SecretBoxError,
	createSecretBox,
	generateEncryptionKey,
	isSecretEnvelope,
	parseEncryptionKey,
	secretHint,
	type SecretBox
} from './secret-box';

export const AUTO_KEY_KV_KEY = 'encryption_key:auto';
export const AI_KEY_PURPOSE = 'ai-key';
export const AUTH_CONFIG_PURPOSE = 'auth-config';

export type SecretStatus = 'ok' | 'legacy' | 'undecryptable' | 'missing';

export interface EncryptionStatus {
	/** `operator`: ENCRYPTION_KEY set. `auto`: key held in KV. `none`: no key yet. */
	mode: 'operator' | 'auto' | 'none';
	previousKeys: number;
}

type Env = App.Platform['env'];

function splitPrevious(raw: string | undefined): string[] {
	return (raw ?? '')
		.split(',')
		.map((part) => part.trim())
		.filter(Boolean);
}

function isUsableKey(value: string): boolean {
	try {
		parseEncryptionKey(value);
		return true;
	} catch {
		return false;
	}
}

async function readAutoKey(env: Env): Promise<string | null> {
	const stored = await env.KV?.get(AUTO_KEY_KV_KEY);
	return stored ? stored.trim() : null;
}

/**
 * The box for this deployment. `create` allows generating the KV-held key when
 * nothing is configured (writes); reads pass false so a read never mints a key.
 * Returns null only when there is no key and none may be created.
 */
export async function getSecretBox(
	platform: App.Platform | undefined,
	options: { create: boolean }
): Promise<SecretBox | null> {
	const env = platform?.env;
	if (!env) throw new SecretBoxError('invalid-key', 'Platform environment is not available.');

	const operatorKey = env.ENCRYPTION_KEY?.trim();
	const previous = splitPrevious(env.ENCRYPTION_KEY_PREVIOUS);
	let autoKey = env.KV ? await readAutoKey(env) : null;

	if (operatorKey) {
		// The auto key, when one exists, stays acceptable so a deployment that
		// started zero-env can upgrade without losing anything.
		if (autoKey && !isUsableKey(autoKey)) {
			console.error('Ignoring unreadable encryption_key:auto in KV; ENCRYPTION_KEY is in use.');
			autoKey = null;
		}
		return createSecretBox(operatorKey, autoKey ? [...previous, autoKey] : previous);
	}

	if (!autoKey) {
		if (!options.create) return null;
		if (!env.KV) throw new SecretBoxError('invalid-key', 'KV storage not available.');
		const generated = generateEncryptionKey();
		await env.KV.put(AUTO_KEY_KV_KEY, generated);
		// KV has no compare-and-set. Re-read so two racing first saves converge on
		// whatever value won, and fall back to ours if the read has not caught up.
		autoKey = (await readAutoKey(env)) ?? generated;
	}
	return createSecretBox(autoKey, previous);
}

export async function getEncryptionStatus(
	platform: App.Platform | undefined
): Promise<EncryptionStatus> {
	const env = platform?.env;
	const previousKeys = splitPrevious(env?.ENCRYPTION_KEY_PREVIOUS).length;
	if (env?.ENCRYPTION_KEY?.trim()) return { mode: 'operator', previousKeys };
	const auto = env?.KV ? await readAutoKey(env) : null;
	return { mode: auto ? 'auto' : 'none', previousKeys };
}

/** Seal a new secret. Always uses the current key; mints the KV key if needed. */
export async function sealSecret(
	platform: App.Platform | undefined,
	purpose: string,
	recordId: string,
	plaintext: string
): Promise<string> {
	const box = await getSecretBox(platform, { create: true });
	return box!.seal(plaintext, purpose, recordId);
}

export interface RevealedSecret {
	value: string | null;
	status: SecretStatus;
	/** The stored form should be rewritten (legacy plaintext, or sealed with an old key). */
	rewrite: boolean;
}

/** Turn a stored field value into plaintext. Never throws for bad data. */
export async function revealSecret(
	platform: App.Platform | undefined,
	purpose: string,
	recordId: string,
	stored: unknown
): Promise<RevealedSecret> {
	if (typeof stored !== 'string' || stored === '') {
		return { value: null, status: 'missing', rewrite: false };
	}
	if (!isSecretEnvelope(stored)) {
		// Saved by a version that predated encryption.
		return { value: stored, status: 'legacy', rewrite: true };
	}
	try {
		const box = await getSecretBox(platform, { create: false });
		if (!box) throw new SecretBoxError('invalid-key', 'No encryption key is configured.');
		const opened = await box.open(stored, purpose, recordId);
		return { value: opened.plaintext, status: 'ok', rewrite: opened.rotated };
	} catch (err) {
		const reason = err instanceof SecretBoxError ? err.message : 'unexpected error';
		console.error(`Stored secret ${purpose}:${recordId} is unreadable: ${reason}`);
		return { value: null, status: 'undecryptable', rewrite: false };
	}
}

export interface SecretField {
	/** Property holding the secret (`apiKey`, `clientSecret`). */
	field: string;
	/** Property that carries the last four characters for display. */
	hintField: string;
	purpose: string;
	recordId: string;
}

type Rec = Record<string, unknown>;

/** Replace the field with a sealed envelope (and refresh its display hint). */
export async function sealRecordSecret<T extends Rec>(
	platform: App.Platform | undefined,
	record: T,
	spec: SecretField,
	plaintext: string
): Promise<T> {
	return {
		...record,
		[spec.field]: await sealSecret(platform, spec.purpose, spec.recordId, plaintext),
		[spec.hintField]: secretHint(plaintext)
	};
}

/**
 * Make sure a record about to be written holds no plaintext secret. A value that
 * is already an envelope is kept as is, so metadata-only updates (toggle, rename)
 * work even when the key is unavailable and never drop the stored secret.
 */
export async function ensureRecordSealed<T extends Rec>(
	platform: App.Platform | undefined,
	record: T,
	spec: SecretField
): Promise<T> {
	const current = record[spec.field];
	if (typeof current !== 'string' || current === '' || isSecretEnvelope(current)) return record;
	return sealRecordSecret(platform, record, spec, current);
}

/** Drop the secret from a record that is about to leave the server. */
export function redactRecord(record: Rec, spec: SecretField): Rec {
	const { [spec.field]: stored, ...rest } = record;
	return {
		...rest,
		[`${spec.field}Configured`]: typeof stored === 'string' && stored !== ''
	};
}

/**
 * Read a KV record and return it with the secret decrypted, in memory only.
 * Legacy plaintext and old-key ciphertext are rewritten in place, best effort:
 * a failed rewrite never fails the read.
 */
export async function readRecordWithSecret<T extends Rec>(
	platform: App.Platform | undefined,
	kvKey: string,
	spec: SecretField
): Promise<{ record: T; status: SecretStatus } | null> {
	const raw = await platform?.env?.KV?.get(kvKey);
	if (!raw) return null;
	const stored = JSON.parse(raw) as T;
	const revealed = await revealSecret(platform, spec.purpose, spec.recordId, stored[spec.field]);

	if (revealed.rewrite && revealed.value !== null) {
		try {
			const sealed = await sealRecordSecret(platform, stored, spec, revealed.value);
			await platform!.env.KV.put(kvKey, JSON.stringify(sealed));
		} catch (err) {
			console.error(`Could not re-encrypt ${kvKey}; it will be retried on next read.`, err);
		}
	}

	const hint = stored[spec.hintField] ?? (revealed.value ? secretHint(revealed.value) : null);
	return {
		record: { ...stored, [spec.field]: revealed.value ?? undefined, [spec.hintField]: hint },
		status: revealed.status
	};
}

export function aiKeySpec(id: string): SecretField {
	return { field: 'apiKey', hintField: 'apiKeyLast4', purpose: AI_KEY_PURPOSE, recordId: id };
}

export function authConfigSpec(provider: string): SecretField {
	return {
		field: 'clientSecret',
		hintField: 'clientSecretLast4',
		purpose: AUTH_CONFIG_PURPOSE,
		recordId: provider
	};
}
