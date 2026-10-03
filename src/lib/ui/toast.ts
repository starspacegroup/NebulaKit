/**
 * Toasts — brief, non-blocking messages.
 *
 * A store, so anything can raise one (`toast.success('Saved')`) and one
 * `<Toaster />` in the layout shows them all. Each closes itself after
 * `duration` ms; 0 keeps it until it is dismissed.
 */
import { writable } from 'svelte/store';

export type ToastTone = 'info' | 'success' | 'warning' | 'danger';

export interface Toast {
	id: number;
	message: string;
	tone: ToastTone;
	duration: number;
}

const { subscribe, update, set } = writable<Toast[]>([]);
let next = 0;
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function dismiss(id: number): void {
	const timer = timers.get(id);
	if (timer) clearTimeout(timer);
	timers.delete(id);
	update((all) => all.filter((t) => t.id !== id));
}

function push(message: string, tone: ToastTone = 'info', duration = 5000): number {
	next += 1;
	const id = next;
	update((all) => [...all, { id, message, tone, duration }]);
	if (duration > 0)
		timers.set(
			id,
			setTimeout(() => dismiss(id), duration)
		);
	return id;
}

function clear(): void {
	for (const timer of timers.values()) clearTimeout(timer);
	timers.clear();
	set([]);
}

export const toast = {
	subscribe,
	push,
	dismiss,
	clear,
	info: (message: string, duration?: number) => push(message, 'info', duration),
	success: (message: string, duration?: number) => push(message, 'success', duration),
	warning: (message: string, duration?: number) => push(message, 'warning', duration),
	danger: (message: string, duration?: number) => push(message, 'danger', duration)
};
