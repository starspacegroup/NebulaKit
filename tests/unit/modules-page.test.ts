import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
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
