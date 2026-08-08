import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('CMS API - Predictions proof routes', () => {
	let mockPlatform: any;
	let mockLocals: any;
	let mockDB: any;

	const contentTypeRow = {
		id: 'ct-1',
		slug: 'predictions',
		name: 'Predictions',
		description: '',
		fields: '[]',
		settings: JSON.stringify({ enableTimestampProof: true }),
		icon: 'crystal-ball',
		sort_order: 0,
		is_system: 1,
		created_at: '2024-01-01',
		updated_at: '2024-01-01'
	};

	function itemRow(overrides: Record<string, unknown> = {}) {
		return {
			id: 'ci-1',
			content_type_id: 'ct-1',
			slug: 'the-future',
			title: 'The Future',
			status: 'published',
			fields: '{}',
			seo_title: null,
			seo_description: null,
			seo_image: null,
			author_id: null,
			published_at: '2024-01-01T00:00:00.000Z',
			created_at: '2024-01-01',
			updated_at: '2024-01-01',
			timestamp_proof_hash: null,
			timestamp_proof_tsr: null,
			timestamp_proof_requested_at: null,
			timestamp_proof_tsa_url: null,
			timestamp_proof_error: null,
			wayback_snapshot_url: null,
			wayback_checked_at: null,
			resolution_resolved_at: null,
			resolution_resolved_by: null,
			...overrides
		};
	}

	beforeEach(() => {
		vi.resetModules();
		mockDB = {
			prepare: vi.fn().mockReturnThis(),
			bind: vi.fn().mockReturnThis(),
			first: vi.fn(),
			all: vi.fn(),
			run: vi.fn().mockResolvedValue({ success: true }),
			batch: vi.fn()
		};
		mockPlatform = { env: { DB: mockDB } };
		mockLocals = {
			user: {
				id: 'user-1',
				login: 'admin',
				email: 'admin@test.com',
				isOwner: true,
				isAdmin: true
			}
		};
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('POST /api/cms/[type]/[id]/timestamp-retry', () => {
		it('requires authentication', async () => {
			const { POST } =
				await import('../../src/routes/api/cms/[type]/[id]/timestamp-retry/+server.js');
			try {
				await POST({
					platform: mockPlatform,
					locals: { user: null },
					params: { type: 'predictions', id: 'ci-1' }
				} as any);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(401);
			}
		});

		it('requires owner/admin privileges', async () => {
			const { POST } =
				await import('../../src/routes/api/cms/[type]/[id]/timestamp-retry/+server.js');
			try {
				await POST({
					platform: mockPlatform,
					locals: { user: { ...mockLocals.user, isOwner: false, isAdmin: false } },
					params: { type: 'predictions', id: 'ci-1' }
				} as any);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(403);
			}
		});

		it('500s when the database is not available', async () => {
			const { POST } =
				await import('../../src/routes/api/cms/[type]/[id]/timestamp-retry/+server.js');
			try {
				await POST({
					platform: { env: {} },
					locals: mockLocals,
					params: { type: 'predictions', id: 'ci-1' }
				} as any);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(500);
			}
		});

		it('500s on an unexpected internal error', async () => {
			const { POST } =
				await import('../../src/routes/api/cms/[type]/[id]/timestamp-retry/+server.js');
			mockDB.first.mockRejectedValueOnce(new Error('DB fail'));

			try {
				await POST({
					platform: mockPlatform,
					locals: mockLocals,
					params: { type: 'predictions', id: 'ci-1' }
				} as any);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(500);
			}
		});

		it('404s for an unknown content type', async () => {
			const { POST } =
				await import('../../src/routes/api/cms/[type]/[id]/timestamp-retry/+server.js');
			mockDB.first.mockResolvedValueOnce(null);

			try {
				await POST({
					platform: mockPlatform,
					locals: mockLocals,
					params: { type: 'nope', id: 'ci-1' }
				} as any);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(404);
			}
		});

		it('404s for an unknown item', async () => {
			const { POST } =
				await import('../../src/routes/api/cms/[type]/[id]/timestamp-retry/+server.js');
			mockDB.first.mockResolvedValueOnce(contentTypeRow).mockResolvedValueOnce(null);

			try {
				await POST({
					platform: mockPlatform,
					locals: mockLocals,
					params: { type: 'predictions', id: 'nonexistent' }
				} as any);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(404);
			}
		});

		it('400s for an item that has never been published', async () => {
			const { POST } =
				await import('../../src/routes/api/cms/[type]/[id]/timestamp-retry/+server.js');
			mockDB.first
				.mockResolvedValueOnce(contentTypeRow)
				.mockResolvedValueOnce(itemRow({ status: 'draft', published_at: null }));

			try {
				await POST({
					platform: mockPlatform,
					locals: mockLocals,
					params: { type: 'predictions', id: 'ci-1' }
				} as any);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(400);
			}
		});

		it('computes a fresh hash from current fields when none has been recorded yet', async () => {
			// Covers the case where the background waitUntil job never ran (e.g.
			// local dev has no waitUntil support) — locked fields guarantee the
			// current content is identical to what was published, so hashing now
			// is safe and unblocks the admin instead of leaving a dead end.
			const { POST } =
				await import('../../src/routes/api/cms/[type]/[id]/timestamp-retry/+server.js');
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				arrayBuffer: async () => new Uint8Array([0x30, 0x03, 0x30, 0x01, 0x00]).buffer
			});

			mockDB.first
				.mockResolvedValueOnce(contentTypeRow)
				.mockResolvedValueOnce(itemRow({ fields: '{"body":"content"}' }))
				.mockResolvedValueOnce(
					itemRow({ timestamp_proof_hash: 'freshhash', timestamp_proof_tsr: 'AAAA' })
				);

			const response = await POST({
				platform: mockPlatform,
				locals: mockLocals,
				params: { type: 'predictions', id: 'ci-1' }
			} as any);

			expect(response.status).toBe(200);
			// A non-empty hash must have been bound — it was computed, not skipped.
			const boundValues = mockDB.bind.mock.calls.flat();
			expect(boundValues.some((v: unknown) => typeof v === 'string' && v.length === 64)).toBe(true);
		});

		it('400s when a successful proof already exists', async () => {
			const { POST } =
				await import('../../src/routes/api/cms/[type]/[id]/timestamp-retry/+server.js');
			mockDB.first
				.mockResolvedValueOnce(contentTypeRow)
				.mockResolvedValueOnce(
					itemRow({ timestamp_proof_hash: 'abc123', timestamp_proof_tsr: 'dGhpcyBpcyBhIHRlc3Q=' })
				);

			try {
				await POST({
					platform: mockPlatform,
					locals: mockLocals,
					params: { type: 'predictions', id: 'ci-1' }
				} as any);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(400);
			}
		});

		it('re-requests the timestamp using the stored hash and returns the updated item', async () => {
			const { POST } =
				await import('../../src/routes/api/cms/[type]/[id]/timestamp-retry/+server.js');
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				arrayBuffer: async () => new Uint8Array([0x30, 0x03, 0x30, 0x01, 0x00]).buffer
			});

			mockDB.first
				.mockResolvedValueOnce(contentTypeRow)
				.mockResolvedValueOnce(itemRow({ timestamp_proof_hash: 'abc123' }))
				.mockResolvedValueOnce(
					itemRow({ timestamp_proof_hash: 'abc123', timestamp_proof_tsr: 'AAAA' })
				);

			const response = await POST({
				platform: mockPlatform,
				locals: mockLocals,
				params: { type: 'predictions', id: 'ci-1' }
			} as any);

			expect(response.status).toBe(200);
			// Never recomputes the hash — the bound hash value must be the one
			// already stored on the item, not a freshly-computed one.
			const boundValues = mockDB.bind.mock.calls.flat();
			expect(boundValues).toContain('abc123');
			const data = await response.json();
			expect(data.item.timestampProofTsr).toBe('AAAA');
		});
	});

	describe('POST /api/cms/[type]/[id]/wayback-check', () => {
		it('requires authentication', async () => {
			const { POST } =
				await import('../../src/routes/api/cms/[type]/[id]/wayback-check/+server.js');
			try {
				await POST({
					platform: mockPlatform,
					locals: { user: null },
					params: { type: 'predictions', id: 'ci-1' },
					url: new URL('http://localhost/api/cms/predictions/ci-1/wayback-check')
				} as any);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(401);
			}
		});

		it('requires owner/admin privileges', async () => {
			const { POST } =
				await import('../../src/routes/api/cms/[type]/[id]/wayback-check/+server.js');
			try {
				await POST({
					platform: mockPlatform,
					locals: { user: { ...mockLocals.user, isOwner: false, isAdmin: false } },
					params: { type: 'predictions', id: 'ci-1' },
					url: new URL('http://localhost/api/cms/predictions/ci-1/wayback-check')
				} as any);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(403);
			}
		});

		it('500s when the database is not available', async () => {
			const { POST } =
				await import('../../src/routes/api/cms/[type]/[id]/wayback-check/+server.js');
			try {
				await POST({
					platform: { env: {} },
					locals: mockLocals,
					params: { type: 'predictions', id: 'ci-1' },
					url: new URL('http://localhost/api/cms/predictions/ci-1/wayback-check')
				} as any);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(500);
			}
		});

		it('500s on an unexpected internal error', async () => {
			const { POST } =
				await import('../../src/routes/api/cms/[type]/[id]/wayback-check/+server.js');
			mockDB.first.mockRejectedValueOnce(new Error('DB fail'));

			try {
				await POST({
					platform: mockPlatform,
					locals: mockLocals,
					params: { type: 'predictions', id: 'ci-1' },
					url: new URL('http://localhost/api/cms/predictions/ci-1/wayback-check')
				} as any);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(500);
			}
		});

		it('404s for an unknown content type', async () => {
			const { POST } =
				await import('../../src/routes/api/cms/[type]/[id]/wayback-check/+server.js');
			mockDB.first.mockResolvedValueOnce(null);

			try {
				await POST({
					platform: mockPlatform,
					locals: mockLocals,
					params: { type: 'nope', id: 'ci-1' },
					url: new URL('http://localhost/api/cms/nope/ci-1/wayback-check')
				} as any);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(404);
			}
		});

		it('404s for an unknown item', async () => {
			const { POST } =
				await import('../../src/routes/api/cms/[type]/[id]/wayback-check/+server.js');
			mockDB.first.mockResolvedValueOnce(contentTypeRow).mockResolvedValueOnce(null);

			try {
				await POST({
					platform: mockPlatform,
					locals: mockLocals,
					params: { type: 'predictions', id: 'nonexistent' },
					url: new URL('http://localhost/api/cms/predictions/nonexistent/wayback-check')
				} as any);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(404);
			}
		});

		it('400s for an item that has never been published', async () => {
			const { POST } =
				await import('../../src/routes/api/cms/[type]/[id]/wayback-check/+server.js');
			mockDB.first
				.mockResolvedValueOnce(contentTypeRow)
				.mockResolvedValueOnce(itemRow({ status: 'draft', published_at: null }));

			try {
				await POST({
					platform: mockPlatform,
					locals: mockLocals,
					params: { type: 'predictions', id: 'ci-1' },
					url: new URL('http://localhost/api/cms/predictions/ci-1/wayback-check')
				} as any);
				expect.fail('Should have thrown');
			} catch (err: any) {
				expect(err.status).toBe(400);
			}
		});

		it('records a found snapshot and returns the updated item', async () => {
			const { POST } =
				await import('../../src/routes/api/cms/[type]/[id]/wayback-check/+server.js');
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					archived_snapshots: {
						closest: { available: true, url: 'https://web.archive.org/web/2024/https://x' }
					}
				})
			});

			mockDB.first
				.mockResolvedValueOnce(contentTypeRow)
				.mockResolvedValueOnce(itemRow())
				.mockResolvedValueOnce(
					itemRow({ wayback_snapshot_url: 'https://web.archive.org/web/2024/https://x' })
				);

			const response = await POST({
				platform: mockPlatform,
				locals: mockLocals,
				params: { type: 'predictions', id: 'ci-1' },
				url: new URL('http://localhost/api/cms/predictions/ci-1/wayback-check')
			} as any);

			expect(response.status).toBe(200);
			expect(mockDB.run).toHaveBeenCalled();
			const data = await response.json();
			expect(data.item.waybackSnapshotUrl).toBe('https://web.archive.org/web/2024/https://x');
		});

		it('does not record anything when no snapshot is found yet', async () => {
			const { POST } =
				await import('../../src/routes/api/cms/[type]/[id]/wayback-check/+server.js');
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({ archived_snapshots: {} })
			});

			mockDB.first
				.mockResolvedValueOnce(contentTypeRow)
				.mockResolvedValueOnce(itemRow())
				.mockResolvedValueOnce(itemRow());

			const response = await POST({
				platform: mockPlatform,
				locals: mockLocals,
				params: { type: 'predictions', id: 'ci-1' },
				url: new URL('http://localhost/api/cms/predictions/ci-1/wayback-check')
			} as any);

			expect(response.status).toBe(200);
			expect(mockDB.run).not.toHaveBeenCalled();
		});
	});
});
