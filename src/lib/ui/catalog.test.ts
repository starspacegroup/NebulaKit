import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { widgetManifest } from '$lib/widgets/manifest';
import { CATALOG_GROUPS, catalog, catalogEntry } from './catalog';

describe('component catalog', () => {
	it('has an entry for every component in $lib/ui', () => {
		const components = readdirSync('src/lib/ui')
			.filter((f) => f.endsWith('.svelte'))
			.map((f) => f.replace('.svelte', ''));
		const names = catalog.filter((e) => e.group !== 'Widgets').map((e) => e.name);
		expect(components.filter((c) => !names.includes(c))).toEqual([]);
		expect(names.filter((n) => !components.includes(n))).toEqual([]);
	});

	it('has an entry for every registered widget', () => {
		const widgets = catalog.filter((e) => e.group === 'Widgets').map((e) => e.id);
		expect(widgets.sort()).toEqual(widgetManifest.map((w) => `widget-${w.name}`).sort());
	});

	it('uses unique ids, known groups, and says something for each', () => {
		expect(new Set(catalog.map((e) => e.id)).size).toBe(catalog.length);
		for (const entry of catalog) {
			expect(CATALOG_GROUPS).toContain(entry.group);
			expect(entry.summary.length).toBeGreaterThan(10);
			expect(entry.code.length).toBeGreaterThan(10);
		}
	});

	it('looks entries up by id, and refuses an unknown one', () => {
		expect(catalogEntry('button').name).toBe('Button');
		expect(() => catalogEntry('nope')).toThrow(/nope/);
	});
});
