/**
 * Widget manifest — metadata for every widget type a board can render.
 * Deliberately free of .svelte imports so Workers, tests, migrations and
 * server routes can all read it.
 *
 * Add entries here and a matching component in ./index.ts to register a widget
 * type for your project. Registering a widget never means editing the board.
 *
 * Ships empty on purpose: a template should not force its widgets on a project.
 */

export interface WidgetDefinition {
	/** Kebab-case type name, matching `BoardWidget.type`. */
	name: string;
	/** Human-readable name, used as the default widget title. */
	label: string;
	description: string;
	/** Props every instance starts with; a widget's own `props` merge over these. */
	defaultProps: Record<string, unknown>;
}

export const widgetManifest: WidgetDefinition[] = [];

export function getWidgetDefinition(name: string): WidgetDefinition | undefined {
	return widgetManifest.find((widget) => widget.name === name);
}
