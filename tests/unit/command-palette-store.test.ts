import {
	closeCommandPalette,
	openCommandPalette,
	showCommandPalette,
	toggleCommandPalette
} from '$lib/stores/commandPalette';
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('Command Palette Store', () => {
	beforeEach(() => {
		showCommandPalette.set(false);
	});

	afterEach(() => {
		showCommandPalette.set(false);
	});

	describe('Initial state', () => {
		it('should be closed initially', () => {
			expect(get(showCommandPalette)).toBe(false);
		});
	});

	describe('openCommandPalette', () => {
		it('should open the command palette', () => {
			openCommandPalette();
			expect(get(showCommandPalette)).toBe(true);
		});

		it('should keep it open if already open', () => {
			showCommandPalette.set(true);
			openCommandPalette();
			expect(get(showCommandPalette)).toBe(true);
		});
	});

	describe('closeCommandPalette', () => {
		it('should close the command palette', () => {
			showCommandPalette.set(true);
			closeCommandPalette();
			expect(get(showCommandPalette)).toBe(false);
		});

		it('should keep it closed if already closed', () => {
			closeCommandPalette();
			expect(get(showCommandPalette)).toBe(false);
		});
	});

	describe('toggleCommandPalette', () => {
		it('should open the command palette if closed', () => {
			toggleCommandPalette();
			expect(get(showCommandPalette)).toBe(true);
		});

		it('should close the command palette if open', () => {
			showCommandPalette.set(true);
			toggleCommandPalette();
			expect(get(showCommandPalette)).toBe(false);
		});

		it('should toggle multiple times correctly', () => {
			toggleCommandPalette();
			expect(get(showCommandPalette)).toBe(true);

			toggleCommandPalette();
			expect(get(showCommandPalette)).toBe(false);

			toggleCommandPalette();
			expect(get(showCommandPalette)).toBe(true);
		});
	});
});
