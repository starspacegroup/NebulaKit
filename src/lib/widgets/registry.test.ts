import { describe, it, expect } from 'vitest';
import { getWidgetComponent } from './index';
import { getWidgetDefinition, widgetManifest } from './manifest';

describe('widget manifest', () => {
	it('ships empty, so a project brings its own widgets', () => {
		expect(widgetManifest).toEqual([]);
	});

	it('returns nothing for an unregistered type', () => {
		expect(getWidgetDefinition('nope')).toBeUndefined();
	});

	it('finds a registered definition by name', () => {
		widgetManifest.push({
			name: 'notes',
			label: 'Notes',
			description: 'A scratch pad.',
			defaultProps: { text: '' }
		});

		try {
			expect(getWidgetDefinition('notes')?.label).toBe('Notes');
		} finally {
			widgetManifest.length = 0;
		}
	});
});

describe('widget component registry', () => {
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
