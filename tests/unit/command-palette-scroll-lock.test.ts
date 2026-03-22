import { cleanup, render } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CommandPalette from '../../src/lib/components/CommandPalette.svelte';

// Mock $app/environment
vi.mock('$app/environment', () => ({
	browser: true
}));

// Mock $app/navigation
vi.mock('$app/navigation', () => ({
	goto: vi.fn()
}));

describe('CommandPalette scroll lock', () => {
	beforeEach(() => {
		document.body.style.overflow = '';
	});

	afterEach(() => {
		document.body.style.overflow = '';
	});

	it('should lock body scroll when opened, unlock when closed, and clean up on destroy', async () => {
		const { component } = render(CommandPalette, { props: { show: false, hasAIProviders: false } });

		// Initially no scroll lock
		expect(document.body.style.overflow).toBe('');

		// Open: should lock scroll
		await component.$set({ show: true });
		await tick();
		expect(document.body.getAttribute('style')).toContain('overflow: hidden');

		// Close: should unlock scroll
		await component.$set({ show: false });
		await tick();
		const styleAfterClose = document.body.getAttribute('style');
		expect(!styleAfterClose || !styleAfterClose.includes('overflow: hidden')).toBe(true);

		// Re-open and destroy: should clean up
		await component.$set({ show: true });
		await tick();
		expect(document.body.getAttribute('style')).toContain('overflow: hidden');

		cleanup();
		expect(document.body.style.overflow).toBe('');
	});

	it('should redirect wheel events on backdrop to the commands container', async () => {
		const { component, container } = render(CommandPalette, {
			props: { show: false, hasAIProviders: false }
		});

		await component.$set({ show: true });
		await tick();

		const backdrop = container.querySelector('.backdrop') as HTMLElement;
		const commandsDiv = container.querySelector('.commands') as HTMLElement;

		expect(backdrop).toBeTruthy();
		expect(commandsDiv).toBeTruthy();

		// Initial scrollTop is 0
		expect(commandsDiv.scrollTop).toBe(0);

		// Dispatch a wheel event on the backdrop
		const wheelEvent = new WheelEvent('wheel', {
			deltaY: 100,
			bubbles: true,
			cancelable: true
		});
		backdrop.dispatchEvent(wheelEvent);

		// The event should have been prevented (redirected)
		expect(wheelEvent.defaultPrevented).toBe(true);
	});
});
