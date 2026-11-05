import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	PROOF_CATCHUP_DAYS,
	awaitingGoLiveProof,
	boundedMaxAge,
	claimTimestampProof,
	maxAgeFor,
	runDueProofs,
	secondsUntilNextGoLive,
	startGoLiveProof
} from '../../src/lib/cms/go-live';

const NOW = new Date('2026-11-03T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

function item(over: Record<string, unknown> = {}): any {
	return {
		id: 'ci-1',
		slug: 'post',
		status: 'published',
		publishedAt: new Date(NOW.getTime() - 60_000).toISOString(),
		timestampProofRequestedAt: null,
		timestampProofHash: null,
		...over
	};
}

function mockDb(over: Record<string, unknown> = {}): any {
	const db: any = {
		prepare: vi.fn().mockReturnThis(),
		bind: vi.fn().mockReturnThis(),
		run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
		first: vi.fn().mockResolvedValue(null),
		all: vi.fn().mockResolvedValue({ results: [] }),
		...over
	};
	return db;
}

describe('awaitingGoLiveProof', () => {
	it('is true for a live item that never had a proof', () => {
		expect(awaitingGoLiveProof(item(), NOW)).toBe(true);
	});

	it('is false while the item is still scheduled, or not published', () => {
		expect(
			awaitingGoLiveProof(item({ publishedAt: new Date(NOW.getTime() + DAY).toISOString() }), NOW)
		).toBe(false);
		expect(awaitingGoLiveProof(item({ status: 'draft' }), NOW)).toBe(false);
	});

	it('is false once a proof was requested or recorded', () => {
		expect(awaitingGoLiveProof(item({ timestampProofRequestedAt: 'x' }), NOW)).toBe(false);
		expect(awaitingGoLiveProof(item({ timestampProofHash: 'abc' }), NOW)).toBe(false);
	});

	it('leaves old items alone: they predate the type opting in', () => {
		const old = new Date(NOW.getTime() - (PROOF_CATCHUP_DAYS + 1) * DAY).toISOString();
		expect(awaitingGoLiveProof(item({ publishedAt: old }), NOW)).toBe(false);
		expect(awaitingGoLiveProof(item({ publishedAt: null }), NOW)).toBe(false);
		expect(awaitingGoLiveProof(item({ publishedAt: 'garbage' }), NOW)).toBe(false);
	});

	it('uses the real clock by default', () => {
		expect(awaitingGoLiveProof(item({ publishedAt: new Date().toISOString() }))).toBe(true);
	});
});

describe('claimTimestampProof', () => {
	it('wins when the conditional UPDATE changed a row', async () => {
		const db = mockDb();
		await expect(claimTimestampProof(db, 'ci-1', NOW)).resolves.toBe(true);
		expect(db.prepare.mock.calls[0][0]).toContain('timestamp_proof_requested_at IS NULL');
		expect(db.bind).toHaveBeenCalledWith(NOW.toISOString(), 'ci-1');
	});

	it('loses when another caller already took it', async () => {
		const db = mockDb({ run: vi.fn().mockResolvedValue({ meta: { changes: 0 } }) });
		await expect(claimTimestampProof(db, 'ci-1')).resolves.toBe(false);
	});

	it('loses when the driver reports no meta', async () => {
		const db = mockDb({ run: vi.fn().mockResolvedValue({}) });
		await expect(claimTimestampProof(db, 'ci-1')).resolves.toBe(false);
	});
});

describe('startGoLiveProof', () => {
	it('runs the job once it has the claim', async () => {
		const run = vi.fn().mockResolvedValue(undefined);
		const db = mockDb();
		await expect(startGoLiveProof(db, item(), 'https://x/blog/post', run, NOW)).resolves.toBe(true);
		expect(run).toHaveBeenCalledWith(
			db,
			expect.objectContaining({ id: 'ci-1' }),
			'https://x/blog/post'
		);
	});

	it('does not run when it is not due', async () => {
		const run = vi.fn();
		const db = mockDb();
		await expect(
			startGoLiveProof(db, item({ timestampProofRequestedAt: 'x' }), 'u', run, NOW)
		).resolves.toBe(false);
		expect(run).not.toHaveBeenCalled();
		expect(db.run).not.toHaveBeenCalled();
	});

	it('does not run when another caller won the claim', async () => {
		const run = vi.fn();
		const db = mockDb({ run: vi.fn().mockResolvedValue({ meta: { changes: 0 } }) });
		await expect(startGoLiveProof(db, item(), 'u', run, NOW)).resolves.toBe(false);
		expect(run).not.toHaveBeenCalled();
	});
});

describe('runDueProofs', () => {
	const row = (over: Record<string, unknown> = {}) => ({
		id: 'ci-1',
		content_type_id: 'ct-1',
		slug: 'post',
		title: 'Post',
		status: 'published',
		fields: '{}',
		seo_title: null,
		seo_description: null,
		seo_image: null,
		author_id: null,
		published_at: new Date(NOW.getTime() - 60_000).toISOString(),
		created_at: '2026-01-01',
		updated_at: '2026-01-01',
		type_slug: 'blog',
		type_settings: '{"enableTimestampProof":true}',
		...over
	});

	it('starts a proof for each live opted-in item and counts them', async () => {
		const run = vi.fn().mockResolvedValue(undefined);
		const db = mockDb({
			all: vi.fn().mockResolvedValue({
				results: [
					row(),
					row({ id: 'ci-2', slug: 'other', type_settings: '{"routePrefix":"/articles"}' })
				]
			})
		});
		await expect(runDueProofs(db, 'https://site.test', run, 20, NOW)).resolves.toBe(2);
		expect(run.mock.calls[0][2]).toBe('https://site.test/blog/post');
		expect(run.mock.calls[1][2]).toBe('https://site.test/articles/other');
		const sql = db.prepare.mock.calls[0][0];
		expect(sql).toContain("json_extract(ct.settings, '$.enableTimestampProof') = 1");
		expect(sql).toContain("datetime('now', '-7 days')");
	});

	it('skips items another caller already claimed', async () => {
		const run = vi.fn();
		const db = mockDb({
			all: vi.fn().mockResolvedValue({ results: [row()] }),
			run: vi.fn().mockResolvedValue({ meta: { changes: 0 } })
		});
		await expect(runDueProofs(db, 'https://site.test', run, 20, NOW)).resolves.toBe(0);
		expect(run).not.toHaveBeenCalled();
	});

	it('returns 0 for no rows, however the driver words it', async () => {
		const db = mockDb({ all: vi.fn().mockResolvedValue({}) });
		await expect(runDueProofs(db, 'https://site.test', vi.fn())).resolves.toBe(0);
	});
});

describe('cache bounds', () => {
	it('keeps the base lifetime when nothing is scheduled', () => {
		expect(boundedMaxAge(3600, null)).toBe(3600);
	});

	it('shortens it to just past the next go-live', () => {
		expect(boundedMaxAge(3600, 90)).toBe(91);
		expect(boundedMaxAge(3600, 5000)).toBe(3600);
	});

	it('never goes below one second', () => {
		expect(boundedMaxAge(3600, 0)).toBe(1);
		expect(boundedMaxAge(3600, -30)).toBe(1);
	});

	it('reads the wait from the database', async () => {
		const db = mockDb({ first: vi.fn().mockResolvedValue({ seconds: 42 }) });
		await expect(secondsUntilNextGoLive(db)).resolves.toBe(42);
		expect(db.prepare.mock.calls[0][0]).toContain('julianday');
		await expect(secondsUntilNextGoLive(mockDb())).resolves.toBeNull();
		await expect(
			secondsUntilNextGoLive(mockDb({ first: vi.fn().mockResolvedValue({ seconds: null }) }))
		).resolves.toBeNull();
	});

	it('maxAgeFor bounds by the database and falls back to the base on trouble', async () => {
		await expect(maxAgeFor(undefined, 600)).resolves.toBe(600);
		await expect(
			maxAgeFor(mockDb({ first: vi.fn().mockResolvedValue({ seconds: 10 }) }), 600)
		).resolves.toBe(11);
		await expect(maxAgeFor(mockDb(), 600)).resolves.toBe(600);
		await expect(
			maxAgeFor(mockDb({ first: vi.fn().mockRejectedValue(new Error('down')) }), 600)
		).resolves.toBe(600);
	});
});

describe('cron route /api/cron/publish-scheduled', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	async function post(opts: { secret?: string; auth?: string; db?: any }) {
		vi.doMock('$lib/content-proof/proof-job', () => ({ runTimestampProofJob: vi.fn() }));
		const { POST } = await import('../../src/routes/api/cron/publish-scheduled/+server.js');
		return POST({
			request: { headers: new Headers(opts.auth ? { authorization: opts.auth } : {}) },
			platform: { env: { CRON_SECRET: opts.secret, DB: opts.db } },
			url: new URL('https://site.test/api/cron/publish-scheduled')
		} as any);
	}

	it('answers 503 when no secret is configured', async () => {
		await expect(post({ db: mockDb() })).rejects.toMatchObject({ status: 503 });
	});

	it('answers 401 for a missing or wrong bearer token', async () => {
		await expect(post({ secret: 's3cret', db: mockDb() })).rejects.toMatchObject({ status: 401 });
		await expect(
			post({ secret: 's3cret', auth: 'Bearer nope', db: mockDb() })
		).rejects.toMatchObject({ status: 401 });
		await expect(
			post({ secret: 's3cret', auth: 'Bearer s3cretX', db: mockDb() })
		).rejects.toMatchObject({ status: 401 });
	});

	it('answers 503 when the database is missing', async () => {
		await expect(post({ secret: 's3cret', auth: 'Bearer s3cret' })).rejects.toMatchObject({
			status: 503
		});
	});

	it('runs the catch-up and reports how many it started', async () => {
		const res = await post({ secret: 's3cret', auth: 'Bearer s3cret', db: mockDb() });
		expect(await res.json()).toMatchObject({
			job: 'publish-scheduled',
			outcome: 'succeeded',
			detail: { started: 0 }
		});
	});
});
