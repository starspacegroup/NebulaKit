import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import { MODULE_GROUPS, moduleCatalog } from '../../src/lib/modules/catalog';
import Page from '../../src/routes/modules/+page.svelte';

describe('/modules page', () => {
	it('shows one live, labelled article per catalog entry', () => {
		const { container } = render(Page);
		expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
		const articles = [...container.querySelectorAll('article.item')];
		expect(articles.map((a) => a.id).sort()).toEqual(moduleCatalog.map((e) => e.id).sort());
		for (const article of articles) {
			expect(article.getAttribute('aria-labelledby')).toBe(`${article.id}-name`);
		}
	});

	it('has a nav link and a labelled section for every group', () => {
		const { container } = render(Page);
		const nav = screen.getByRole('navigation', { name: 'Module groups' });
		for (const group of MODULE_GROUPS) {
			expect(nav.textContent).toContain(group);
		}
		const sections = [...container.querySelectorAll('section.group')];
		expect(sections).toHaveLength(MODULE_GROUPS.length);
		for (const section of sections) {
			const href = `#${section.id}`;
			expect(nav.querySelector(`a[href="${href}"]`)).toBeTruthy();
			expect(section.querySelector(`#${section.getAttribute('aria-labelledby')}`)).toBeTruthy();
		}
	});

	it('never repeats an id, so no label or aria reference can land on the wrong element', () => {
		const { container } = render(Page);
		const seen = new Map<string, number>();
		for (const el of container.querySelectorAll('[id]')) {
			seen.set(el.id, (seen.get(el.id) ?? 0) + 1);
		}
		const repeated = [...seen].filter(([, n]) => n > 1).map(([id]) => id);
		expect(repeated).toEqual([]);
	});
});

describe('/modules sidebar', () => {
	it('links to every group and every module', () => {
		render(Page);
		const nav = screen.getByRole('navigation', { name: 'Modules' });
		for (const entry of moduleCatalog) {
			expect(nav.querySelector(`a[href="#${entry.id}"]`)?.textContent).toBe(entry.name);
		}
		expect(nav.querySelectorAll('.sidebar__title')).toHaveLength(MODULE_GROUPS.length);
	});

	it('folds behind a button that reports its state, and closes after a jump', async () => {
		const { container } = render(Page);
		const button = screen.getByRole('button', { name: /Jump to a module/ });
		const nav = container.querySelector('#modules-sidebar-nav') as HTMLElement;
		expect(button).toHaveAttribute('aria-expanded', 'false');
		await fireEvent.click(button);
		expect(button).toHaveAttribute('aria-expanded', 'true');
		expect(nav.classList.contains('sidebar__nav--open')).toBe(true);
		await fireEvent.click(nav.querySelector('li a') as HTMLElement);
		expect(button).toHaveAttribute('aria-expanded', 'false');
	});

	it('marks the module in the reading band as the current location', async () => {
		let callback: IntersectionObserverCallback = () => {};
		vi.stubGlobal(
			'IntersectionObserver',
			class {
				constructor(cb: IntersectionObserverCallback, options?: IntersectionObserverInit) {
					// Other modules observe too; the sidebar is the one with a reading band.
					if (options?.rootMargin) callback = cb;
				}
				observe() {}
				disconnect() {}
			}
		);
		const { container } = render(Page);
		const first = moduleCatalog[1];
		callback(
			[{ isIntersecting: true, target: document.getElementById(first.id)! }] as never,
			{} as never
		);
		await tick();
		const nav = container.querySelector('#modules-sidebar-nav') as HTMLElement;
		const current = nav.querySelectorAll('[aria-current="location"]');
		expect(current).toHaveLength(1);
		expect(current[0]).toHaveAttribute('href', `#${first.id}`);
		callback(
			[{ isIntersecting: false, target: document.getElementById(first.id)! }] as never,
			{} as never
		);
		vi.unstubAllGlobals();
	});
});
