/**
 * Tests for the minimal RFC 3161 timestamp client ($lib/timestamp/rfc3161)
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	encodeTimeStampReq,
	peekPkiStatus,
	requestTimestamp
} from '../../src/lib/timestamp/rfc3161';

const VALID_HASH_HEX = 'a'.repeat(64); // 32 bytes of 0xaa

function derLen(bytes: Uint8Array, offset: number): { len: number; next: number } {
	const first = bytes[offset];
	if (first <= 0x7f) return { len: first, next: offset + 1 };
	const numBytes = first & 0x7f;
	let len = 0;
	for (let i = 0; i < numBytes; i++) len = (len << 8) | bytes[offset + 1 + i];
	return { len, next: offset + 1 + numBytes };
}

/** Build a minimal valid-shaped TimeStampResp with a given PKIStatus value. */
function buildTimeStampResp(pkiStatus: number): Uint8Array {
	const statusInt = Uint8Array.from([0x02, 0x01, pkiStatus]);
	const pkiStatusInfo = Uint8Array.from([0x30, statusInt.length, ...statusInt]);
	const outer = Uint8Array.from([0x30, pkiStatusInfo.length, ...pkiStatusInfo]);
	return outer;
}

describe('encodeTimeStampReq', () => {
	it('rejects a hash that is not 32 bytes', () => {
		expect(() => encodeTimeStampReq('abcd')).toThrow(/32-byte/);
	});

	it('rejects an odd-length hex string', () => {
		expect(() => encodeTimeStampReq('a'.repeat(63))).toThrow();
	});

	it('produces a well-formed outer SEQUENCE containing the version, imprint, nonce, and certReq', () => {
		const bytes = encodeTimeStampReq(VALID_HASH_HEX, { certReq: true });

		expect(bytes[0]).toBe(0x30); // outer SEQUENCE tag
		const { len, next } = derLen(bytes, 1);
		expect(next + len).toBe(bytes.length);

		// version INTEGER v1: 02 01 01
		expect(Array.from(bytes.slice(next, next + 3))).toEqual([0x02, 0x01, 0x01]);

		// messageImprint SEQUENCE starts right after version
		const imprintStart = next + 3;
		expect(bytes[imprintStart]).toBe(0x30);

		// The encoded hash bytes must appear verbatim somewhere in the structure
		const hashBytes = Uint8Array.from(Array(32).fill(0xaa));
		const haystack = Array.from(bytes).join(',');
		const needle = Array.from(hashBytes).join(',');
		expect(haystack).toContain(needle);

		// certReq TRUE (01 01 ff) should appear near the end
		expect(Array.from(bytes.slice(-3))).toEqual([0x01, 0x01, 0xff]);
	});

	it('omits certReq when not requested', () => {
		const bytes = encodeTimeStampReq(VALID_HASH_HEX);
		// Should not end with the certReq BOOLEAN TLV
		expect(Array.from(bytes.slice(-3))).not.toEqual([0x01, 0x01, 0xff]);
	});

	it('omits the nonce when includeNonce is false', () => {
		const withNonce = encodeTimeStampReq(VALID_HASH_HEX, { includeNonce: true });
		const withoutNonce = encodeTimeStampReq(VALID_HASH_HEX, { includeNonce: false });
		expect(withoutNonce.length).toBeLessThan(withNonce.length);
	});

	it('embeds the SHA-256 OID', () => {
		const bytes = encodeTimeStampReq(VALID_HASH_HEX);
		const oid = [0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01];
		const haystack = Array.from(bytes).join(',');
		expect(haystack).toContain(oid.join(','));
	});

	it('produces a different nonce on each call (when included)', () => {
		const a = encodeTimeStampReq(VALID_HASH_HEX, { includeNonce: true });
		const b = encodeTimeStampReq(VALID_HASH_HEX, { includeNonce: true });
		expect(Array.from(a)).not.toEqual(Array.from(b));
	});
});

describe('peekPkiStatus', () => {
	it('reads PKIStatus 0 (granted)', () => {
		expect(peekPkiStatus(buildTimeStampResp(0))).toBe(0);
	});

	it('reads PKIStatus 2 (rejection)', () => {
		expect(peekPkiStatus(buildTimeStampResp(2))).toBe(2);
	});

	it('returns null for garbage bytes', () => {
		expect(peekPkiStatus(Uint8Array.from([0xff, 0xff, 0xff]))).toBeNull();
	});

	it('returns null for a truncated buffer', () => {
		expect(peekPkiStatus(Uint8Array.from([0x30]))).toBeNull();
	});

	it('returns null when the inner tag is not a SEQUENCE', () => {
		expect(peekPkiStatus(Uint8Array.from([0x30, 0x02, 0x04, 0x00]))).toBeNull();
	});

	it('handles a long-form (multi-byte) length encoding', () => {
		// outer SEQUENCE with long-form length 0x81 0x05 (len=5), wrapping a
		// short-form inner SEQUENCE containing PKIStatus INTEGER = 0
		const bytes = Uint8Array.from([0x30, 0x81, 0x05, 0x30, 0x03, 0x02, 0x01, 0x00]);
		expect(peekPkiStatus(bytes)).toBe(0);
	});

	it('returns null when a long-form length is truncated', () => {
		const bytes = Uint8Array.from([0x30, 0x82, 0x01]); // claims 2 length bytes, only 1 present
		expect(peekPkiStatus(bytes)).toBeNull();
	});
});

describe('requestTimestamp', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('returns ok:true with a base64 TSR on a granted response', async () => {
		const resp = buildTimeStampResp(0);
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			arrayBuffer: async () => resp.buffer
		});

		const result = await requestTimestamp(VALID_HASH_HEX);

		expect(result.ok).toBe(true);
		expect(result.pkiStatus).toBe(0);
		expect(result.tsrBase64).toBeTruthy();
		expect(Buffer.from(result.tsrBase64!, 'base64')).toEqual(Buffer.from(resp));
	});

	it('accepts grantedWithMods (PKIStatus 1)', async () => {
		const resp = buildTimeStampResp(1);
		globalThis.fetch = vi
			.fn()
			.mockResolvedValue({ ok: true, arrayBuffer: async () => resp.buffer });

		const result = await requestTimestamp(VALID_HASH_HEX);

		expect(result.ok).toBe(true);
	});

	it('returns ok:false on HTTP failure', async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });

		const result = await requestTimestamp(VALID_HASH_HEX);

		expect(result.ok).toBe(false);
		expect(result.error).toMatch(/503/);
	});

	it('returns ok:false when the TSA rejects the request (PKIStatus 2)', async () => {
		const resp = buildTimeStampResp(2);
		globalThis.fetch = vi
			.fn()
			.mockResolvedValue({ ok: true, arrayBuffer: async () => resp.buffer });

		const result = await requestTimestamp(VALID_HASH_HEX);

		expect(result.ok).toBe(false);
		expect(result.pkiStatus).toBe(2);
		expect(result.error).toMatch(/rejected/);
	});

	it('returns ok:false when the response bytes are unparseable', async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			arrayBuffer: async () => Uint8Array.from([0xff]).buffer
		});

		const result = await requestTimestamp(VALID_HASH_HEX);

		expect(result.ok).toBe(false);
		expect(result.error).toMatch(/unparseable/);
	});

	it('returns ok:false when fetch itself throws', async () => {
		globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down'));

		const result = await requestTimestamp(VALID_HASH_HEX);

		expect(result.ok).toBe(false);
		expect(result.error).toBe('network down');
	});

	it('posts to the given tsaUrl with the correct content type', async () => {
		const resp = buildTimeStampResp(0);
		const fetchMock = vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => resp.buffer });
		globalThis.fetch = fetchMock;

		await requestTimestamp(VALID_HASH_HEX, 'https://example.test/tsr');

		expect(fetchMock).toHaveBeenCalledWith(
			'https://example.test/tsr',
			expect.objectContaining({
				method: 'POST',
				headers: { 'Content-Type': 'application/timestamp-query' }
			})
		);
	});
});
