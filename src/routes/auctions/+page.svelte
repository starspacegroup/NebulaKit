<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const when = (iso: string) =>
		new Date(iso).toLocaleString('en-US', {
			dateStyle: 'medium',
			timeStyle: 'short',
			timeZone: 'UTC'
		}) + ' UTC';
</script>

<svelte:head>
	<title>Auctions</title>
	<meta name="description" content="Bid on what is up for auction on this site." />
</svelte:head>

<section class="auctions">
	<header>
		<h1>Auctions</h1>
		<a href="/shop">Shop</a>
	</header>

	{#if data.open.length === 0}
		<p>No auctions are open right now.</p>
	{:else}
		<ul class="grid" aria-label="Open auctions">
			{#each data.open as auction (auction.id)}
				<li>
					<a href="/auctions/{auction.slug}">
						<span class="name">{auction.title}</span>
						<span class="price">{auction.price}</span>
						<span class="meta">
							{#if auction.phase === 'scheduled'}
								Starts {when(auction.startsAt)}
							{:else}
								{auction.bidCount}
								{auction.bidCount === 1 ? 'bid' : 'bids'} · ends {when(auction.endsAt)}
							{/if}
						</span>
						{#if auction.youLead}<span class="badge">You are winning</span>{/if}
					</a>
				</li>
			{/each}
		</ul>
	{/if}

	{#if data.sold.length > 0}
		<h2>Recently sold</h2>
		<ul class="grid" aria-label="Recently sold auctions">
			{#each data.sold as auction (auction.id)}
				<li>
					<a href="/auctions/{auction.slug}">
						<span class="name">{auction.title}</span>
						<span class="price">Sold for {auction.finalPrice}</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.auctions {
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
		margin: 0 0 1.5rem;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(16rem, 100%), 1fr));
		gap: 1rem;
	}
	.grid a {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		height: 100%;
		padding: 1rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: inherit;
		text-decoration: none;
	}
	.name {
		font-weight: 600;
		overflow-wrap: anywhere;
	}
	.price {
		font-size: 1.25rem;
	}
	.meta {
		color: var(--color-text-secondary);
		font-size: 0.875rem;
	}
	.badge {
		align-self: flex-start;
		padding: 0.1rem 0.5rem;
		border: 1px solid var(--color-border);
		border-radius: 999px;
		font-size: 0.75rem;
	}
</style>
