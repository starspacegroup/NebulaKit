<script lang="ts">
	/**
	 * Renders a page document. Every value is output as text or as an
	 * attribute Svelte escapes — there is no {@html} here, and there must never
	 * be: block text is client-authored.
	 */
	import type { Block, PageDocument } from './schema';

	interface GridProduct {
		slug: string;
		name: string;
		price: string;
		imageUrl: string | null;
	}

	let { document, products = [] }: { document: PageDocument; products?: GridProduct[] } = $props();
</script>

<div class="nk-page">
	{#each document.blocks as block (block.id)}
		{@render renderBlock(block)}
	{/each}
</div>

{#snippet renderBlock(block: Block)}
	{#if block.type === 'heading'}
		<svelte:element this={`h${block.props.level}`} class="nk-heading"
			>{block.props.text}</svelte:element
		>
	{:else if block.type === 'text'}
		<p class="nk-text">{block.props.text}</p>
	{:else if block.type === 'image'}
		{#if block.props.src}
			<img class="nk-image" src={block.props.src} alt={block.props.alt} loading="lazy" />
		{/if}
	{:else if block.type === 'button'}
		<a class="nk-button" href={block.props.href}>{block.props.label}</a>
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
		<div class="nk-spacer nk-spacer-{block.props.size}" aria-hidden="true"></div>
	{/if}
{/snippet}

<style>
	.nk-page {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		max-width: 60rem;
		margin: 0 auto;
		padding: 2rem 1rem;
		color: var(--color-text);
	}
	.nk-text {
		color: var(--color-text-secondary);
		white-space: pre-line;
		line-height: 1.6;
	}
	.nk-image {
		max-width: 100%;
		border-radius: var(--radius-lg);
	}
	.nk-button {
		align-self: flex-start;
		padding: 0.6rem 1.2rem;
		border-radius: var(--radius-md);
		background: var(--color-primary-solid);
		color: var(--color-on-solid);
		text-decoration: none;
	}
	.nk-button:hover {
		background: var(--color-primary-solid-hover);
	}
	.nk-products ul {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
		gap: 1rem;
		list-style: none;
		padding: 0;
	}
	.nk-products li {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
	}
	.nk-products img {
		width: 100%;
		aspect-ratio: 1;
		object-fit: cover;
		border-radius: var(--radius-sm);
	}
	.nk-products .price {
		color: var(--color-text-secondary);
	}
	.nk-spacer-sm {
		height: 1rem;
	}
	.nk-spacer-md {
		height: 2.5rem;
	}
	.nk-spacer-lg {
		height: 5rem;
	}
</style>
