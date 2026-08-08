import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/svelte';
import { Storage } from 'happy-dom';
import { writable } from 'svelte/store';
import { afterEach, vi } from 'vitest';

// Web Storage: make sure `localStorage`/`sessionStorage` are real Storage objects.
//
// Node 22 added its own experimental Web Storage globals, and from Node 25 they
// are on by default. Started without a valid `--localstorage-file`, Node still
// defines the global — as an inert empty object with no methods — and that
// shadows the one happy-dom installs. Every `localStorage.getItem()` or
// `.clear()` in a test then dies with "is not a function", including at import
// time for any module that reads storage while initializing (which took out
// whole suites at collection, not just individual tests).
//
// This is why the failures were local-only: CI runs an older Node with no such
// global, so happy-dom's Storage survives there.
//
// Install happy-dom's own Storage whenever what's on the global isn't usable,
// so the suite behaves the same on every Node version.
for (const key of ['localStorage', 'sessionStorage'] as const) {
	const storage = new Storage();
	// `window` and `globalThis` are usually the same object under happy-dom, but
	// don't rely on that. Node-only test files intentionally have no `window`.
	const targets = new Set<object>([globalThis]);
	if (typeof window !== 'undefined') targets.add(window);
	for (const target of targets) {
		Object.defineProperty(target, key, { value: storage, configurable: true, writable: true });
	}
}

// Provide a default $app/stores mock so components using $page (e.g. SharingMeta) work in tests.
// Individual test files can override this with their own vi.mock('$app/stores', ...).
vi.mock('$app/stores', () => ({
	page: writable({
		url: new URL('http://localhost'),
		params: {},
		status: 200,
		error: null
	}),
	navigating: writable(null),
	updated: { check: () => Promise.resolve(false), subscribe: writable(false).subscribe }
}));

// Cleanup after each test
afterEach(() => {
	cleanup();
});

// Setup global test utilities
globalThis.ResizeObserver = class ResizeObserver {
	observe() {}
	unobserve() {}
	disconnect() {}
};

// Mock IntersectionObserver
globalThis.IntersectionObserver = class IntersectionObserver {
	constructor() {}
	observe() {}
	unobserve() {}
	disconnect() {}
} as any;

// Svelte 5 implements transitions with the Web Animations API. happy-dom does
// not provide it yet, so complete animations on a microtask after Svelte has
// attached its `onfinish` callback.
if (typeof Element !== 'undefined' && typeof Element.prototype.animate !== 'function') {
	Object.defineProperty(Element.prototype, 'animate', {
		configurable: true,
		value: function animate(): Animation {
			const animation = {
				cancel: vi.fn(),
				currentTime: 0,
				effect: null,
				onfinish: null as ((event: AnimationPlaybackEvent) => void) | null,
				playState: 'finished'
			};

			queueMicrotask(() => animation.onfinish?.(new Event('finish') as AnimationPlaybackEvent));
			return animation as unknown as Animation;
		}
	});
}

// Mock matchMedia
if (typeof window !== 'undefined') {
	Object.defineProperty(window, 'matchMedia', {
		writable: true,
		value: (query: string) => ({
			matches: false,
			media: query,
			onchange: null,
			addListener: () => {},
			removeListener: () => {},
			addEventListener: () => {},
			removeEventListener: () => {},
			dispatchEvent: () => true
		})
	});
}
