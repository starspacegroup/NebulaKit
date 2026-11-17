import { describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import {
	_resetReadCache,
	cached,
	createReadCache,
	MAX_ENTRIES,
	type CacheEnv
} from '../../src/lib/server/read-cache';

/** A fake Cache API that honours `cache-control: max-age`, like the real one, against a fake clock. */
function fakeEdge(now: { t: number } = { t: 0 }) {
	const store = new Map<string, { body: string; expires: number }>();
	const edge = {
		match: async (req: Request) => {
			const hit = store.get(req.url);
			return hit && now.t < hit.expires ? new Response(hit.body) : undefined;
		},
		put: async (req: Request, res: Response) => {
			const age = Number(/max-age=(\d+)/.exec(res.headers.get('cache-control') ?? '')?.[1] ?? 0);
			store.set(req.url, { body: await res.text(), expires: now.t + age * 1000 });
		}
	} as unknown as Cache;
	return { edge, store };
}

function env(now: { t: number }, edge: Cache | null): CacheEnv {
	return { now: () => now.t, edge: () => edge };
}

describe('read cache', () => {
	it('is a passthrough when there is no Cache API', async () => {
		const c = createReadCache(env({ t: 0 }, null));
		const fn = vi.fn().mockResolvedValue(1);
		await c.cached('k', fn);
		await c.cached('k', fn);
		expect(fn).toHaveBeenCalledTimes(2);
	});

	it('reuses a value inside the window and refreshes after it', async () => {
		const now = { t: 0 };
		const c = createReadCache(env(now, fakeEdge(now).edge));
		const fn = vi.fn().mockResolvedValueOnce('a').mockResolvedValueOnce('b');
		expect(await c.cached('k', fn, 60)).toBe('a');
		now.t = 59_000;
		expect(await c.cached('k', fn, 60)).toBe('a');
		now.t = 61_000;
		expect(await c.cached('k', fn, 60)).toBe('b');
		expect(fn).toHaveBeenCalledTimes(2);
	});

	it('serves the stale copy when the database fails, and throws when there is none', async () => {
		const now = { t: 0 };
		const c = createReadCache(env(now, fakeEdge(now).edge));
		await c.cached('k', async () => 'good', 10);
		now.t = 20_000;
		expect(
			await c.cached(
				'k',
				async () => {
					throw new Error('D1 exceeded its daily row read limit');
				},
				10
			)
		).toBe('good');
		await expect(
			c.cached('other', async () => {
				throw new Error('boom');
			})
		).rejects.toThrow('boom');
	});

	it('survives a broken Cache API (match and put both throw)', async () => {
		const edge = {
			match: async () => {
				throw new Error('cache down');
			},
			put: async () => {
				throw new Error('cache down');
			}
		} as unknown as Cache;
		const c = createReadCache(env({ t: 0 }, edge));
		expect(await c.cached('k', async () => 7)).toBe(7);
	});

	it('uses the edge copy another instance wrote', async () => {
		const shared = fakeEdge();
		const a = createReadCache(env({ t: 0 }, shared.edge));
		const b = createReadCache(env({ t: 0 }, shared.edge));
		await a.cached('k', async () => ({ n: 1 }));
		const fn = vi.fn().mockResolvedValue({ n: 2 });
		expect(await b.cached('k', fn)).toEqual({ n: 1 });
		expect(fn).not.toHaveBeenCalled();
	});

	it('property: memory never exceeds the cap, whatever keys arrive', async () => {
		await fc.assert(
			fc.asyncProperty(fc.array(fc.string({ maxLength: 8 }), { maxLength: 80 }), async (keys) => {
				const c = createReadCache(env({ t: 0 }, fakeEdge().edge), 10);
				for (const k of keys) await c.cached(k, async () => k);
				expect(c.size()).toBeLessThanOrEqual(10);
			}),
			{ numRuns: 50 }
		);
		expect(MAX_ENTRIES).toBeGreaterThan(0);
	});

	it('property: within one window a key costs at most one database read, in any order', async () => {
		await fc.assert(
			fc.asyncProperty(
				fc.array(fc.constantFrom('a', 'b', 'c', 'd'), { minLength: 1, maxLength: 60 }),
				async (keys) => {
					const c = createReadCache(env({ t: 0 }, fakeEdge().edge));
					const calls = new Map<string, number>();
					for (const k of keys) {
						const v = await c.cached(k, async () => {
							calls.set(k, (calls.get(k) ?? 0) + 1);
							return k;
						});
						expect(v).toBe(k);
					}
					for (const n of calls.values()) expect(n).toBe(1);
				}
			),
			{ numRuns: 60 }
		);
	});

	it('property: a failing database never turns a cached key into an error', async () => {
		await fc.assert(
			fc.asyncProperty(fc.array(fc.boolean(), { minLength: 1, maxLength: 30 }), async (fails) => {
				const now = { t: 0 };
				const c = createReadCache(env(now, fakeEdge(now).edge));
				await c.cached('k', async () => 'seed', 1);
				for (const fail of fails) {
					now.t += 5_000; // always past the window
					const v = await c.cached(
						'k',
						async () => {
							if (fail) throw new Error('down');
							return 'seed';
						},
						1
					);
					expect(v).toBe('seed');
				}
			}),
			{ numRuns: 40 }
		);
	});

	it('the shared cache runs fn when the runtime has no Cache API, and uses it when it has one', async () => {
		_resetReadCache();
		const fn = vi.fn().mockResolvedValue('v');
		await cached('shared', fn);
		await cached('shared', fn);
		expect(fn).toHaveBeenCalledTimes(2); // vitest/node: no `caches`, so a passthrough

		const store = new Map<string, string>();
		vi.stubGlobal('caches', {
			default: {
				match: async (r: Request) => (store.has(r.url) ? new Response(store.get(r.url)!) : undefined),
				put: async (r: Request, res: Response) => void store.set(r.url, await res.text())
			}
		});
		try {
			const g = vi.fn().mockResolvedValue({ ok: 1 });
			expect(await cached('shared2', g)).toEqual({ ok: 1 });
			expect(await cached('shared2', g)).toEqual({ ok: 1 });
			expect(g).toHaveBeenCalledTimes(1);
			// a runtime whose `caches` has no default store is treated as no cache
			vi.stubGlobal('caches', {});
			const h = vi.fn().mockResolvedValue(1);
			await cached('shared3', h);
			await cached('shared3', h);
			expect(h).toHaveBeenCalledTimes(2);
		} finally {
			vi.unstubAllGlobals();
			_resetReadCache();
		}
	});

	it('a cap of zero keeps nothing in memory', async () => {
		const c = createReadCache(env({ t: 0 }, fakeEdge().edge), 0);
		await c.cached('k', async () => 1);
		expect(c.size()).toBe(0);
	});
});
