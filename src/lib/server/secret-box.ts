/**
 * Authenticated encryption for secrets that must be stored (provider API keys,
 * OAuth client secrets). Pure WebCrypto, no storage: `secret-store.ts` decides
 * where keys come from and where ciphertext lives.
 *
 * Envelope: `v1.<base64url iv>.<base64url ciphertext+tag>`, AES-256-GCM.
 *
 *  - One root secret (`ENCRYPTION_KEY`, base64 of 32 random bytes) serves every
 *    purpose. Each purpose gets its own subkey via HKDF-SHA-256, so a ciphertext
 *    for one purpose can never be opened as another.
 *  - Associated data (`purpose:recordId`) is authenticated with the ciphertext, so
 *    a value copied from one record to another fails to open.
 *  - Rotation: a box holds a current key and any number of previous keys. Sealing
 *    always uses the current key; opening tries current first and reports
 *    `rotated: true` when a previous key was needed, so the caller can re-seal.
 */

const VERSION = 'v1';
const IV_BYTES = 12;
const KEY_BYTES = 32;
const HKDF_SALT = 'nebulakit.secret-box.salt.v1';
const HKDF_INFO_PREFIX = 'nebulakit.secret-box.v1:';

/** `v1.` + a 12-byte IV (16 base64url chars) + `.` + ciphertext (at least the 16-byte tag). */
const ENVELOPE = /^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22,}$/;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export type SecretBoxErrorCode = 'invalid-key' | 'bad-envelope' | 'decrypt-failed';

export class SecretBoxError extends Error {
	constructor(
		readonly code: SecretBoxErrorCode,
		message: string
	) {
		super(message);
		this.name = 'SecretBoxError';
	}
}

export interface OpenedSecret {
	plaintext: string;
	/** True when only a previous key opened it: re-seal with the current key. */
	rotated: boolean;
}

export interface SecretBox {
	seal(plaintext: string, purpose: string, recordId: string): Promise<string>;
	open(envelope: string, purpose: string, recordId: string): Promise<OpenedSecret>;
}

export function toBase64Url(bytes: Uint8Array): string {
	let binary = '';
	for (let offset = 0; offset < bytes.length; offset += 0x8000) {
		binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
	}
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(value: string): Uint8Array {
	const padded = value.replace(/-/g, '+').replace(/_/g, '/');
	const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
	return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

/** A fresh 32-byte root key, base64 encoded. What `generate-encryption-key` prints. */
export function generateEncryptionKey(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(KEY_BYTES));
	return btoa(String.fromCharCode(...bytes));
}

/** Decode a base64 (or base64url) root key and insist on exactly 32 bytes. */
export function parseEncryptionKey(value: string): Uint8Array {
	let bytes: Uint8Array;
	try {
		bytes = fromBase64Url(value.trim().replace(/=+$/, ''));
	} catch {
		throw new SecretBoxError('invalid-key', 'Encryption key is not valid base64.');
	}
	if (bytes.length !== KEY_BYTES) {
		throw new SecretBoxError(
			'invalid-key',
			`Encryption key must decode to ${KEY_BYTES} bytes (got ${bytes.length}). Generate one with: bun run generate:encryption-key`
		);
	}
	return bytes;
}

export function isSecretEnvelope(value: unknown): value is string {
	return typeof value === 'string' && ENVELOPE.test(value);
}

async function deriveSubkey(root: Uint8Array, purpose: string): Promise<CryptoKey> {
	const material = await crypto.subtle.importKey('raw', root as BufferSource, 'HKDF', false, [
		'deriveKey'
	]);
	return crypto.subtle.deriveKey(
		{
			name: 'HKDF',
			hash: 'SHA-256',
			salt: encoder.encode(HKDF_SALT),
			info: encoder.encode(HKDF_INFO_PREFIX + purpose)
		},
		material,
		{ name: 'AES-GCM', length: 256 },
		false,
		['encrypt', 'decrypt']
	);
}

function aad(purpose: string, recordId: string): Uint8Array {
	return encoder.encode(`${purpose}:${recordId}`);
}

/**
 * @param current  base64 root key used to seal.
 * @param previous base64 root keys still accepted when opening, newest first.
 */
export function createSecretBox(current: string, previous: readonly string[] = []): SecretBox {
	const roots = [parseEncryptionKey(current), ...previous.map(parseEncryptionKey)];

	return {
		async seal(plaintext, purpose, recordId) {
			const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
			const ciphertext = await crypto.subtle.encrypt(
				{ name: 'AES-GCM', iv, additionalData: aad(purpose, recordId) as BufferSource },
				await deriveSubkey(roots[0], purpose),
				encoder.encode(plaintext)
			);
			return `${VERSION}.${toBase64Url(iv)}.${toBase64Url(new Uint8Array(ciphertext))}`;
		},

		async open(envelope, purpose, recordId) {
			if (!isSecretEnvelope(envelope)) {
				throw new SecretBoxError('bad-envelope', 'Not a v1 secret envelope.');
			}
			const [, ivPart, ctPart] = envelope.split('.');
			const iv = fromBase64Url(ivPart);
			const ciphertext = fromBase64Url(ctPart);
			const additionalData = aad(purpose, recordId) as BufferSource;

			for (let index = 0; index < roots.length; index++) {
				try {
					const plaintext = await crypto.subtle.decrypt(
						{ name: 'AES-GCM', iv: iv as BufferSource, additionalData },
						await deriveSubkey(roots[index], purpose),
						ciphertext as BufferSource
					);
					return { plaintext: decoder.decode(plaintext), rotated: index > 0 };
				} catch {
					// Wrong key, wrong purpose/record, or tampering: AES-GCM cannot tell
					// them apart, so try the next key and report one generic failure.
				}
			}
			throw new SecretBoxError(
				'decrypt-failed',
				'Secret could not be decrypted with any configured key, or was altered or moved.'
			);
		}
	};
}

/** Last four characters for admin display ("configured, ends in …abcd"). Short
 *  secrets reveal nothing: a value under 12 characters shows no hint. */
export function secretHint(secret: string): string | null {
	return secret.length >= 12 ? secret.slice(-4) : null;
}
