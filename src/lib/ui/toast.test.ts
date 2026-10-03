import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from './toast';

describe('toast', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		toast.clear();
		vi.useRealTimers();
	});

	it('queues messages with a tone, in order', () => {
		toast.info('one');
		toast.success('two');
		toast.warning('three');
		toast.danger('four');
		expect(get(toast).map((t) => [t.message, t.tone])).toEqual([
			['one', 'info'],
			['two', 'success'],
			['three', 'warning'],
			['four', 'danger']
		]);
	});

	it('closes itself after its duration', () => {
		toast.push('brief', 'info', 1000);
		vi.advanceTimersByTime(999);
		expect(get(toast)).toHaveLength(1);
		vi.advanceTimersByTime(1);
		expect(get(toast)).toHaveLength(0);
	});

	it('stays when the duration is 0, until dismissed', () => {
		const id = toast.push('sticky', 'info', 0);
		vi.advanceTimersByTime(60_000);
		expect(get(toast)).toHaveLength(1);
		toast.dismiss(id);
		expect(get(toast)).toHaveLength(0);
	});

	it('dismissing early cancels the timer, and clear empties everything', () => {
		const id = toast.push('a');
		toast.push('b');
		toast.dismiss(id);
		expect(get(toast).map((t) => t.message)).toEqual(['b']);
		toast.clear();
		vi.advanceTimersByTime(10_000);
		expect(get(toast)).toEqual([]);
	});
});
