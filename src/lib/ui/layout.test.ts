import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import Harness from '../../../tests/fixtures/UiKitLayoutHarness.svelte';
import AspectRatio from './AspectRatio.svelte';
import Container from './Container.svelte';
import Separator from './Separator.svelte';
import Stack from './Stack.svelte';

/** The last value the harness reported for an event or bound prop. */
function last(spy: ReturnType<typeof vi.fn>, name: string) {
	const calls = spy.mock.calls.filter(([n]) => n === name);
	return calls.length ? calls[calls.length - 1][1] : undefined;
}

describe('Separator', () => {
	it('is decorative by default, and a real separator on request', () => {
		const { container, unmount } = render(Separator);
		expect(container.querySelector('[role="none"]')).toBeTruthy();
		expect(screen.queryByRole('separator')).toBeNull();
		unmount();
		render(Separator, { props: { decorative: false, orientation: 'vertical' } });
		const line = screen.getByRole('separator');
		expect(line.getAttribute('aria-orientation')).toBe('vertical');
		expect(line.classList.contains('separator--vertical')).toBe(true);
	});

	it('shows a label on a horizontal line', () => {
		render(Separator, { props: { label: 'or', decorative: false } });
		const line = screen.getByRole('separator', { name: 'or' });
		expect(line.getAttribute('aria-orientation')).toBe('horizontal');
		expect(line.textContent).toContain('or');
	});
});

describe('layout primitives', () => {
	it('AspectRatio parses its ratio into CSS aspect-ratio', () => {
		const { container } = render(AspectRatio, { props: { ratio: '4/2' } });
		expect(container.querySelector('.aspect-ratio')?.getAttribute('style')).toContain(
			'aspect-ratio: 2'
		);
	});

	it('Container maps its size to a max width and renders as a landmark', () => {
		const { container } = render(Container, { props: { size: 'sm', as: 'main' } });
		const main = container.querySelector('main.layout-container')!;
		expect(main.getAttribute('style')).toContain('max-width: 40rem');
	});

	it('Stack maps gap, align, justify and wrap to flex styles', () => {
		const { container } = render(Stack, {
			props: {
				direction: 'row',
				gap: 'lg',
				align: 'center',
				justify: 'between',
				wrap: true,
				as: 'ul'
			}
		});
		const style = container.querySelector('ul.layout-stack')!.getAttribute('style')!;
		expect(style).toContain('flex-direction: row');
		expect(style).toContain('gap: var(--spacing-lg)');
		expect(style).toContain('align-items: center');
		expect(style).toContain('justify-content: space-between');
		expect(style).toContain('flex-wrap: wrap');
	});

	it('ButtonGroup is a labelled group of the buttons in its slot', () => {
		render(Harness, { props: { which: 'group', props: { orientation: 'vertical' } } });
		const group = screen.getByRole('group', { name: 'Text alignment' });
		expect(group.classList.contains('button-group--vertical')).toBe(true);
		expect(group.querySelectorAll('button')).toHaveLength(3);
	});
});

describe('Collapsible', () => {
	it('toggles its region and says so on the trigger', async () => {
		const onEvent = vi.fn();
		render(Harness, { props: { which: 'collapse', onEvent } });
		const trigger = screen.getByRole('button', { name: 'Show details' });
		expect(trigger.getAttribute('aria-expanded')).toBe('false');
		const region = document.getElementById(trigger.getAttribute('aria-controls')!)!;
		expect(region.textContent).toContain('More');
		await fireEvent.click(trigger);
		expect(trigger.getAttribute('aria-expanded')).toBe('true');
		expect(last(onEvent, 'toggle')).toEqual({ open: true });
		expect(last(onEvent, 'open')).toBe(true);
		await fireEvent.click(trigger);
		expect(last(onEvent, 'open')).toBe(false);
	});
});

describe('ScrollArea', () => {
	function metrics(el: HTMLElement, values: Record<string, number>) {
		for (const [key, value] of Object.entries(values)) {
			Object.defineProperty(el, key, { value, configurable: true });
		}
	}

	it('is a labelled, focusable region', () => {
		render(Harness, { props: { which: 'scroll' } });
		const region = screen.getByRole('region', { name: 'Release notes' });
		expect(region.getAttribute('tabindex')).toBe('0');
		expect(region.getAttribute('style')).toContain('max-height: 5rem');
	});

	it('shows a shadow only at edges with more to scroll', async () => {
		const { container } = render(Harness, { props: { which: 'scroll' } });
		const region = screen.getByRole('region');
		const root = container.querySelector('.scroll-area')!;
		metrics(region, {
			scrollTop: 0,
			scrollLeft: 0,
			scrollHeight: 300,
			scrollWidth: 400,
			clientHeight: 100,
			clientWidth: 100
		});
		await fireEvent.scroll(region);
		expect(root.classList.contains('scroll-area--bottom')).toBe(true);
		expect(root.classList.contains('scroll-area--top')).toBe(false);
		// Vertical only: the wide content's sideways overflow is not shown.
		expect(root.classList.contains('scroll-area--right')).toBe(false);
		metrics(region, { scrollTop: 200 });
		await fireEvent.scroll(region);
		expect(root.classList.contains('scroll-area--top')).toBe(true);
		expect(root.classList.contains('scroll-area--bottom')).toBe(false);
	});

	it('watches the horizontal edges when it scrolls that way', async () => {
		const { container } = render(Harness, {
			props: { which: 'scroll', props: { direction: 'horizontal' } }
		});
		const region = screen.getByRole('region');
		metrics(region, {
			scrollTop: 0,
			scrollLeft: 0,
			scrollHeight: 300,
			scrollWidth: 400,
			clientHeight: 100,
			clientWidth: 100
		});
		await fireEvent(window, new Event('resize'));
		const root = container.querySelector('.scroll-area')!;
		expect(root.classList.contains('scroll-area--right')).toBe(true);
		expect(root.classList.contains('scroll-area--bottom')).toBe(false);
	});
});

describe('Resizable', () => {
	it('is a window splitter wired to the pane it sizes', () => {
		render(Harness, { props: { which: 'split' } });
		const handle = screen.getByRole('separator', { name: 'Resize panes' });
		expect(handle.getAttribute('aria-valuenow')).toBe('50');
		expect(handle.getAttribute('aria-valuemin')).toBe('20');
		expect(handle.getAttribute('aria-valuemax')).toBe('80');
		expect(handle.getAttribute('aria-orientation')).toBe('vertical');
		const pane = document.getElementById(handle.getAttribute('aria-controls')!)!;
		expect(pane.textContent).toContain('Files');
		expect(pane.getAttribute('style')).toContain('flex-basis: 50%');
	});

	it('moves with the keyboard, collapses and restores with Enter', async () => {
		const onEvent = vi.fn();
		render(Harness, { props: { which: 'split', onEvent } });
		const handle = screen.getByRole('separator');
		await fireEvent.keyDown(handle, { key: 'ArrowRight' });
		expect(handle.getAttribute('aria-valuenow')).toBe('55');
		expect(last(onEvent, 'change')).toEqual({ size: 55 });
		expect(last(onEvent, 'size')).toBe(55);
		await fireEvent.keyDown(handle, { key: 'ArrowLeft' });
		expect(last(onEvent, 'size')).toBe(50);
		await fireEvent.keyDown(handle, { key: 'End' });
		expect(handle.getAttribute('aria-valuenow')).toBe('80');
		await fireEvent.keyDown(handle, { key: 'Enter' });
		expect(handle.getAttribute('aria-valuenow')).toBe('20');
		await fireEvent.keyDown(handle, { key: 'Enter' });
		expect(handle.getAttribute('aria-valuenow')).toBe('80');
		await fireEvent.keyDown(handle, { key: 'Home' });
		expect(handle.getAttribute('aria-valuenow')).toBe('20');
		// Already at the limit: no change to report.
		const changes = onEvent.mock.calls.filter(([n]) => n === 'change').length;
		await fireEvent.keyDown(handle, { key: 'Home' });
		expect(onEvent.mock.calls.filter(([n]) => n === 'change')).toHaveLength(changes);
		await fireEvent.keyDown(handle, { key: 'x' });
		expect(handle.getAttribute('aria-valuenow')).toBe('20');
	});

	it('uses Up and Down when the panes are stacked', async () => {
		render(Harness, { props: { which: 'split', props: { orientation: 'vertical' } } });
		const handle = screen.getByRole('separator');
		expect(handle.getAttribute('aria-orientation')).toBe('horizontal');
		await fireEvent.keyDown(handle, { key: 'ArrowDown' });
		expect(handle.getAttribute('aria-valuenow')).toBe('55');
		await fireEvent.keyDown(handle, { key: 'ArrowRight' });
		expect(handle.getAttribute('aria-valuenow')).toBe('55');
	});

	it('follows a drag, held to its limits', async () => {
		const onEvent = vi.fn();
		render(Harness, { props: { which: 'split', onEvent } });
		const handle = screen.getByRole('separator');
		handle.parentElement!.getBoundingClientRect = () =>
			({ left: 0, top: 0, width: 200, height: 100 }) as DOMRect;
		await fireEvent.pointerMove(handle, { clientX: 150 });
		expect(handle.getAttribute('aria-valuenow')).toBe('50');
		await fireEvent.pointerDown(handle, { button: 2 });
		await fireEvent.pointerMove(handle, { clientX: 150 });
		expect(handle.getAttribute('aria-valuenow')).toBe('50');
		await fireEvent.pointerDown(handle, { button: 0, pointerId: 1 });
		expect(document.activeElement).toBe(handle);
		await fireEvent.pointerMove(handle, { clientX: 130 });
		expect(handle.getAttribute('aria-valuenow')).toBe('65');
		await fireEvent.pointerMove(handle, { clientX: 199 });
		expect(handle.getAttribute('aria-valuenow')).toBe('80');
		await fireEvent.pointerUp(handle, { pointerId: 1 });
		await fireEvent.pointerUp(handle, { pointerId: 1 });
		await fireEvent.pointerMove(handle, { clientX: 20 });
		expect(last(onEvent, 'size')).toBe(80);
	});

	it('measures a stacked drag from the top', async () => {
		render(Harness, { props: { which: 'split', props: { orientation: 'vertical' } } });
		const handle = screen.getByRole('separator');
		handle.parentElement!.getBoundingClientRect = () =>
			({ left: 0, top: 100, width: 200, height: 100 }) as DOMRect;
		await fireEvent.pointerDown(handle, { button: 0 });
		await fireEvent.pointerMove(handle, { clientY: 140 });
		expect(handle.getAttribute('aria-valuenow')).toBe('40');
	});
});

describe('Stepper', () => {
	it('marks the current step and says each state in words', () => {
		render(Harness, { props: { which: 'stepper' } });
		const list = screen.getByRole('list', { name: 'Progress' });
		const steps = list.querySelectorAll('li');
		expect(steps).toHaveLength(4);
		expect(steps[2].getAttribute('aria-current')).toBe('step');
		expect(steps[0].textContent).toContain('Completed');
		expect(steps[1].classList.contains('stepper__step--error')).toBe(true);
		expect(steps[1].textContent).toContain('Has an error');
		expect(steps[3].textContent).toContain('Not started');
		expect(screen.queryByRole('button')).toBeNull();
	});

	it('lets completed steps be picked when clickable', async () => {
		const onEvent = vi.fn();
		render(Harness, {
			props: { which: 'stepper', props: { clickable: true, orientation: 'vertical' }, onEvent }
		});
		expect(document.querySelector('.stepper--vertical')).toBeTruthy();
		const buttons = screen.getAllByRole('button');
		expect(buttons).toHaveLength(1);
		await fireEvent.click(buttons[0]);
		expect(last(onEvent, 'select')).toEqual({ index: 0, id: 'account' });
	});
});

describe('Sidebar', () => {
	it('marks the current page and labels its sections', () => {
		render(Harness, { props: { which: 'sidebar', props: { current: '/inbox' } } });
		expect(screen.getByRole('navigation', { name: 'Sidebar' })).toBeTruthy();
		expect(screen.getByRole('list', { name: 'Workspace' })).toBeTruthy();
		const inbox = screen.getByRole('link', { name: /Inbox/ });
		expect(inbox.getAttribute('aria-current')).toBe('page');
		expect(screen.getByRole('link', { name: 'Home' }).getAttribute('aria-current')).toBeNull();
		expect(screen.getByTestId('icon-inbox')).toBeTruthy();
		expect(screen.getByText('Acme')).toBeTruthy();
	});

	it('opens and closes a group, and starts it open when it holds the page', async () => {
		const { unmount } = render(Harness, { props: { which: 'sidebar' } });
		const group = screen.getByRole('button', { name: 'Settings' });
		const sublist = document.getElementById(group.getAttribute('aria-controls')!)!;
		expect(group.getAttribute('aria-expanded')).toBe('false');
		expect(sublist.hidden).toBe(true);
		await fireEvent.click(group);
		expect(group.getAttribute('aria-expanded')).toBe('true');
		expect(sublist.hidden).toBe(false);
		await fireEvent.click(group);
		expect(group.getAttribute('aria-expanded')).toBe('false');
		unmount();

		render(Harness, { props: { which: 'sidebar', props: { current: '/settings/profile' } } });
		expect(screen.getByRole('button', { name: 'Settings' }).getAttribute('aria-expanded')).toBe(
			'true'
		);
		expect(screen.getByRole('link', { name: 'Profile' }).getAttribute('aria-current')).toBe('page');
	});

	it('reports picks of items and sub-items', async () => {
		const onEvent = vi.fn();
		render(Harness, { props: { which: 'sidebar', onEvent } });
		await fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
		expect(last(onEvent, 'select')).toEqual({ id: 'logout', href: undefined });
		await fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Billing' }));
		expect(last(onEvent, 'select')).toEqual({ id: 'billing', href: undefined });
	});

	it('collapses to icons, named by aria-label, and expands from a group', async () => {
		const onEvent = vi.fn();
		const { container } = render(Harness, { props: { which: 'sidebar', onEvent } });
		const toggle = screen.getByRole('button', { name: 'Collapse sidebar' });
		expect(toggle.getAttribute('aria-expanded')).toBe('true');
		await fireEvent.click(toggle);
		expect(last(onEvent, 'collapsed')).toBe(true);
		expect(container.querySelector('.sidebar--collapsed')).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeTruthy();
		expect(screen.getByRole('link', { name: 'Inbox, 3' })).toBeTruthy();
		expect(container.querySelectorAll('.sidebar__tip').length).toBeGreaterThan(0);
		const group = screen.getByRole('button', { name: 'Settings' });
		expect(group.getAttribute('aria-expanded')).toBe('false');
		await fireEvent.click(group);
		expect(last(onEvent, 'collapsed')).toBe(false);
		expect(group.getAttribute('aria-expanded')).toBe('true');
	});

	it('goes off-canvas below its breakpoint, behind a Menu button', async () => {
		const onEvent = vi.fn();
		const { container } = render(Harness, {
			props: { which: 'sidebar', props: { breakpoint: 100000, collapsed: true }, onEvent }
		});
		await tick();
		const menu = screen.getByRole('button', { name: 'Menu' });
		expect(menu.getAttribute('aria-expanded')).toBe('false');
		expect(screen.queryByRole('button', { name: /sidebar/ })).toBeNull();
		// Collapsed is a desktop mode; off-canvas always shows labels.
		expect(container.querySelector('.sidebar--collapsed')).toBeNull();

		await fireEvent.click(menu);
		expect(menu.getAttribute('aria-expanded')).toBe('true');
		expect(last(onEvent, 'open')).toBe(true);
		const nav = screen.getByRole('navigation');
		await waitFor(() => expect(nav.contains(document.activeElement)).toBe(true));

		await fireEvent.keyDown(nav, { key: 'Escape' });
		expect(menu.getAttribute('aria-expanded')).toBe('false');
		await waitFor(() => expect(document.activeElement).toBe(menu));

		await fireEvent.click(menu);
		await fireEvent.click(container.querySelector('.sidebar__scrim')!);
		expect(menu.getAttribute('aria-expanded')).toBe('false');

		await fireEvent.click(menu);
		await fireEvent.click(screen.getByRole('link', { name: 'Home' }));
		expect(last(onEvent, 'select')).toEqual({ id: 'home', href: '/' });
		expect(last(onEvent, 'open')).toBe(false);

		// Escape does nothing once it is closed.
		await fireEvent.keyDown(nav, { key: 'Escape' });
		expect(menu.getAttribute('aria-expanded')).toBe('false');
	});
});

describe('NavigationMenu', () => {
	function setup(props: Record<string, unknown> = {}) {
		render(Harness, { props: { which: 'nav', props } });
		return {
			product: screen.getByRole('button', { name: 'Product' }),
			docs: screen.getByRole('button', { name: 'Docs' }),
			panel: (button: HTMLElement) =>
				document.getElementById(button.getAttribute('aria-controls')!)!
		};
	}

	it('is a labelled nav of links and disclosure buttons, not a menu', () => {
		const { product, panel } = setup();
		expect(screen.getByRole('navigation', { name: 'Main' })).toBeTruthy();
		expect(screen.queryByRole('menu')).toBeNull();
		expect(product.getAttribute('aria-expanded')).toBe('false');
		expect(panel(product).hidden).toBe(true);
		expect(panel(product).textContent).toContain('What it does');
	});

	it('opens one panel at a time on click', async () => {
		const { product, docs, panel } = setup();
		await fireEvent.click(product);
		expect(product.getAttribute('aria-expanded')).toBe('true');
		expect(panel(product).hidden).toBe(false);
		await fireEvent.click(docs);
		expect(product.getAttribute('aria-expanded')).toBe('false');
		expect(docs.getAttribute('aria-expanded')).toBe('true');
		await fireEvent.click(docs);
		expect(docs.getAttribute('aria-expanded')).toBe('false');
	});

	it('moves through a panel with the keyboard and Escape returns focus', async () => {
		const { product } = setup();
		product.focus();
		await fireEvent.keyDown(product, { key: 'ArrowDown' });
		const features = screen.getByRole('link', { name: /Features/ });
		await waitFor(() => expect(document.activeElement).toBe(features));
		await fireEvent.keyDown(features, { key: 'ArrowDown' });
		expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Pricing' }));
		await fireEvent.keyDown(document.activeElement!, { key: 'End' });
		expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Changelog' }));
		await fireEvent.keyDown(document.activeElement!, { key: 'Home' });
		expect(document.activeElement).toBe(features);
		await fireEvent.keyDown(features, { key: 'a' });
		expect(document.activeElement).toBe(features);
		await fireEvent.keyDown(features, { key: 'Escape' });
		expect(product.getAttribute('aria-expanded')).toBe('false');
		expect(document.activeElement).toBe(product);
	});

	it('closes from the trigger with Escape, and moves along the row', async () => {
		const { product, docs } = setup();
		await fireEvent.click(product);
		await fireEvent.keyDown(product, { key: 'Escape' });
		expect(product.getAttribute('aria-expanded')).toBe('false');
		expect(document.activeElement).toBe(product);
		await fireEvent.keyDown(product, { key: 'ArrowRight' });
		expect(document.activeElement).toBe(docs);
		const home = screen.getByRole('link', { name: 'Home' });
		await fireEvent.keyDown(home, { key: 'End' });
		expect(document.activeElement).toBe(docs);
		await fireEvent.keyDown(home, { key: 'Enter' });
		expect(document.activeElement).toBe(docs);
	});

	it('closes on a click outside, on focus leaving, and on a pick', async () => {
		const { product } = setup();
		await fireEvent.click(product);
		await fireEvent.pointerDown(product);
		expect(product.getAttribute('aria-expanded')).toBe('true');
		await fireEvent.pointerDown(screen.getByRole('button', { name: 'Outside' }));
		expect(product.getAttribute('aria-expanded')).toBe('false');

		await fireEvent.click(product);
		const features = screen.getByRole('link', { name: /Features/ });
		await fireEvent.focusOut(product, { relatedTarget: features });
		expect(product.getAttribute('aria-expanded')).toBe('true');
		await fireEvent.focusOut(features, {
			relatedTarget: screen.getByRole('button', { name: 'Outside' })
		});
		expect(product.getAttribute('aria-expanded')).toBe('false');

		await fireEvent.click(product);
		await fireEvent.focusOut(product);
		expect(product.getAttribute('aria-expanded')).toBe('false');

		await fireEvent.click(product);
		await fireEvent.click(features);
		expect(product.getAttribute('aria-expanded')).toBe('false');
	});

	it('marks the current page, and the item that holds it', () => {
		const { product, docs } = setup({ current: '/pricing' });
		expect(
			screen.getByRole('link', { name: 'Pricing', hidden: true }).getAttribute('aria-current')
		).toBe('page');
		expect(product.classList.contains('navigation-menu__trigger--current')).toBe(true);
		expect(docs.classList.contains('navigation-menu__trigger--current')).toBe(false);
		expect(screen.getByRole('link', { name: 'Home' }).getAttribute('aria-current')).toBeNull();
	});

	it('marks a plain link as the current page', () => {
		setup({ current: '/' });
		expect(screen.getByRole('link', { name: 'Home' }).getAttribute('aria-current')).toBe('page');
	});
});
