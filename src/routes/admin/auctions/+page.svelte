<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const blank = {
		productId: '',
		slug: '',
		title: '',
		starting: '',
		reserve: '',
		buyNow: '',
		increment: '',
		startsAt: '',
		endsAt: '',
		extendSeconds: '300',
		payWithinHours: '72'
	};
	const v = $derived(
		form && 'values' in form && form.values && form.action === 'create' ? form.values : blank
	);
	const when = (iso: string) =>
		new Date(iso).toLocaleString('en-US', {
			dateStyle: 'medium',
			timeStyle: 'short',
			timeZone: 'UTC'
		}) + ' UTC';
	const phaseLabel: Record<string, string> = {
		scheduled: 'Scheduled',
		live: 'Live',
		ended: 'Ended, closing',
		sold: 'Sold',
		unsold: 'Ended without a sale',
		cancelled: 'Cancelled',
		lapsed: 'Lapsed, winner did not pay',
		open: 'Open'
	};
</script>

<svelte:head><title>Auctions</title></svelte:head>

<section class="auctions">
	<h1>Auctions</h1>
	<p>
		Sell one unit of a product to the highest bidder. Bidders name their top price and the auction
		bids for them, one step above the runner-up. Archive the product in
		<a href="/admin/products">Products</a> if it should not also be bought at a fixed price.
	</p>

	<div role="status" aria-live="polite">
		{#if form?.message}<p class="ok">{form.message}</p>{/if}
		{#if form?.problems}
			<ul class="error" role="alert">
				{#each form.problems as problem (problem)}<li>{problem}</li>{/each}
			</ul>
		{/if}
	</div>

	<form method="POST" action="?/create" use:enhance class="card" aria-labelledby="start-heading">
		<h2 id="start-heading">Start an auction</h2>
		<div class="fields">
			<label>
				Product
				<select name="product_id" required>
					<option value="" disabled selected={!v.productId}>Choose a product</option>
					{#each data.products as product (product.id)}
						<option value={product.id} selected={v.productId === product.id}>
							{product.name} ({product.price}){product.active ? '' : ', archived'}
						</option>
					{/each}
				</select>
			</label>
			<label>
				Title <span class="hint">(defaults to the product name)</span>
				<input name="title" maxlength="200" value={v.title} />
			</label>
			<label>
				Slug
				<input
					name="slug"
					required
					maxlength="80"
					pattern="[a-z0-9][a-z0-9\-]*"
					placeholder="blue-mug-auction"
					value={v.slug}
				/>
			</label>
			<label>
				Starting price
				<input
					name="starting"
					required
					inputmode="decimal"
					placeholder="10.00"
					value={v.starting}
				/>
			</label>
			<label>
				Reserve price <span class="hint">(hidden; optional)</span>
				<input name="reserve" inputmode="decimal" value={v.reserve} />
			</label>
			<label>
				Buy-now price <span class="hint">(optional)</span>
				<input name="buy_now" inputmode="decimal" value={v.buyNow} />
			</label>
			<label>
				Bid increment <span class="hint">(blank: grows with the price)</span>
				<input name="increment" inputmode="decimal" value={v.increment} />
			</label>
			<label>
				Extend by, seconds <span class="hint">(a late bid pushes the end out; 0 is off)</span>
				<input name="extend_seconds" inputmode="numeric" value={v.extendSeconds} />
			</label>
			<label>
				Winner must pay within, hours
				<span class="hint"
					>(0 is no deadline; use 0 or a long window if you take manual payment)</span
				>
				<input name="pay_within_hours" inputmode="numeric" value={v.payWithinHours} />
			</label>
			<label>
				Starts (UTC)
				<input name="starts_at" type="datetime-local" required value={v.startsAt} />
			</label>
			<label>
				Ends (UTC)
				<input name="ends_at" type="datetime-local" required value={v.endsAt} />
			</label>
		</div>
		<button type="submit">Start auction</button>
	</form>

	{#if data.auctions.length === 0}
		<p>No auctions yet.</p>
	{:else}
		<ul class="list" aria-label="Auctions">
			{#each data.auctions as auction (auction.id)}
				<li>
					<div class="head">
						<h3><a href="/auctions/{auction.slug}">{auction.title}</a></h3>
						<span class="badge">{phaseLabel[auction.phase] ?? auction.phase}</span>
					</div>
					<dl>
						<div>
							<dt>Starts</dt>
							<dd>{when(auction.startsAt)}</dd>
						</div>
						<div>
							<dt>Ends</dt>
							<dd>{when(auction.endsAt)}</dd>
						</div>
						<div>
							<dt>Start price</dt>
							<dd>{auction.starting}</dd>
						</div>
						{#if auction.reserve}<div>
								<dt>Reserve</dt>
								<dd>{auction.reserve}</dd>
							</div>{/if}
						{#if auction.buyNow}<div>
								<dt>Buy now</dt>
								<dd>{auction.buyNow}</dd>
							</div>{/if}
						<div>
							<dt>Bids</dt>
							<dd>{auction.bidCount}</dd>
						</div>
						{#if auction.current}<div>
								<dt>Current price</dt>
								<dd>{auction.current}</dd>
							</div>{/if}
						{#if auction.leaderEmail && auction.status === 'open'}
							<div>
								<dt>Leading</dt>
								<dd>{auction.leaderEmail}</dd>
							</div>
						{/if}
						{#if auction.final}<div>
								<dt>Sold for</dt>
								<dd>{auction.final}</dd>
							</div>{/if}
						{#if auction.winnerEmail}<div>
								<dt>Winner</dt>
								<dd>{auction.winnerEmail}</dd>
							</div>{/if}
						{#if auction.orderId}<div>
								<dt>Order</dt>
								<dd>{auction.orderId}</dd>
							</div>{/if}
						{#if auction.payDueAt && auction.status === 'sold'}
							<div>
								<dt>Payment due</dt>
								<dd>{when(auction.payDueAt)}</dd>
							</div>
						{/if}
						{#if auction.relistedFrom}
							<div>
								<dt>Relisted</dt>
								<dd>Yes</dd>
							</div>
						{/if}
					</dl>
					{#if auction.status === 'unsold' || auction.status === 'lapsed' || auction.status === 'cancelled'}
						<form method="POST" use:enhance class="actions">
							<input type="hidden" name="id" value={auction.id} />
							<button
								type="submit"
								formaction="?/relist"
								class="secondary"
								aria-label="Relist {auction.title}"
							>
								Relist
							</button>
						</form>
					{:else if auction.status === 'open'}
						<form method="POST" use:enhance class="actions">
							<input type="hidden" name="id" value={auction.id} />
							<button
								type="submit"
								formaction="?/end"
								class="secondary"
								aria-label="End {auction.title} now"
							>
								End now
							</button>
							<button
								type="submit"
								formaction="?/cancel"
								class="danger"
								aria-label="Cancel {auction.title}"
							>
								Cancel
							</button>
						</form>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.auctions {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		color: var(--color-text);
	}
	p {
		color: var(--color-text-secondary);
	}
	.card,
	.list li {
		padding: 1rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
	}
	.card {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	h2,
	h3 {
		margin: 0;
		font-size: 1.1rem;
		overflow-wrap: anywhere;
	}
	.fields {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 0.75rem;
	}
	@media (min-width: 40rem) {
		.fields {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	@media (min-width: 64rem) {
		.fields {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.hint {
		color: var(--color-text-secondary);
		font-size: 0.8rem;
	}
	input,
	select {
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
	button.danger {
		background: var(--color-danger-solid);
		color: var(--color-on-solid);
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.badge {
		padding: 0.1rem 0.5rem;
		border: 1px solid var(--color-border);
		border-radius: 999px;
		color: var(--color-text-secondary);
		font-size: 0.75rem;
	}
	dl {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
		gap: 0.5rem 1rem;
		margin: 0.75rem 0;
	}
	dt {
		color: var(--color-text-secondary);
		font-size: 0.8rem;
	}
	dd {
		margin: 0;
		overflow-wrap: anywhere;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.ok {
		color: var(--color-success);
	}
	.error {
		margin: 0;
		padding-left: 1.25rem;
		color: var(--color-error);
	}
</style>
