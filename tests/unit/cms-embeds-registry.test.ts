import { describe, expect, it } from 'vitest';
import { getEmbedComponent } from '../../src/lib/cms/embeds/index';
import { embedManifest, getEmbedDefinition } from '../../src/lib/cms/embeds/manifest';
import { EMBED_NAME_PATTERN } from '../../src/lib/cms/embed';

describe('embed registry', () => {
	// The registry ships the `callout` embed from the CMS v2 work. The
	// "ships empty" assertion this replaced belonged to main's line, where the
	// registry deliberately shipped nothing; the v2 implementation was chosen.
	it('ships the callout embed from the registry', () => {
		expect(embedManifest.map((e) => e.name)).toContain('callout');
	});

	it('returns undefined for a name that is not registered', () => {
		expect(getEmbedDefinition('definitely-not-registered')).toBeUndefined();
	});

	it('resolves a registered embed to its definition', () => {
		expect(getEmbedDefinition('callout')).toBeDefined();
	});

	it('returns null rather than undefined for an unregistered component', () => {
		// CmsContent branches on null; undefined would slip through a `=== null` check.
		expect(getEmbedComponent('definitely-not-registered')).toBeNull();
	});

	it('resolves a registered embed to a component', () => {
		expect(getEmbedComponent('callout')).toBeTruthy();
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
