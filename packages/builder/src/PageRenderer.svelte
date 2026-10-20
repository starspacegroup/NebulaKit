<script lang="ts">
	/**
	 * Renders a page document: the tree of blocks, containers included. Leaf
	 * blocks are drawn by BlockView, which outputs only text and escaped
	 * attributes — there is no {@html} anywhere in the render path.
	 */
	import './blocks.css';
	import BlockView, { type GridProduct } from './BlockView.svelte';
	import type { Block, PageDocument } from './schema';

	let { document, products = [] }: { document: PageDocument; products?: GridProduct[] } = $props();

	const hideClass = (block: Block) => (block.hide ?? []).map((b) => `nk-hide-${b}`).join(' ');
</script>

<div class="nk-frame">
	<div class="nk-page">
		{@render blocks(document.blocks)}
	</div>
</div>

{#snippet blocks(list: Block[])}
	{#each list as block (block.id)}
		{#if block.type === 'section'}
			<div
				class="nk-section {hideClass(block)}"
				data-gap={block.props.gap}
				data-padding={block.props.padding}
				data-tone={block.props.tone}
			>
				{@render blocks(block.children ?? [])}
			</div>
		{:else if block.type === 'columns'}
			<div
				class="nk-columns {hideClass(block)}"
				data-gap={block.props.gap}
				style:--nk-cols={block.children?.length ?? 1}
			>
				{#each block.children ?? [] as column (column.id)}
					<div class="nk-column {hideClass(column)}">
						{@render blocks(column.children ?? [])}
					</div>
				{/each}
			</div>
		{:else}
			<div class="nk-leaf {hideClass(block)}"><BlockView {block} {products} /></div>
		{/if}
	{/each}
{/snippet}
