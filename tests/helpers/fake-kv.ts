/** Minimal in-memory KVNamespace for tests that need real read-after-write behavior. */
export function createFakeKV(initial: Record<string, string> = {}) {
	const data = new Map(Object.entries(initial));
	return {
		data,
		get: async (key: string) => data.get(key) ?? null,
		put: async (key: string, value: string) => {
			data.set(key, value);
		},
		delete: async (key: string) => {
			data.delete(key);
		}
	};
}

export type FakeKV = ReturnType<typeof createFakeKV>;

/** A valid root key (32 bytes) for tests that need the operator-key path. */
export const TEST_ENCRYPTION_KEY = btoa('0123456789abcdef0123456789abcdef');
