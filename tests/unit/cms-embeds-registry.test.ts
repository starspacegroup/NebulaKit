import { describe, expect, it } from 'vitest';
import { getEmbedComponent } from '../../src/lib/cms/embeds/index';
import { embedManifest, getEmbedDefinition } from '../../src/lib/cms/embeds/manifest';
import { EMBED_NAME_PATTERN } from '../../src/lib/cms/embed';

describe('embed registry', () => {
	it('ships empty, so a new project inherits no embeds it did not ask for', () => {
		expect(embedManifest).toEqual([]);
	});

	it('returns undefined for a name that is not registered', () => {
		expect(getEmbedDefinition('callout')).toBeUndefined();
	});

	it('returns null rather than undefined for an unregistered component', () => {
		// CmsContent branches on null; undefined would slip through a `=== null` check.
		expect(getEmbedComponent('callout')).toBeNull();
	});

	it('does not resolve inherited Object properties as components', () => {
		expect(getEmbedComponent('constructor')).toBeNull();
		expect(getEmbedComponent('toString')).toBeNull();
		expect(getEmbedComponent('__proto__')).toBeNull();
	});

	it('keeps the manifest and the component map in step', () => {
		// Every declared embed must be renderable, or content using it breaks at
		// display time with no editor-side warning.
		for (const definition of embedManifest) {
			expect(getEmbedComponent(definition.name)).not.toBeNull();
		}
	});

	it('gives every manifest entry a name the placeholder codec accepts', () => {
		for (const definition of embedManifest) {
			expect(definition.name).toMatch(EMBED_NAME_PATTERN);
			expect(definition.label).toBeTruthy();
		}
	});
});
