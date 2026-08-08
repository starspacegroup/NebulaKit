/**
 * Tests for embed auto-registration (manifest glob discovery) and the
 * TipTap embed extension's pure HTML helper.
 */
import { describe, expect, it } from 'vitest';

import { getEmbedComponent } from '../../src/lib/cms/embeds';
import { embedManifest, getEmbedDefinition } from '../../src/lib/cms/embeds/manifest';
import { embedNodeToHtml } from '../../src/lib/cms/richtext-embed-extension';

describe('embed manifest auto-discovery', () => {
	it('discovers the bundled callout reference embed', () => {
		const names = embedManifest.map((e) => e.name);
		expect(names).toContain('callout');
	});

	it('keeps the manifest sorted by name', () => {
		const names = embedManifest.map((e) => e.name);
		expect([...names].sort()).toEqual(names);
	});

	it('exposes the callout typed props schema and derived defaults', () => {
		const callout = getEmbedDefinition('callout');
		expect(callout).toBeTruthy();
		expect(callout?.label).toBe('Callout');
		expect(callout?.props?.map((p) => p.key)).toEqual(['variant', 'title', 'body']);
		expect(callout?.defaultProps).toEqual({ variant: 'info', title: 'Note', body: '' });
	});

	it('returns undefined for an unknown embed', () => {
		expect(getEmbedDefinition('does-not-exist')).toBeUndefined();
	});
});

describe('embed component registry', () => {
	it('resolves the callout component by name', () => {
		expect(getEmbedComponent('callout')).toBeTruthy();
	});

	it('returns null for an unknown embed', () => {
		expect(getEmbedComponent('does-not-exist')).toBeNull();
	});

	it('registers a component for every manifest entry', () => {
		for (const def of embedManifest) {
			expect(getEmbedComponent(def.name)).toBeTruthy();
		}
	});
});

describe('embedNodeToHtml', () => {
	it('emits a prop-less placeholder', () => {
		expect(embedNodeToHtml('callout', {})).toBe('<div data-svelte-embed="callout"></div>');
	});

	it('emits an entity-encoded props placeholder', () => {
		expect(embedNodeToHtml('callout', { variant: 'warning' })).toBe(
			'<div data-svelte-embed="callout" data-props="{&quot;variant&quot;:&quot;warning&quot;}"></div>'
		);
	});
});
