import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * True when this directory, or anything under it, renders a page.
 *
 * Recursive on purpose. A route area can render pages only from a
 * parameterised child (`shop/[slug]/+page.svelte`), and a check that looked for
 * `+page.svelte` directly inside the top-level directory walks straight past
 * the area: it ships with no declared crawl policy while the guard reports
 * that everything is fine.
 */
export function rendersAPage(dir: string): boolean {
	if (existsSync(join(dir, '+page.svelte'))) return true;
	return readdirSync(dir, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.some((entry) => rendersAPage(join(dir, entry.name)));
}

/** Top-level route directories under `routesDir` that render a page anywhere below. */
export function pageDirectoriesOf(routesDir: string): string[] {
	return readdirSync(routesDir, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.filter((name) => rendersAPage(join(routesDir, name)));
}
