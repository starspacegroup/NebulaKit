<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const order = $derived(data.order);
</script>

<svelte:head><title>Order {data.order.ref}</title></svelte:head>

<section class="order">
	<p><a href="/admin/orders">All orders</a></p>
	<h1>Order {order.ref}</h1>

	<dl class="facts card">
		<div>
			<dt>Status</dt>
			<dd class="status">{order.status}</dd>
		</div>
		<div>
			<dt>Placed</dt>
			<dd>{order.created}</dd>
		</div>
		<div>
			<dt>Last change</dt>
			<dd>{order.updated}</dd>
		</div>
		<div>
			<dt>Email</dt>
			<dd>{order.email}</dd>
		</div>
		{#if order.address}
			<div>
				<dt>Ships to</dt>
				<dd>{order.address.name}, {order.address.lines} ({order.address.country})</dd>
			</div>
		{/if}
		<div>
			<dt>Paid with</dt>
			<dd>{order.paymentProvider ?? '—'}</dd>
		</div>
		<div>
			<dt>Payment reference</dt>
			<dd class="mono">
				{order.paymentReference ?? '—'}
				{#if order.stripeUrl}
					<a href={order.stripeUrl} target="_blank" rel="noopener noreferrer">Open in Stripe</a>
				{/if}
			</dd>
		</div>
	</dl>

	<h2>Lines</h2>
	<div class="table-wrap">
		<table>
			<caption class="sr-only">Order lines</caption>
			<thead>
				<tr>
					<th scope="col">Item</th>
					<th scope="col" class="num">Qty</th>
					<th scope="col" class="num">Unit</th>
					<th scope="col" class="num">Line</th>
				</tr>
			</thead>
			<tbody>
				{#each order.items as item (item.id)}
					<tr>
						<td>{item.name}</td>
						<td class="num">{item.quantity}</td>
						<td class="num">{item.unit}</td>
						<td class="num">{item.total}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<dl class="totals card">
		<div>
			<dt>Subtotal</dt>
			<dd>{order.subtotal}</dd>
		</div>
		<div>
			<dt>Shipping</dt>
			<dd>{order.shipping}</dd>
		</div>
		<div>
			<dt>Tax</dt>
			<dd>{order.tax}</dd>
		</div>
		<div class="grand">
			<dt>Total</dt>
			<dd>{order.total}</dd>
		</div>
	</dl>

	{#if order.regional}
		<p class="note">
			Regional pricing: charged {order.regional.percent}% of catalog (catalog subtotal {order
				.regional.base}). Countries seen: {order.regional.countries}.
		</p>
	{/if}

	<h2>Payment history</h2>
	{#if data.events.length === 0}
		<p class="note">Stripe has not reported anything about this order yet.</p>
	{:else}
		<div class="table-wrap">
			<table>
				<caption class="sr-only">Payment history from Stripe</caption>
				<thead>
					<tr>
						<th scope="col">Received</th>
						<th scope="col">Event</th>
						<th scope="col">What the site did</th>
						<th scope="col" class="num">Amount</th>
					</tr>
				</thead>
				<tbody>
					{#each data.events as event (event.id)}
						<tr>
							<td>{event.received}</td>
							<td class="mono">{event.type}</td>
							<td>{event.outcome}</td>
							<td class="num">{event.amount ?? '—'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p class="note">
			A refund's amount is the total refunded so far. Refunds do not change the order's status;
			cancel or adjust the order separately if needed.
		</p>
	{/if}
</section>

<style>
	.order {
		max-width: var(--layout-page-max-width);
		display: flex;
		flex-direction: column;
		gap: 1rem;
		min-width: 0;
		color: var(--color-text);
	}
	h1,
	h2,
	p {
		margin: 0;
	}
	a {
		color: var(--color-primary);
	}
	a:focus-visible {
		outline: 3px solid var(--color-primary);
		outline-offset: 2px;
	}
	.card {
		margin: 0;
		padding: 1rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
	}
	dl div {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 0.25rem 1rem;
		padding: 0.25rem 0;
	}
	dt {
		color: var(--color-text-secondary);
	}
	dd {
		margin: 0;
		overflow-wrap: anywhere;
	}
	.status {
		text-transform: capitalize;
		font-weight: 600;
	}
	.mono {
		font-family: var(--font-mono, monospace);
	}
	.totals dd {
		font-variant-numeric: tabular-nums;
	}
	.totals .grand {
		border-top: 1px solid var(--color-border);
		font-weight: 700;
	}
	.table-wrap {
		overflow-x: auto;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
	}
	table {
		width: 100%;
		border-collapse: collapse;
	}
	th,
	td {
		padding: 0.6rem 0.75rem;
		border-bottom: 1px solid var(--color-border);
		text-align: left;
	}
	th {
		color: var(--color-text-secondary);
		font-weight: 600;
	}
	tbody tr:last-child td {
		border-bottom: 0;
	}
	.num {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	.note {
		color: var(--color-text-secondary);
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
</style>
