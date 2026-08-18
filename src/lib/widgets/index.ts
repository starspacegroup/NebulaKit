/**
 * Widget component registry — maps widget type names to their Svelte
 * components. Imported only by rendering code paths; anything that just needs
 * metadata should import ./manifest instead, which is safe everywhere.
 *
 * Add entries here alongside a matching manifest entry to register a widget
 * type for your project.
 */

import type { ComponentType, SvelteComponent } from 'svelte';

const widgetComponents: Record<string, ComponentType<SvelteComponent>> = {};

export function getWidgetComponent(name: string): ComponentType<SvelteComponent> | null {
	// Own-property check, not a bare lookup: type names come from stored layout
	// data, and `constructor` matches the kebab-case name pattern, so
	// `widgetComponents[name]` would return Object off the prototype chain —
	// non-null, so `?? null` would miss it and the board would try to render it.
	return Object.prototype.hasOwnProperty.call(widgetComponents, name)
		? widgetComponents[name]
		: null;
}
