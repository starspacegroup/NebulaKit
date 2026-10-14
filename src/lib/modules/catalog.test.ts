import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MODULE_GROUPS, moduleCatalog, moduleEntry } from './catalog';

const dirs: Record<string, string> = {
	Account: 'account',
	Settings: 'settings',
	Marketing: 'marketing',
	'App shell': 'shell',
	'Data & teams': 'data',
	Commerce: 'commerce'
};

describe('module catalog', () => {
	it('has an entry for every module component, and a component for every entry', () => {
		for (const group of MODULE_GROUPS) {
			const dir = `src/lib/modules/${dirs[group]}`;
			const components = readdirSync(dir)
				.filter((f) => f.endsWith('.svelte'))
				.map((f) => f.replace('.svelte', ''));
			const names = moduleCatalog.filter((e) => e.group === group).map((e) => e.name);
			expect(
				components.filter((c) => !names.includes(c)),
				`${group}: no entry`
			).toEqual([]);
			expect(
				names.filter((n) => !components.includes(n)),
				`${group}: no component`
			).toEqual([]);
		}
	});

	it('uses unique ids, known groups, and says something for each', () => {
		expect(new Set(moduleCatalog.map((e) => e.id)).size).toBe(moduleCatalog.length);
		for (const entry of moduleCatalog) {
			expect(MODULE_GROUPS).toContain(entry.group);
			expect(entry.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
			expect(entry.summary.length).toBeGreaterThan(10);
			expect(entry.a11y.length).toBeGreaterThan(10);
			expect(entry.code).toContain(`import`);
			expect(entry.code).toContain(entry.name);
		}
	});

	it('has a live demo on the page for every entry', () => {
		const demoFile: Record<string, string> = {
			Account: 'Account',
			Settings: 'Settings',
			Marketing: 'Marketing',
			'App shell': 'Shell',
			'Data & teams': 'Data',
			Commerce: 'Commerce'
		};
		for (const entry of moduleCatalog) {
			const source = readFileSync(
				`src/routes/modules/groups/${demoFile[entry.group]}.svelte`,
				'utf8'
			);
			expect(source, `${entry.id} has no <ModuleItem>`).toContain(`<ModuleItem id="${entry.id}"`);
		}
	});

	it('looks entries up by id, and refuses an unknown one', () => {
		const first = moduleCatalog[0];
		if (first) expect(moduleEntry(first.id)).toBe(first);
		expect(() => moduleEntry('nope')).toThrow(/No module entry/);
	});
});
