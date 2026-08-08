/**
 * Minimal hand-rolled RFC 3161 trusted-timestamp client.
 *
 * No ASN.1 library — a TimeStampReq is ~5 nested TLVs, not the full DER
 * grammar, so a tiny purpose-built encoder is lower-risk than pulling in a
 * dependency (most of which assume Node APIs unavailable in Workers).
 *
 * Scope boundary: this only *requests* a timestamp and stores the raw
 * response opaquely. It never parses or verifies the TSA's signature chain
 * — that's what `openssl ts -verify` (or an online RFC3161 verifier) is for.
 * The one thing worth checking ourselves is PKIStatus, since a TSA can
 * return HTTP 200 with a *rejected* status — an HTTP-only check would
 * silently accept that as success.
 */

const DEFAULT_TSA_URL = 'https://freetsa.org/tsr';

// Fixed DER byte sequences that never change for this request shape.
const SHA256_OID = new Uint8Array([
	0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01
]);
const NULL_BYTES = new Uint8Array([0x05, 0x00]);
const BOOLEAN_TRUE = new Uint8Array([0x01, 0x01, 0xff]);
const VERSION_V1 = new Uint8Array([0x02, 0x01, 0x01]);

function derLength(n: number): number[] {
	if (n <= 0x7f) return [n];
	const bytes: number[] = [];
	let v = n;
	while (v > 0) {
		bytes.unshift(v & 0xff);
		v = v >>> 8;
	}
	return [0x80 | bytes.length, ...bytes];
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
	const total = arrays.reduce((sum, a) => sum + a.length, 0);
	const out = new Uint8Array(total);
	let offset = 0;
	for (const a of arrays) {
		out.set(a, offset);
		offset += a.length;
	}
	return out;
}

function tlv(tag: number, content: Uint8Array): Uint8Array {
	const lengthBytes = Uint8Array.from(derLength(content.length));
	return concatBytes(Uint8Array.from([tag]), lengthBytes, content);
}

function hexToBytes(hex: string): Uint8Array {
	if (hex.length % 2 !== 0) {
		throw new Error('hexToBytes requires an even-length hex string');
	}
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < bytes.length; i++) {
		bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
	}
	return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
	let binary = '';
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}

function encodeNonce(): Uint8Array {
	const raw = crypto.getRandomValues(new Uint8Array(8));
	// DER INTEGER is signed — prepend a 0x00 byte if the high bit is set so
	// it doesn't get misread as negative.
	const bytes = raw[0] & 0x80 ? concatBytes(new Uint8Array([0x00]), raw) : raw;
	return tlv(0x02, bytes);
}

export interface EncodeOptions {
	certReq?: boolean;
	includeNonce?: boolean;
}

/**
 * Build a DER-encoded TimeStampReq for a 32-byte SHA-256 hash (as hex).
 *
 * TimeStampReq ::= SEQUENCE { version INTEGER, messageImprint MessageImprint,
 *   nonce INTEGER OPTIONAL, certReq BOOLEAN DEFAULT FALSE }
 * MessageImprint ::= SEQUENCE { hashAlgorithm AlgorithmIdentifier, hashedMessage OCTET STRING }
 * AlgorithmIdentifier ::= SEQUENCE { algorithm OBJECT IDENTIFIER, parameters NULL }
 */
export function encodeTimeStampReq(hashHex: string, options: EncodeOptions = {}): Uint8Array {
	const hashBytes = hexToBytes(hashHex);
	if (hashBytes.length !== 32) {
		throw new Error('encodeTimeStampReq requires a 32-byte (SHA-256) hash as hex');
	}

	const algorithmIdentifier = tlv(0x30, concatBytes(SHA256_OID, NULL_BYTES));
	const hashedMessage = tlv(0x04, hashBytes);
	const messageImprint = tlv(0x30, concatBytes(algorithmIdentifier, hashedMessage));

	const parts = [VERSION_V1, messageImprint];
	if (options.includeNonce !== false) {
		parts.push(encodeNonce());
	}
	// certReq: TRUE asks the TSA to embed its cert chain, so the downloaded
	// .tsr is self-contained for `openssl ts -verify` without a visitor
	// needing FreeTSA's CA bundle separately.
	if (options.certReq) {
		parts.push(BOOLEAN_TRUE);
	}

	return tlv(0x30, concatBytes(...parts));
}

/**
 * Read just the PKIStatus integer out of a TimeStampResp, without parsing
 * the signed token. Its position is stable: PKIStatus is always the first
 * field of the first nested SEQUENCE (statusString/failInfo are optional
 * trailing fields). Returns null if the bytes don't look like a valid
 * TimeStampResp at all.
 */
export function peekPkiStatus(bytes: Uint8Array): number | null {
	let i = 0;

	function expectTag(tag: number): boolean {
		if (bytes[i] !== tag) return false;
		i++;
		return true;
	}

	function readLength(): number | null {
		const first = bytes[i];
		if (first === undefined) return null;
		i++;
		if (first <= 0x7f) return first;
		const numBytes = first & 0x7f;
		let len = 0;
		for (let j = 0; j < numBytes; j++) {
			const b = bytes[i];
			if (b === undefined) return null;
			len = (len << 8) | b;
			i++;
		}
		return len;
	}

	// TimeStampResp ::= SEQUENCE { status PKIStatusInfo, ... }
	if (!expectTag(0x30) || readLength() === null) return null;
	// PKIStatusInfo ::= SEQUENCE { status PKIStatus, ... }
	if (!expectTag(0x30) || readLength() === null) return null;
	// PKIStatus ::= INTEGER
	if (!expectTag(0x02)) return null;
	const len = readLength();
	if (len === null || len < 1) return null;

	let value = 0;
	for (let j = 0; j < len; j++) {
		const b = bytes[i];
		if (b === undefined) return null;
		value = (value << 8) | b;
		i++;
	}
	return value;
}

export interface TimestampResult {
	ok: boolean;
	tsaUrl: string;
	tsrBase64?: string;
	pkiStatus?: number;
	error?: string;
}

/** PKIStatus 0 (granted) and 1 (grantedWithMods) both mean a usable token was issued. */
const GRANTED_STATUSES = new Set([0, 1]);

/** Request an RFC 3161 timestamp for a SHA-256 hash from a TSA. Never throws. */
export async function requestTimestamp(
	hashHex: string,
	tsaUrl: string = DEFAULT_TSA_URL
): Promise<TimestampResult> {
	try {
		const query = encodeTimeStampReq(hashHex, { certReq: true });
		const res = await fetch(tsaUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/timestamp-query' },
			body: query as BodyInit
		});

		if (!res.ok) {
			return { ok: false, tsaUrl, error: `TSA request failed: HTTP ${res.status}` };
		}

		const buffer = new Uint8Array(await res.arrayBuffer());
		const pkiStatus = peekPkiStatus(buffer);
		if (pkiStatus === null || !GRANTED_STATUSES.has(pkiStatus)) {
			return {
				ok: false,
				tsaUrl,
				pkiStatus: pkiStatus ?? undefined,
				error: `TSA rejected the request (PKIStatus ${pkiStatus ?? 'unparseable'})`
			};
		}

		return { ok: true, tsaUrl, tsrBase64: bytesToBase64(buffer), pkiStatus };
	} catch (err) {
		return {
			ok: false,
			tsaUrl,
			error: err instanceof Error ? err.message : 'Unknown timestamp request error'
		};
	}
}
