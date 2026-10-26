import { afterEach, describe, expect, it, vi } from 'vitest';
import worker, {
	BASE_DELAY_MS,
	CRON_PATHS,
	deliver,
	MAX_RETRIES,
	runScheduled,
	SCHEDULED_TIME_HEADER,
	type Dependencies,
	type Env
} from '../../cron-worker/src/index';

const env: Env = { TARGET_URL: 'https://app.example', CRON_SECRET: 's3cret' };
const TICK = Date.parse('2026-10-25T03:17:00Z');

function deps(...responses: Array<number | Error>) {
	const queue = [...responses];
	const sleeps: number[] = [];
	const fetchMock = vi.fn(async () => {
		const next = queue.shift() ?? 200;
		if (next instanceof Error) throw next;
		return new Response('body', { status: next });
	});
	const dependencies: Dependencies = {
		fetch: fetchMock as never,
		sleep: async (ms) => void sleeps.push(ms)
	};
	return { dependencies, fetchMock, sleeps };
}

afterEach(() => vi.restoreAllMocks());

describe('deliver', () => {
	it('POSTs once with the bearer secret and the scheduled time', async () => {
		const { dependencies, fetchMock, sleeps } = deps(200);
		const result = await deliver(env, '/api/cron/lighthouse', TICK, dependencies);
		expect(result).toEqual({ ok: true, status: 200, attempts: 1 });
		expect(sleeps).toEqual([]);
		const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
		expect(String(url)).toBe('https://app.example/api/cron/lighthouse');
		expect(init.method).toBe('POST');
		expect(init.headers).toEqual({
			authorization: 'Bearer s3cret',
			[SCHEDULED_TIME_HEADER]: String(TICK)
		});
	});

	it('retries 5xx three times with exponential backoff, then gives up without throwing', async () => {
		const { dependencies, fetchMock, sleeps } = deps(500, 502, 503, 500);
		const result = await deliver(env, '/api/cron/lighthouse', TICK, dependencies);
		expect(result).toEqual({ ok: false, status: 500, attempts: MAX_RETRIES + 1 });
		expect(fetchMock).toHaveBeenCalledTimes(4);
		expect(sleeps).toEqual([BASE_DELAY_MS, BASE_DELAY_MS * 2, BASE_DELAY_MS * 4]);
	});

	it('stops retrying as soon as an attempt succeeds', async () => {
		const { dependencies, sleeps } = deps(504, 429, 200);
		const result = await deliver(env, '/api/cron/x', TICK, dependencies);
		expect(result).toEqual({ ok: true, status: 200, attempts: 3 });
		expect(sleeps).toHaveLength(2);
	});

	it('retries a network error and reports it if it never recovers', async () => {
		const { dependencies } = deps(
			new Error('socket hang up'),
			new Error('boom'),
			408,
			new Error('last')
		);
		const result = await deliver(env, '/api/cron/x', TICK, dependencies);
		expect(result).toEqual({ ok: false, status: 0, attempts: 4, error: 'last' });
	});

	it('describes a non-Error rejection', async () => {
		const dependencies: Dependencies = {
			fetch: (() => Promise.reject('plain')) as never,
			sleep: async () => {}
		};
		const result = await deliver(env, '/api/cron/x', TICK, dependencies);
		expect(result.error).toBe('plain');
	});

	it('does not retry a 4xx that will not fix itself', async () => {
		for (const status of [400, 401, 404]) {
			const { dependencies, fetchMock } = deps(status);
			const result = await deliver(env, '/api/cron/x', TICK, dependencies);
			expect(result).toEqual({ ok: false, status, attempts: 1 });
			expect(fetchMock).toHaveBeenCalledTimes(1);
		}
	});

	it('survives a body that cannot be read', async () => {
		const dependencies: Dependencies = {
			fetch: (async () => ({
				ok: true,
				status: 200,
				text: () => Promise.reject(new Error('stream'))
			})) as never,
			sleep: async () => {}
		};
		expect(await deliver(env, '/api/cron/x', TICK, dependencies)).toMatchObject({ ok: true });
	});

	it('refuses to call out with a missing secret, a placeholder or a bad URL', async () => {
		const { dependencies, fetchMock } = deps();
		expect((await deliver({ ...env, CRON_SECRET: '' }, '/p', TICK, dependencies)).error).toMatch(
			/CRON_SECRET/
		);
		expect(
			(
				await deliver(
					{ ...env, TARGET_URL: 'https://REPLACE_ME.example' },
					'/p',
					TICK,
					dependencies
				)
			).error
		).toMatch(/TARGET_URL is not set/);
		expect((await deliver({ ...env, TARGET_URL: '' }, '/p', TICK, dependencies)).error).toMatch(
			/not set/
		);
		expect(
			(await deliver({ ...env, TARGET_URL: 'not a url' }, '/p', TICK, dependencies)).error
		).toMatch(/not a valid URL/);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('uses the real fetch and timers by default', async () => {
		vi.useFakeTimers();
		const real = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce(new Response('', { status: 503 }))
			.mockResolvedValueOnce(new Response('', { status: 200 }));
		const pending = deliver(env, '/api/cron/x', TICK);
		await vi.advanceTimersByTimeAsync(BASE_DELAY_MS + 1);
		expect(await pending).toEqual({ ok: true, status: 200, attempts: 2 });
		expect(real).toHaveBeenCalledTimes(2);
		vi.useRealTimers();
	});
});

describe('runScheduled and the scheduled handler', () => {
	it('ignores a cron it has no route for, loudly', async () => {
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		const { dependencies, fetchMock } = deps();
		expect(
			await runScheduled({ cron: '1 1 1 1 1', scheduledTime: TICK }, env, dependencies)
		).toBeNull();
		expect(error).toHaveBeenCalledWith(expect.stringContaining('1 1 1 1 1'));
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('calls the path mapped to the cron and logs the outcome', async () => {
		const log = vi.spyOn(console, 'log').mockImplementation(() => {});
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		const [cron, path] = Object.entries(CRON_PATHS)[0];
		const ok = deps(200);
		await runScheduled({ cron, scheduledTime: TICK }, env, ok.dependencies);
		expect(String((ok.fetchMock.mock.calls[0] as unknown[])[0])).toBe(`https://app.example${path}`);
		expect(log).toHaveBeenCalledWith(expect.stringContaining('ok (200)'));

		const bad = deps(new Error('down'), new Error('down'), new Error('down'), new Error('down'));
		await runScheduled({ cron, scheduledTime: TICK }, env, bad.dependencies);
		expect(error).toHaveBeenCalledWith(expect.stringContaining('failed after 4 attempt(s)'));
	});

	it('hands the work to waitUntil and never throws', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		let work: Promise<unknown> | undefined;
		const ctx = { waitUntil: (p: Promise<unknown>) => void (work = p) };
		await expect(
			worker.scheduled({ cron: 'unmapped', scheduledTime: TICK }, env, ctx)
		).resolves.toBeUndefined();
		// Nothing is mapped to that cron, so there was nothing to deliver.
		await expect(work).resolves.toBeNull();
	});

	it('swallows an unexpected failure inside the delivery', async () => {
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		// A getter that throws makes runScheduled itself reject, past deliver's guards.
		const event = {
			get cron(): string {
				throw new Error('kaboom');
			},
			scheduledTime: TICK
		};
		let work: Promise<unknown> | undefined;
		await worker.scheduled(event, env, { waitUntil: (p) => void (work = p) });
		await expect(work).resolves.toBeUndefined();
		expect(error).toHaveBeenCalledWith('Scheduler failed unexpectedly:', expect.any(Error));
	});
});
