<!--
	ProductCard — one product in a grid: image with alt text, name, price (and
	sale price, written out as "Sale price" / "Was"), rating, and add to cart.
	Sold out is a badge and a disabled button with the words "Sold out".
	Presentational: Add to cart is an `add` event.
-->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Badge from '$lib/ui/Badge.svelte';
	import Button from '$lib/ui/Button.svelte';
	import RatingStars from './RatingStars.svelte';
	import { formatMoney } from './logic';

	export let product: {
		id: string;
		name: string;
		href?: string;
		image?: string;
		/** Describe the picture; use "" only if it adds nothing the name does not say. */
		imageAlt?: string;
		priceCents: number;
		salePriceCents?: number;
		currency?: string;
		rating?: number;
		reviewCount?: number;
		soldOut?: boolean;
	};
	export let adding = false;
	export let locale = 'en-US';
	export let level: 2 | 3 | 4 | 5 = 3;
	export let labels: Partial<typeof defaults> = {};

	const defaults = {
		add: 'Add to cart',
		addFor: 'Add {name} to cart',
		soldOut: 'Sold out',
		sale: 'Sale',
		salePrice: 'Sale price',
		was: 'Original price',
		added: '{name} added to cart.'
	};

	const dispatch = createEventDispatcher<{ add: { id: string } }>();
	let status = '';

	$: t = { ...defaults, ...labels };
	$: cur = product.currency ?? 'USD';
	$: onSale = product.salePriceCents !== undefined && product.salePriceCents < product.priceCents;
	$: money = (cents: number) => formatMoney(cents, cur, locale);

	function add() {
		dispatch('add', { id: product.id });
		status = t.added.replace('{name}', product.name);
	}
</script>

<article class="product" class:product--out={product.soldOut}>
	<div class="product__media">
		{#if product.image}
			<img src={product.image} alt={product.imageAlt ?? product.name} loading="lazy" />
		{:else}
			<span class="product__ph" aria-hidden="true">{product.name.slice(0, 1)}</span>
		{/if}
		{#if product.soldOut}<span class="product__badge"
				><Badge tone="neutral">{t.soldOut}</Badge></span
			>
		{:else if onSale}<span class="product__badge"><Badge tone="danger">{t.sale}</Badge></span>{/if}
	</div>
	<div class="product__body">
		<svelte:element this={`h${level}`} class="product__name">
			{#if product.href}<a href={product.href}>{product.name}</a>{:else}{product.name}{/if}
		</svelte:element>
		{#if product.rating !== undefined}
			<RatingStars value={product.rating} count={product.reviewCount} size="sm" />
		{/if}
		<p class="product__price">
			{#if onSale}
				<span class="sr-only">{t.salePrice}:</span>
				<strong class="product__now">{money(product.salePriceCents ?? 0)}</strong>
				<span class="sr-only">{t.was}:</span>
				<del class="product__was">{money(product.priceCents)}</del>
			{:else}
				<strong class="product__now">{money(product.priceCents)}</strong>
			{/if}
		</p>
		<Button
			block
			variant={product.soldOut ? 'secondary' : 'primary'}
			disabled={product.soldOut}
			loading={adding}
			aria-label={product.soldOut
				? `${t.soldOut}: ${product.name}`
				: t.addFor.replace('{name}', product.name)}
			on:click={add}>{product.soldOut ? t.soldOut : t.add}</Button
		>
		<p class="sr-only" role="status">{status}</p>
	</div>
</article>

<style>
	.product {
		display: grid;
		grid-template-rows: auto 1fr;
		min-width: 0;
		overflow: hidden;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		color: var(--color-text);
	}

	.product__media {
		position: relative;
		aspect-ratio: 4 / 3;
		background: var(--color-surface-hover);
	}

	.product__media img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.product--out .product__media img {
		opacity: 0.6;
	}

	.product__ph {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		place-items: center;
		height: 100%;
		color: var(--color-text-secondary);
		font-size: 3rem;
		font-weight: 700;
	}

	.product__badge {
		position: absolute;
		inset-block-start: var(--spacing-sm);
		inset-inline-start: var(--spacing-sm);
	}

	.product__body {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		align-content: start;
		gap: var(--spacing-sm);
		padding: var(--spacing-md);
	}

	.product__name {
		margin: 0;
		font-size: 1rem;
		overflow-wrap: anywhere;
	}

	.product__name a {
		color: inherit;
		text-decoration: none;
	}

	.product__name a:hover {
		text-decoration: underline;
	}

	.product__price {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--spacing-sm);
		margin: 0;
	}

	.product__now {
		font-size: 1.125rem;
		font-variant-numeric: tabular-nums;
	}

	.product__was {
		color: var(--color-text-secondary);
		font-size: 0.875rem;
	}

	.product :global(.btn) {
		min-height: 2.75rem;
	}
</style>
