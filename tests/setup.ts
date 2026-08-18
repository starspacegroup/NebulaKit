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
	const current: unknown = (globalThis as Record<string, unknown>)[key];
	if (current && typeof (current as globalThis.Storage).getItem === 'function') continue;

	const storage = new Storage();
	// `window` and `globalThis` are the same object under happy-dom, but don't
	// rely on that — a Set keeps this correct either way without double-defining.
	for (const target of new Set<object>([globalThis, window])) {
		Object.defineProperty(target, key, { value: storage, configurable: true, writable: true });
	}
}

// happy-dom's `document.createTextNode` does not stringify its argument, so a
// numeric 0 becomes an EMPTY text node: `{count}` in a Svelte template renders
// as nothing whenever the count is zero, and a test asserting on "0" fails
// against markup that is correct in every real browser (the DOM spec types the
// argument as a DOMString, so browsers coerce it).
//
// Symptom if this is removed: a stat tile showing "%" instead of "0%", or a
// counter rendering blank — but only under test.
const createTextNode = document.createTextNode.bind(document);
document.createTextNode = ((data: unknown) =>
	createTextNode(String(data))) as typeof document.createTextNode;

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

// Mock matchMedia
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
