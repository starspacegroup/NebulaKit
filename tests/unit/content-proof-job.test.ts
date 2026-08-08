/**
 * Tests for the timestamp-proof background job ($lib/content-proof/proof-job).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runTimestampProofJob } from '../../src/lib/content-proof/proof-job';

function makeItem(overrides: Record<string, unknown> = {}) {
	return {
		id: 'ci-1',
		title: 'The Future',
		slug: 'the-future',
		fields: { body: 'It will happen', date_window_start: null, date_window_end: null },
		...overrides
	} as any;
}

describe('runTimestampProofJob', () => {
	let mockDB: any;

	beforeEach(() => {
		mockDB = {
			prepare: vi.fn().mockReturnThis(),
			bind: vi.fn().mockReturnThis(),
			run: vi.fn().mockResolvedValue({ success: true })
		};
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('records a successful timestamp proof and triggers a Wayback capture', async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			arrayBuffer: async () => new Uint8Array([0, 1, 2]).buffer
		});

		await runTimestampProofJob(mockDB, makeItem(), 'https://example.test/claims/the-future');

		// One UPDATE for the proof attempt, and the wayback save endpoint hit.
		const boundValues = mockDB.bind.mock.calls.flat();
		expect(boundValues).toContain(null); // error column should be null on success
		expect(globalThis.fetch).toHaveBeenCalledWith(
			expect.stringContaining('web.archive.org/save/'),
			expect.any(Object)
		);
	});

	it('records the TSA error and still triggers a Wayback capture when the request fails', async () => {
		globalThis.fetch = vi
			.fn()
			.mockResolvedValueOnce({ ok: false, status: 500 }) // requestTimestamp fails
			.mockResolvedValueOnce({ ok: true }); // wayback save

		await runTimestampProofJob(mockDB, makeItem(), 'https://example.test/claims/the-future');

		const boundValues = mockDB.bind.mock.calls.flat();
		expect(boundValues.some((v: unknown) => typeof v === 'string' && v.length > 0)).toBe(true);
		expect(globalThis.fetch).toHaveBeenCalledTimes(2);
	});

	it('never throws and still triggers Wayback when hash computation fails', async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });

		// crypto.subtle.digest is what computeCanonicalHash relies on — break it
		// to force the catch branch. Use vi.spyOn (not a raw reassignment) so
		// afterEach's vi.restoreAllMocks() cleans this up even if an assertion
		// below throws — a leaked digest mock would poison every other test file
		// sharing this worker.
		vi.spyOn(globalThis.crypto.subtle, 'digest').mockRejectedValue(new Error('boom'));

		await expect(
			runTimestampProofJob(mockDB, makeItem(), 'https://example.test/claims/the-future')
		).resolves.toBeUndefined();

		const boundValues = mockDB.bind.mock.calls.flat();
		expect(boundValues).toContain('boom');
		expect(globalThis.fetch).toHaveBeenCalledWith(
			expect.stringContaining('web.archive.org/save/'),
			expect.any(Object)
		);
	});

	it('never throws even when recordTimestampProofAttempt itself rejects', async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });
		mockDB.run.mockRejectedValue(new Error('db unavailable'));

		await expect(
			runTimestampProofJob(mockDB, makeItem(), 'https://example.test/claims/the-future')
		).resolves.toBeUndefined();
	});

	it('falls back to empty strings when the item carries no proof fields', async () => {
		// fields.body / date_window_* are optional — a proof-enabled type need
		// not define them, and the job must still produce a hash.
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			arrayBuffer: async () => new Uint8Array([0, 1, 2]).buffer
		});

		await runTimestampProofJob(mockDB, makeItem({ fields: {} }), 'https://example.test/claims/x');

		const bound = mockDB.bind.mock.calls.flat();
		// a hash was still computed and recorded
		expect(bound.some((v: unknown) => typeof v === 'string' && v.length === 64)).toBe(true);
	});

	it('records an error rather than throwing when the proof request fails', async () => {
		globalThis.fetch = vi.fn().mockRejectedValue(new Error('TSA unreachable'));

		await expect(
			runTimestampProofJob(mockDB, makeItem(), 'https://example.test/claims/x')
		).resolves.toBeUndefined();

		const bound = mockDB.bind.mock.calls.flat();
		expect(bound.some((v: unknown) => typeof v === 'string' && v.includes('unreachable'))).toBe(
			true
		);
	});

	it('never rejects even when recording the failure also fails', async () => {
		globalThis.fetch = vi.fn().mockRejectedValue(new Error('TSA unreachable'));
		mockDB.run = vi.fn().mockRejectedValue(new Error('D1 down'));

		await expect(
			runTimestampProofJob(mockDB, makeItem(), 'https://example.test/claims/x')
		).resolves.toBeUndefined();
	});

	it('records a TSA failure returned as a result, not thrown', async () => {
		// requestTimestamp resolves { ok: false } on an HTTP error rather than
		// throwing, so this is a different path from the catch below.
		globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });

		await runTimestampProofJob(mockDB, makeItem(), 'https://example.test/claims/x');

		const bound = mockDB.bind.mock.calls.flat();
		expect(bound.some((v: unknown) => typeof v === 'string' && v.includes('HTTP 503'))).toBe(true);
		// no tsr recorded on a failed attempt
		expect(bound).toContain(null);
	});

	it('falls back to a generic message when a non-Error is thrown', async () => {
		// The catch stringifies only Error instances; anything else must still
		// produce a recorded reason rather than "undefined".
		vi.spyOn(crypto.subtle, 'digest').mockImplementation(() => {
			throw 'not an Error';
		});

		await runTimestampProofJob(mockDB, makeItem(), 'https://example.test/claims/x');

		const bound = mockDB.bind.mock.calls.flat();
		expect(bound).toContain('Unknown error computing timestamp proof');
	});
});
