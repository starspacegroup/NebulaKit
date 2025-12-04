import { writable } from 'svelte/store';

/**
 * Store to control the command palette visibility from anywhere in the app.
 * This allows pages like the home page hero to open the same command palette
 * that's rendered in the layout.
 */
export const showCommandPalette = writable(false);

export function openCommandPalette() {
	showCommandPalette.set(true);
}

export function closeCommandPalette() {
	showCommandPalette.set(false);
}

export function toggleCommandPalette() {
	showCommandPalette.update((v) => !v);
}
