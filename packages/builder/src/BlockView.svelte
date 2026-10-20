<script lang="ts">
	/**
	 * One leaf block, as visitors see it. Used by the live page and by the
	 * editor's canvas. Every value is output as text or as an attribute Svelte
	 * escapes — there is no {@html} here, and there must never be: block text is
	 * client-authored.
	 */
	import './blocks.css';
	import type { Block } from './schema';

	export interface GridProduct {
		slug: string;
		name: string;
		price: string;
		imageUrl: string | null;
	}

	let {
		block,
		products = [],
		editing = false
	}: { block: Block; products?: GridProduct[]; editing?: boolean } = $props();
</script>

{#if block.type === 'heading'}
	<svelte:element this={`h${block.props.level}`} class="nk-heading" data-align={block.props.align}
		>{block.props.text}</svelte:element
	>
{:else if block.type === 'text'}
	<p class="nk-text" data-align={block.props.align}>{block.props.text}</p>
{:else if block.type === 'image'}
	{#if block.props.src}
		<img class="nk-image" src={block.props.src} alt={block.props.alt} loading="lazy" />
	{:else if editing}
		<div class="nk-image-empty">No picture chosen yet</div>
	{/if}
{:else if block.type === 'button'}
	<a class="nk-button" href={block.props.href}>{block.props.label}</a>
{:else if block.type === 'quote'}
	<blockquote class="nk-quote">
		<p>{block.props.text}</p>
		{#if block.props.cite}<footer>{block.props.cite}</footer>{/if}
	</blockquote>
{:else if block.type === 'product-grid'}
	<section class="nk-products">
		{#if block.props.heading}<h2 class="nk-heading">{block.props.heading}</h2>{/if}
		<ul>
			{#each products.slice(0, block.props.limit) as product (product.slug)}
				<li>
					{#if product.imageUrl}<img src={product.imageUrl} alt="" loading="lazy" />{/if}
					<span class="name">{product.name}</span>
					<span class="price">{product.price}</span>
				</li>
			{:else}
				<li class="empty">No products yet.</li>
			{/each}
		</ul>
	</section>
{:else if block.type === 'spacer'}
	<div class="nk-spacer-{block.props.size}" aria-hidden="true"></div>
{:else if block.type === 'divider'}
	<hr class="nk-divider" />
{/if}
