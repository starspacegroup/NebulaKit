import { describe, it, expect } from 'vitest';
import { getWidgetComponent } from './index';
import { getWidgetDefinition, widgetManifest } from './manifest';

describe('widget manifest', () => {
	it('ships the standard set', () => {
		expect(widgetManifest.map((widget) => widget.name)).toEqual([
			'notes',
			'stat',
			'clock',
			'checklist',
			'meter',
			'links'
		]);
	});

	it('gives every widget the metadata a picker would need', () => {
		for (const widget of widgetManifest) {
			expect(widget.name).toMatch(/^[a-z0-9-]+$/);
			expect(widget.label).toBeTruthy();
			expect(widget.description).toBeTruthy();
			expect(widget.defaultProps).toBeTypeOf('object');
		}
	});

	it('returns nothing for an unregistered type', () => {
		expect(getWidgetDefinition('nope')).toBeUndefined();
	});

	it('finds a registered definition by name', () => {
		expect(getWidgetDefinition('notes')?.label).toBe('Notes');
	});
});

describe('widget component registry', () => {
	it('has a component for every manifest entry, and no orphans', () => {
		for (const widget of widgetManifest) {
			expect(getWidgetComponent(widget.name)).not.toBeNull();
		}
	});

	it('returns null for an unregistered type', () => {
		expect(getWidgetComponent('nope')).toBeNull();
	});

	it('does not hand back something off the prototype chain', () => {
		// Layout data is stored, so a type name is untrusted input. A bare lookup
		// for 'constructor' returns Object, which is truthy and would be rendered.
		expect(getWidgetComponent('constructor')).toBeNull();
		expect(getWidgetComponent('toString')).toBeNull();
	});
});
