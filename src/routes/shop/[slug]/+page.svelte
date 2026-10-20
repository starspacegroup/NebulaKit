<script lang="ts">
	import { addToCart, loadCart, saveCart } from '$lib/shop/cart';
	import { MAX_QUANTITY } from '@nebulakit/commerce';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let quantity = $state(1);
	let message = $state('');

	function add(event: SubmitEvent) {
		event.preventDefault();
		const { product } = data;
		const cart = addToCart(loadCart(localStorage), {
			productId: product.id,
			slug: product.slug,
			name: product.name,
			unitPriceCents: product.priceCents,
			currency: product.currency,
			physical: product.physical,
			quantity
		});
		saveCart(localStorage, cart);
		message = `Added ${quantity} × ${product.name} to your cart.`;
	}
</script>

<svelte:head>
	<title>{data.product.name}</title>
	<meta name="description" content={data.product.description.slice(0, 160)} />
</svelte:head>

<article class="product">
	<p><a href="/shop">← Shop</a></p>
	<div class="layout">
		{#if data.product.imageUrl}<img src={data.product.imageUrl} alt="" />{/if}
		<div>
			<h1>{data.product.name}</h1>
			<p class="price">{data.product.price}</p>
			{#if data.product.description}<p>{data.product.description}</p>{/if}
			<form onsubmit={add}>
				<label>
					Quantity
					<input type="number" min="1" max={MAX_QUANTITY} step="1" bind:value={quantity} required />
				</label>
				<button type="submit">Add to cart</button>
			</form>
			<p role="status" class="status">
				{message}
				{#if message}<a href="/cart">View cart</a>{/if}
			</p>
		</div>
	</div>
</article>

<style>
	.product {
		max-width: 64rem;
		margin: 0 auto;
		padding: 1.5rem 1rem;
		color: var(--color-text);
	}
	.layout {
		display: grid;
		gap: 1.5rem;
	}
	@media (min-width: 48rem) {
		.layout:has(img) {
			grid-template-columns: 1fr 1fr;
		}
	}
	img {
		width: 100%;
		border-radius: var(--radius-md);
	}
	.price {
		font-size: 1.25rem;
		font-weight: 600;
	}
	form {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 1rem;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	input {
		width: 6rem;
		min-height: 2.75rem;
		padding: 0 0.5rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-background);
		color: var(--color-text);
		font: inherit;
	}
	button {
		min-height: 2.75rem;
		padding: 0 1.25rem;
		border: 0;
		border-radius: var(--radius-md);
		background: var(--color-primary-solid);
		color: var(--color-on-solid);
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}
	.status {
		min-height: 1.5rem;
		color: var(--color-text-secondary);
	}
</style>
