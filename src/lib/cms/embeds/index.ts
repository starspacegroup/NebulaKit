/**
 * Embed component registry — maps embed names to their Svelte components.
 * Imported only by client-rendering code paths (CmsContent); everything that
 * just needs metadata should import ./manifest instead.
 *
 * Components are auto-discovered from `embeds/<name>/*.svelte` — the embed name
 * is the folder name (which must match the folder's `definition.ts` name).
 * Eager discovery keeps `getEmbedComponent` synchronous and lets embeds render
 * during SSR (they paint with the page instead of popping in on hydrate).
 */

import type { ComponentType, SvelteComponent } from 'svelte';

const componentModules = import.meta.glob<{ default: ComponentType<SvelteComponent> }>(
	'./*/*.svelte',
	{ eager: true }
);

const embedComponents: Record<string, ComponentType<SvelteComponent>> = {};
for (const [path, mod] of Object.entries(componentModules)) {
	// './callout/Callout.svelte' → 'callout'
	const folder = path.split('/')[1];
	if (folder) {
		embedComponents[folder] = mod.default;
	}
}

export function getEmbedComponent(name: string): ComponentType<SvelteComponent> | null {
	// Own-property check, not a bare lookup: embed names come from stored content,
	// and `constructor` matches the [a-z0-9-]+ name pattern, so `embedComponents[name]`
	// would return Object off the prototype chain — non-null, so `?? null` misses it.
	return Object.prototype.hasOwnProperty.call(embedComponents, name) ? embedComponents[name] : null;
}
