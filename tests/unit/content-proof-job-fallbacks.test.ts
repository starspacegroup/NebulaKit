/**
 * The nullish fallbacks in the proof job's record call, which are only
 * reachable by controlling what requestTimestamp resolves to — a well-formed
 * result that is missing the field the happy path expects.
 *
 * Separate file because it mocks $lib/timestamp/rfc3161 module-wide.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestTimestamp = vi.fn();

vi.mock('../../src/lib/timestamp/rfc3161', () => ({
	requestTimestamp: (...args: unknown[]) => requestTimestamp(...args)
}));
vi.mock('../../src/lib/timestamp/wayback', () => ({
	triggerWaybackCapture: vi.fn().mockResolvedValue(undefined)
}));

const item = {
	id: 'ci-1',
	title: 'The Future',
	slug: 'the-future',
	fields: { body: 'It will happen' }
} as any;

describe('runTimestampProofJob result fallbacks', () => {
	let mockDB: any;

	beforeEach(() => {
		vi.clearAllMocks();
		mockDB = {
			prepare: vi.fn().mockReturnThis(),
			bind: vi.fn().mockReturnThis(),
			run: vi.fn().mockResolvedValue({ success: true })
		};
	});

	it('records a null tsr when a successful result carries no token', async () => {
		const { runTimestampProofJob } = await import('../../src/lib/content-proof/proof-job');
		requestTimestamp.mockResolvedValue({ ok: true, tsaUrl: 'https://tsa.test' });

		await runTimestampProofJob(mockDB, item, 'https://example.test/claims/x');

		const bound = mockDB.bind.mock.calls.flat();
		expect(bound).toContain(null);
		// success path still records no error
		expect(bound).not.toContain('Unknown timestamp request error');
	});

	it('substitutes a generic reason when a failed result carries no error', async () => {
		const { runTimestampProofJob } = await import('../../src/lib/content-proof/proof-job');
		requestTimestamp.mockResolvedValue({ ok: false, tsaUrl: 'https://tsa.test' });

		await runTimestampProofJob(mockDB, item, 'https://example.test/claims/x');

		const bound = mockDB.bind.mock.calls.flat();
		expect(bound).toContain('Unknown timestamp request error');
	});
});
