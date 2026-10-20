import { afterEach, describe, expect, it, vi } from 'vitest';
import { readdirSync } from 'node:fs';
import { shellModules } from './catalog';
import { trackWidth } from './dom';

describe('trackWidth', () => {
	const original = globalThis.ResizeObserver;
	afterEach(() => {
		globalThis.ResizeObserver = original;
	});

	function box(width: number) {
		const node = document.createElement('div');
		Object.defineProperty(node, 'clientWidth', { configurable: true, get: () => width });
		return node;
	}

	it('reports the width now, on every resize, and stops on destroy', () => {
		let notify: () => void = () => {};
		const disconnect = vi.fn();
		globalThis.ResizeObserver = class {
			constructor(cb: () => void) {
				notify = cb;
			}
			observe() {}
			unobserve() {}
			disconnect = disconnect;
		} as unknown as typeof ResizeObserver;
		const seen: number[] = [];
		let width = 120;
		const node = document.createElement('div');
		Object.defineProperty(node, 'clientWidth', { configurable: true, get: () => width });
		const action = trackWidth(node, (w) => seen.push(w));
		width = 340;
		notify();
		expect(seen).toEqual([120, 340]);
		(action as { destroy: () => void }).destroy();
		expect(disconnect).toHaveBeenCalled();
	});

	it('reports once where ResizeObserver is missing', () => {
		// @ts-expect-error simulate an old environment
		delete globalThis.ResizeObserver;
		const seen: number[] = [];
		const action = trackWidth(box(200), (w) => seen.push(w));
		expect(seen).toEqual([200]);
		expect(action).toEqual({});
	});
});

describe('shell catalog', () => {
	it('lists every component in the folder, once', () => {
		const files = readdirSync('src/lib/modules/shell')
			.filter((f) => f.endsWith('.svelte'))
			.map((f) => f.replace('.svelte', ''))
			.sort();
		expect(shellModules.map((m) => m.name).sort()).toEqual(files);
		expect(shellModules.every((m) => m.group === 'App shell')).toBe(true);
		expect(files.length).toBe(13);
	});
});
