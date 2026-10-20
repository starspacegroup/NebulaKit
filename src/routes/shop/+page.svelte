<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Shop</title>
	<meta name="description" content="Everything for sale on this site." />
</svelte:head>

<section class="shop">
	<header>
		<h1>Shop</h1>
		<a href="/cart">Cart</a>
	</header>
	{#if data.products.length === 0}
		<p>Nothing is for sale yet.</p>
	{:else}
		<ul class="grid">
			{#each data.products as product (product.slug)}
				<li>
					<a href="/shop/{product.slug}">
						{#if product.imageUrl}<img src={product.imageUrl} alt="" loading="lazy" />{/if}
						<span class="name">{product.name}</span>
						<span class="price">{product.price}</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.shop {
		max-width: 72rem;
		margin: 0 auto;
		padding: 1.5rem 1rem;
		color: var(--color-text);
	}
	header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
	}
	h1 {
		margin: 0 0 1rem;
	}
	.grid {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(14rem, 100%), 1fr));
		gap: 1rem;
	}
	.grid a {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		height: 100%;
		padding: 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: inherit;
		text-decoration: none;
	}
	.grid a:hover {
		border-color: var(--color-primary);
	}
	.grid img {
		width: 100%;
		aspect-ratio: 1;
		object-fit: cover;
		border-radius: var(--radius-sm);
	}
	.name {
		font-weight: 600;
	}
	.price {
		color: var(--color-text-secondary);
	}
</style>
