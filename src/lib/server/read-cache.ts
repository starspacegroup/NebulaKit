/**
 * Read cache for public pages: memory plus Cloudflare's Cache API, with a stale copy served when the
 * database fails. Born from PinFool (docs/LESSONS_FROM_PINFOOL.md, docs/FREE_TIER_GUARD_RAILS.md):
 * on the Workers free plan D1 allows 5M row reads a day and KV only 1,000 writes a day, and both
 * are hard walls. This cache uses neither KV nor a D1 table, so it has no daily quota of its own.
 *
 *   const items = await cached('shop:home', () => listProducts(db, { limit: 50 }));
 *
 * Rules the helper enforces so a caller cannot get them wrong:
 *  - Outside Workers (vitest, plain dev) there is no Cache API and `fn` simply runs.
 *  - A failing `fn` returns the last good copy from memory if there is one, else rethrows.
 *  - Memory is bounded (`MAX_ENTRIES`, oldest dropped) so a crawler walking per-item keys cannot
 *    grow it without limit. Prefer few shared keys (counts, one list) to one key per item anyway.
 *  - Nothing here may be used for per-user data: the key is the only thing that varies.
 */

/** Default freshness window. Admin edits show within this long. */
export const CACHE_SECONDS = 300;
/** Most keys kept in memory per running instance. */
export const MAX_ENTRIES = 500;

interface Entry {
	at: number;
	value: unknown;
}

/** The two things the cache reads from the outside world; replaced in tests. */
export interface CacheEnv {
	now: () => number;
	/** The Cache API default cache, or null when there is none (tests, plain dev). */
	edge: () => Cache | null;
}

const realEnv: CacheEnv = {
	now: () => Date.now(),
	edge: () => {
		if (typeof caches === 'undefined') return null;
		return (caches as unknown as { default?: Cache }).default ?? null;
	}
};

/** One cache instance. The module-level `cached` is `createReadCache()`; tests build their own. */
export function createReadCache(env: CacheEnv = realEnv, maxEntries = MAX_ENTRIES) {
	const memory = new Map<string, Entry>();

	function remember(key: string, entry: Entry) {
		// Re-insert so Map order tracks recency; drop the oldest past the cap.
		memory.delete(key);
		memory.set(key, entry);
		for (const oldest of memory.keys()) {
			if (memory.size <= maxEntries) break;
			memory.delete(oldest);
		}
	}

	async function cached<T>(
		key: string,
		fn: () => Promise<T>,
		seconds: number = CACHE_SECONDS
	): Promise<T> {
		const edge = env.edge();
		if (!edge) return fn();
		const now = env.now();
		const mem = memory.get(key);
		if (mem && now - mem.at < seconds * 1000) return mem.value as T;
		const request = new Request(`https://read-cache.invalid/${encodeURIComponent(key)}`);
		try {
			const hit = await edge.match(request);
			if (hit) {
				const value = (await hit.json()) as T;
				remember(key, { at: now, value });
				return value;
			}
		} catch {
			// fall through to a live read
		}
		let fresh: T;
		try {
			fresh = await fn();
		} catch (err) {
			if (mem) return mem.value as T; // serve stale rather than fail the page
			throw err;
		}
		remember(key, { at: now, value: fresh });
		try {
			await edge.put(
				request,
				new Response(JSON.stringify(fresh), {
					headers: {
						'content-type': 'application/json',
						'cache-control': `public, max-age=${seconds}`
					}
				})
			);
		} catch {
			// the cache is only an optimisation
		}
		return fresh;
	}

	return { cached, size: () => memory.size, clear: () => memory.clear() };
}

const shared = createReadCache();

/** Run `fn`, reusing its result for `seconds` (see the file comment). */
export const cached = shared.cached;
/** Tests only. */
export const _resetReadCache = shared.clear;
