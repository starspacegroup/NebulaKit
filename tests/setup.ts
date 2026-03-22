import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/svelte';
import { writable } from 'svelte/store';
import { afterEach, vi } from 'vitest';

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
