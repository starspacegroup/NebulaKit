/**
 * TipTap atom node for Svelte embeds.
 *
 * Round-trips the stored placeholder form:
 *   <div data-svelte-embed="name" data-props="{...}"></div>
 *
 * In the editor the node renders as a non-editable card (label from the
 * embed manifest, plus edit-props / remove buttons). The live component is
 * NOT mounted inside the editor — the card keeps editing predictable and
 * cheap.
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { encodeAttrEntities, parseEmbedProps } from './embed';
import { getEmbedDefinition } from './embeds/manifest';

export interface SvelteEmbedOptions {
	/** Called when the user clicks "Props" on an embed card */
	onEditProps: (
		embedName: string,
		getProps: () => Record<string, unknown>,
		setProps: (p: Record<string, unknown>) => void
	) => void;
}

declare module '@tiptap/core' {
	interface Commands<ReturnType> {
		svelteEmbed: {
			insertSvelteEmbed: (name: string, props?: Record<string, unknown>) => ReturnType;
		};
	}
}

export const SvelteEmbed = Node.create<SvelteEmbedOptions>({
	name: 'svelteEmbed',
	group: 'block',
	atom: true,
	draggable: true,

	addOptions() {
		return {
			onEditProps: () => {}
		};
	},

	addAttributes() {
		return {
			embedName: {
				default: '',
				parseHTML: (element: HTMLElement) => element.getAttribute('data-svelte-embed') || '',
				renderHTML: (attributes: Record<string, unknown>) => ({
					'data-svelte-embed': String(attributes.embedName ?? '')
				})
			},
			props: {
				default: {},
				parseHTML: (element: HTMLElement) => parseEmbedProps(element.getAttribute('data-props')),
				renderHTML: (attributes: Record<string, unknown>) => {
					const props = (attributes.props as Record<string, unknown>) ?? {};
					if (Object.keys(props).length === 0) return {};
					return { 'data-props': JSON.stringify(props) };
				}
			}
		};
	},

	parseHTML() {
		return [{ tag: 'div[data-svelte-embed]' }];
	},

	renderHTML({ HTMLAttributes }) {
		return ['div', mergeAttributes(HTMLAttributes)];
	},

	addCommands() {
		return {
			insertSvelteEmbed:
				(name: string, props: Record<string, unknown> = {}) =>
				({ commands }) =>
					commands.insertContent({
						type: this.name,
						attrs: { embedName: name, props }
					})
		};
	},

	addNodeView() {
		return ({ node, editor, getPos }) => {
			const dom = document.createElement('div');
			dom.className = 'rte-embed-card';
			dom.contentEditable = 'false';

			const definition = getEmbedDefinition(node.attrs.embedName);

			const info = document.createElement('div');
			info.className = 'rte-embed-info';
			const label = document.createElement('strong');
			label.textContent = definition?.label ?? node.attrs.embedName;
			const chip = document.createElement('code');
			chip.className = 'rte-embed-chip';
			chip.textContent = node.attrs.embedName;
			info.appendChild(label);
			info.appendChild(chip);
			if (definition?.description) {
				const desc = document.createElement('span');
				desc.className = 'rte-embed-desc';
				desc.textContent = definition.description;
				info.appendChild(desc);
			}

			const actions = document.createElement('div');
			actions.className = 'rte-embed-actions';

			const propsBtn = document.createElement('button');
			propsBtn.type = 'button';
			propsBtn.textContent = 'Props';
			propsBtn.addEventListener('click', () => {
				this.options.onEditProps(
					node.attrs.embedName,
					() => node.attrs.props ?? {},
					(newProps) => {
						const pos = typeof getPos === 'function' ? getPos() : null;
						if (pos === null || pos === undefined) return;
						editor
							.chain()
							.focus()
							.command(({ tr }) => {
								tr.setNodeMarkup(pos, undefined, { ...node.attrs, props: newProps });
								return true;
							})
							.run();
					}
				);
			});

			const removeBtn = document.createElement('button');
			removeBtn.type = 'button';
			removeBtn.textContent = 'Remove';
			removeBtn.addEventListener('click', () => {
				const pos = typeof getPos === 'function' ? getPos() : null;
				if (pos === null || pos === undefined) return;
				editor
					.chain()
					.focus()
					.command(({ tr }) => {
						tr.delete(pos, pos + node.nodeSize);
						return true;
					})
					.run();
			});

			actions.appendChild(propsBtn);
			actions.appendChild(removeBtn);
			dom.appendChild(info);
			dom.appendChild(actions);

			return { dom };
		};
	}
});

/** The stored HTML for an embed node's attrs (used by tests and tooling) */
export function embedNodeToHtml(embedName: string, props: Record<string, unknown>): string {
	const propsAttr =
		Object.keys(props).length > 0
			? ` data-props="${encodeAttrEntities(JSON.stringify(props))}"`
			: '';
	return `<div data-svelte-embed="${embedName}"${propsAttr}></div>`;
}
