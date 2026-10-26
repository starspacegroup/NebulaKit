/**
 * Widget component registry — maps widget type names to their Svelte
 * components. Imported only by rendering code paths; anything that just needs
 * metadata should import ./manifest instead, which is safe everywhere.
 *
 * Add entries here alongside a matching manifest entry to register a widget
 * type for your project.
 */

import type { ComponentType, SvelteComponent } from 'svelte';
import ChecklistWidget from './ChecklistWidget.svelte';
import ClockWidget from './ClockWidget.svelte';
import LinksWidget from './LinksWidget.svelte';
import MeterWidget from './MeterWidget.svelte';
import NotesWidget from './NotesWidget.svelte';
import StatWidget from './StatWidget.svelte';

const widgetComponents: Record<string, ComponentType<SvelteComponent>> = {
	notes: NotesWidget as ComponentType<SvelteComponent>,
	stat: StatWidget as ComponentType<SvelteComponent>,
	clock: ClockWidget as ComponentType<SvelteComponent>,
	checklist: ChecklistWidget as ComponentType<SvelteComponent>,
	meter: MeterWidget as ComponentType<SvelteComponent>,
	links: LinksWidget as ComponentType<SvelteComponent>
};

export function getWidgetComponent(name: string): ComponentType<SvelteComponent> | null {
	// Own-property check, not a bare lookup: type names come from stored layout
	// data, and `constructor` matches the kebab-case name pattern, so
	// `widgetComponents[name]` would return Object off the prototype chain —
	// non-null, so `?? null` would miss it and the board would try to render it.
	return Object.prototype.hasOwnProperty.call(widgetComponents, name)
		? widgetComponents[name]
		: null;
}
