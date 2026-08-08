/**
 * Tests for embed auto-registration (manifest glob discovery) and the
 * TipTap embed extension's pure HTML helper.
 */
import { describe, expect, it, vi } from 'vitest';

import { getEmbedComponent } from '../../src/lib/cms/embeds';
import { embedManifest, getEmbedDefinition } from '../../src/lib/cms/embeds/manifest';
import { SvelteEmbed, embedNodeToHtml } from '../../src/lib/cms/richtext-embed-extension';

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

describe('SvelteEmbed TipTap extension', () => {
	const config = SvelteEmbed.config as any;

	it('parses and renders embed attributes', () => {
		const options = config.addOptions();
		expect(options.onEditProps()).toBeUndefined();

		const attributes = config.addAttributes();
		const element = document.createElement('div');
		element.dataset.svelteEmbed = 'callout';
		element.dataset.props = '{"variant":"warning"}';

		expect(attributes.embedName.parseHTML(element)).toBe('callout');
		expect(attributes.embedName.parseHTML(document.createElement('div'))).toBe('');
		expect(attributes.embedName.renderHTML({ embedName: null })).toEqual({
			'data-svelte-embed': ''
		});
		expect(attributes.props.parseHTML(element)).toEqual({ variant: 'warning' });
		expect(attributes.props.renderHTML({ props: {} })).toEqual({});
		expect(attributes.props.renderHTML({ props: null })).toEqual({});
		expect(attributes.props.renderHTML({ props: { variant: 'warning' } })).toEqual({
			'data-props': '{"variant":"warning"}'
		});
		expect(config.parseHTML()).toEqual([{ tag: 'div[data-svelte-embed]' }]);
		expect(config.renderHTML({ HTMLAttributes: { 'data-svelte-embed': 'callout' } })).toEqual([
			'div',
			{ 'data-svelte-embed': 'callout' }
		]);
	});

	it('inserts an embed node through the TipTap command', () => {
		const insertContent = vi.fn().mockReturnValue(true);
		const commands = config.addCommands.call({ name: 'svelteEmbed' });

		expect(commands.insertSvelteEmbed('callout')({ commands: { insertContent } })).toBe(true);
		expect(insertContent).toHaveBeenLastCalledWith({
			type: 'svelteEmbed',
			attrs: { embedName: 'callout', props: {} }
		});
		expect(
			commands.insertSvelteEmbed('callout', { variant: 'warning' })({ commands: { insertContent } })
		).toBe(true);
	});

	it('renders a card and wires props and remove actions', () => {
		let setProps: ((props: Record<string, unknown>) => void) | undefined;
		const onEditProps = vi.fn(
			(
				_name: string,
				getProps: () => Record<string, unknown>,
				setter: (props: Record<string, unknown>) => void
			) => {
				expect(getProps()).toEqual({ variant: 'info' });
				setProps = setter;
			}
		);
		const setNodeMarkup = vi.fn();
		const remove = vi.fn();
		const run = vi.fn().mockReturnValue(true);
		const command = vi.fn((callback) => {
			callback({ tr: { setNodeMarkup, delete: remove } });
			return { run };
		});
		const focus = vi.fn(() => ({ command }));
		const chain = vi.fn(() => ({ focus }));
		const node = {
			attrs: { embedName: 'callout', props: { variant: 'info' } },
			nodeSize: 2
		};

		const nodeView = config.addNodeView.call({ options: { onEditProps } });
		const { dom } = nodeView({ node, editor: { chain }, getPos: () => 4 });
		expect(dom.querySelector('strong')?.textContent).toBe('Callout');
		expect(dom.querySelector('.rte-embed-desc')).toBeTruthy();

		const [propsButton, removeButton] = Array.from(dom.querySelectorAll('button'));
		propsButton.click();
		expect(onEditProps).toHaveBeenCalledWith('callout', expect.any(Function), expect.any(Function));
		setProps?.({ variant: 'warning' });
		expect(setNodeMarkup).toHaveBeenCalledWith(4, undefined, {
			...node.attrs,
			props: { variant: 'warning' }
		});

		removeButton.click();
		expect(remove).toHaveBeenCalledWith(4, 6);
		expect(run).toHaveBeenCalledTimes(2);
	});

	it('uses the embed name as fallback and ignores actions without a position', () => {
		const onEditProps = vi.fn((_name, _getProps, setProps) => setProps({ changed: true }));
		const chain = vi.fn();
		const nodeView = config.addNodeView.call({ options: { onEditProps } });
		const { dom } = nodeView({
			node: { attrs: { embedName: 'unknown', props: null }, nodeSize: 1 },
			editor: { chain },
			getPos: undefined
		});

		expect(dom.querySelector('strong')?.textContent).toBe('unknown');
		expect(dom.querySelector('.rte-embed-desc')).toBeNull();
		for (const button of dom.querySelectorAll('button')) button.click();
		expect(chain).not.toHaveBeenCalled();
	});
});
