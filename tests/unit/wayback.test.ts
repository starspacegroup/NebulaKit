/**
 * Tests for the Wayback Machine integration ($lib/timestamp/wayback)
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkWaybackSnapshot, triggerWaybackCapture } from '../../src/lib/timestamp/wayback';

afterEach(() => {
	vi.restoreAllMocks();
});

describe('triggerWaybackCapture', () => {
	it('fires a GET request to the save endpoint with the encoded URL', async () => {
		const fetchMock = vi.fn().mockResolvedValue({ ok: true });
		globalThis.fetch = fetchMock;

		await triggerWaybackCapture('https://davis9001.dev/predictions/foo');

		expect(fetchMock).toHaveBeenCalledWith(
			'https://web.archive.org/save/https%3A%2F%2Fdavis9001.dev%2Fpredictions%2Ffoo',
			{ method: 'GET' }
		);
	});

	it('swallows a network error without throwing', async () => {
		globalThis.fetch = vi.fn().mockRejectedValue(new Error('offline'));

		await expect(triggerWaybackCapture('https://example.test')).resolves.toBeUndefined();
	});

	it('swallows a non-ok response without throwing', async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({ ok: false });

		await expect(triggerWaybackCapture('https://example.test')).resolves.toBeUndefined();
	});
});

describe('checkWaybackSnapshot', () => {
	it('returns the snapshot URL when one is available', async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				archived_snapshots: {
					closest: {
						available: true,
						url: 'https://web.archive.org/web/20270101000000/https://example.test'
					}
				}
			})
		});

		const result = await checkWaybackSnapshot('https://example.test', '20270101');

		expect(result).toEqual({
			ok: true,
			snapshotUrl: 'https://web.archive.org/web/20270101000000/https://example.test'
		});
	});

	it('includes the timestamp param when given', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ archived_snapshots: {} })
		});
		globalThis.fetch = fetchMock;

		await checkWaybackSnapshot('https://example.test', '20270101');

		const [url] = fetchMock.mock.calls[0];
		expect(url).toContain('timestamp=20270101');
		expect(url).toContain('url=https%3A%2F%2Fexample.test');
	});

	it('omits the timestamp param when not given', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ archived_snapshots: {} })
		});
		globalThis.fetch = fetchMock;

		await checkWaybackSnapshot('https://example.test');

		const [url] = fetchMock.mock.calls[0];
		expect(url).not.toContain('timestamp=');
	});

	it('returns ok:false when no snapshot is available', async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ archived_snapshots: {} })
		});

		expect(await checkWaybackSnapshot('https://example.test')).toEqual({ ok: false });
	});

	it('returns ok:false when closest.available is false', async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ archived_snapshots: { closest: { available: false } } })
		});

		expect(await checkWaybackSnapshot('https://example.test')).toEqual({ ok: false });
	});

	it('returns ok:false on HTTP failure', async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({ ok: false });

		expect(await checkWaybackSnapshot('https://example.test')).toEqual({ ok: false });
	});

	it('returns ok:false when fetch throws', async () => {
		globalThis.fetch = vi.fn().mockRejectedValue(new Error('offline'));

		expect(await checkWaybackSnapshot('https://example.test')).toEqual({ ok: false });
	});
});
