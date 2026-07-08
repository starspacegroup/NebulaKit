/**
 * Embed component registry — maps embed names to their Svelte components.
 * Imported only by client-rendering code paths (CmsContent); everything
 * that just needs metadata should import ./manifest instead.
 *
 * Add entries here alongside a matching manifest entry to register a new
 * embed type for your project.
 */

import type { ComponentType, SvelteComponent } from 'svelte';

const embedComponents: Record<string, ComponentType<SvelteComponent>> = {};

export function getEmbedComponent(name: string): ComponentType<SvelteComponent> | null {
	return embedComponents[name] ?? null;
}
