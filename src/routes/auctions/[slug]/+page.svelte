<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const a = $derived(data.auction);
	const when = (iso: string) =>
		new Date(iso).toLocaleString('en-US', {
			dateStyle: 'medium',
			timeStyle: 'short',
			timeZone: 'UTC'
		}) + ' UTC';
	const live = $derived(a.phase === 'live');
	const typedMax = $derived(form && 'max' in form && form.max ? String(form.max) : '');
</script>

<svelte:head>
	<title>{a.title} · Auction</title>
	<meta name="description" content={data.description.slice(0, 160) || `Bid on ${a.title}.`} />
</svelte:head>

<article class="auction">
	<p><a href="/auctions">← Auctions</a></p>
	<div class="layout">
		{#if data.imageUrl}<img src={data.imageUrl} alt="" />{/if}
		<div class="body">
			<h1>{a.title}</h1>
			{#if data.description}<p class="description">{data.description}</p>{/if}

			<dl class="facts">
				<div>
					<dt>{a.bidCount === 0 ? 'Starting price' : 'Current price'}</dt>
					<dd class="price">{a.price}</dd>
				</div>
				<div>
					<dt>Bids</dt>
					<dd>{a.bidCount}</dd>
				</div>
				<div>
					<dt>{a.phase === 'scheduled' ? 'Starts' : live ? 'Ends' : 'Ended'}</dt>
					<dd>{when(a.phase === 'scheduled' ? a.startsAt : a.endsAt)}</dd>
				</div>
				{#if a.reserve !== 'none'}
					<div>
						<dt>Reserve</dt>
						<dd>{a.reserve === 'met' ? 'Met' : 'Not yet met'}</dd>
					</div>
				{/if}
			</dl>

			{#if a.extendSeconds > 0 && live}
				<p class="note">
					A bid in the last {Math.round(a.extendSeconds / 60)} minutes extends the auction.
				</p>
			{/if}

			<div role="status" aria-live="polite" class="messages">
				{#if form?.message}<p class="ok">{form.message}</p>{/if}
				{#if form && 'problem' in form && form.problem}<p class="error" role="alert">
						{form.problem}
					</p>{/if}
				{#if a.youLead && !form?.message}<p class="ok">You are the highest bidder.</p>{/if}
			</div>

			{#if live}
				{#if data.signedIn}
					<form method="POST" action="?/bid" use:enhance class="bid">
						<label>
							Your maximum bid
							<input
								name="max"
								inputmode="decimal"
								required
								placeholder={a.minimumBidInput}
								value={typedMax}
								aria-describedby="bid-help"
							/>
						</label>
						<button type="submit">Place bid</button>
						<p id="bid-help" class="help">
							Minimum {a.minimumBid}. We bid for you, only as much as needed, up to your maximum.
						</p>
					</form>
					{#if a.buyNow?.available}
						<form method="POST" action="?/buynow" use:enhance class="buynow">
							<button type="submit" class="secondary">Buy now for {a.buyNow.price}</button>
						</form>
					{/if}
				{:else}
					<p>
						<a href="/auth/login?next=/auctions/{a.slug}">Sign in</a> to bid.
					</p>
				{/if}
			{:else if a.phase === 'scheduled'}
				<p>Bidding opens {when(a.startsAt)}.</p>
			{:else if a.phase === 'sold'}
				<p>Sold for {a.finalPrice}.</p>
			{:else if a.phase === 'unsold'}
				<p>This auction ended without a sale.</p>
			{:else if a.phase === 'lapsed'}
				<p>This auction ended without a completed sale.</p>
			{:else if a.phase === 'cancelled'}
				<p>This auction was cancelled.</p>
			{:else}
				<p>This auction has ended.</p>
			{/if}

			{#if a.youWon && data.order}
				<section class="won" aria-labelledby="won-heading">
					<h2 id="won-heading">You won this auction</h2>
					{#if data.order.status === 'pending'}
						<p>Total due: {data.order.total}</p>
						{#if a.payDueAt}<p>Please pay by {when(a.payDueAt)}.</p>{/if}
						<form method="POST" action="?/pay" use:enhance class="pay">
							{#if data.order.needsAddress}
								<label>Name <input name="name" required autocomplete="name" /></label>
								<label>Address <input name="line1" required autocomplete="address-line1" /></label>
								<label>Address line 2 <input name="line2" autocomplete="address-line2" /></label>
								<label>City <input name="city" required autocomplete="address-level2" /></label>
								<label>State or region <input name="state" autocomplete="address-level1" /></label>
								<label
									>Postal code <input
										name="postalCode"
										required
										autocomplete="postal-code"
									/></label
								>
								<label>
									Country code
									<input
										name="country"
										required
										maxlength="2"
										placeholder="US"
										autocomplete="country"
									/>
								</label>
							{/if}
							<button type="submit">Pay now</button>
						</form>
					{:else}
						<p>Your order is {data.order.status}. Thank you.</p>
					{/if}
				</section>
			{/if}
		</div>
	</div>

	<section aria-labelledby="history-heading">
		<h2 id="history-heading">Bid history</h2>
		{#if data.bids.length === 0}
			<p>No bids yet.</p>
		{:else}
			<ol class="history" aria-label="Bid history">
				{#each data.bids as bid, i (i)}
					<li>
						<span>{bid.bidder}</span>
						<span>{bid.price}</span>
						<time datetime={bid.at}>{when(bid.at)}</time>
					</li>
				{/each}
			</ol>
		{/if}
	</section>
</article>

<style>
	.auction {
		max-width: 64rem;
		margin: 0 auto;
		padding: 1.5rem 1rem;
		color: var(--color-text);
	}
	.layout {
		display: grid;
		gap: 1.5rem;
		grid-template-columns: minmax(0, 1fr);
	}
	@media (min-width: 48rem) {
		.layout:has(img) {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		}
	}
	img {
		width: 100%;
		height: auto;
		border-radius: var(--radius-md);
	}
	h1 {
		margin: 0 0 0.5rem;
		overflow-wrap: anywhere;
	}
	.description {
		color: var(--color-text-secondary);
	}
	.facts {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
		gap: 0.75rem;
		margin: 1rem 0;
	}
	.facts dt {
		color: var(--color-text-secondary);
		font-size: 0.875rem;
	}
	.facts dd {
		margin: 0;
	}
	.price {
		font-size: 1.5rem;
		font-weight: 600;
	}
	.note,
	.help {
		color: var(--color-text-secondary);
		font-size: 0.875rem;
	}
	.ok {
		color: var(--color-success);
	}
	.error {
		color: var(--color-error);
	}
	.bid,
	.pay {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin: 1rem 0;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	input {
		min-height: 2.75rem;
		padding: 0.5rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-background);
		color: var(--color-text);
		font: inherit;
	}
	button {
		min-height: 2.75rem;
		padding: 0 1rem;
		border: 0;
		border-radius: var(--radius-md);
		background: var(--color-primary-solid);
		color: var(--color-on-solid);
		font: inherit;
		cursor: pointer;
	}
	button.secondary {
		border: 1px solid var(--color-border);
		background: transparent;
		color: var(--color-text);
	}
	.won {
		margin-top: 1.5rem;
		padding: 1rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
	}
	.history {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
	}
	.history li {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.25rem 1rem;
		padding: 0.5rem 0;
		border-bottom: 1px solid var(--color-border);
	}
	.history time {
		grid-column: 1 / -1;
		color: var(--color-text-secondary);
		font-size: 0.875rem;
	}
</style>
