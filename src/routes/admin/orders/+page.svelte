<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Orders</title></svelte:head>

<section class="orders">
	<h1>Orders</h1>
	<p>
		Every order the shop has taken, newest first. An order becomes paid only when Stripe's signed
		notice reaches the site; refunds are made in Stripe and show on the order's page.
	</p>

	<nav class="filters" aria-label="Filter orders by status">
		<a href="/admin/orders" aria-current={data.status === null ? 'page' : undefined}>All</a>
		{#each data.statuses as status (status)}
			<a
				href="/admin/orders?status={status}"
				aria-current={data.status === status ? 'page' : undefined}>{status}</a
			>
		{/each}
	</nav>

	{#if data.orders.length === 0}
		<p class="empty">No orders{data.status ? ` with status ${data.status}` : ''} yet.</p>
	{:else}
		<div class="table-wrap">
			<table>
				<caption class="sr-only">Orders</caption>
				<thead>
					<tr>
						<th scope="col">Order</th>
						<th scope="col">Placed</th>
						<th scope="col">Email</th>
						<th scope="col">Status</th>
						<th scope="col" class="num">Total</th>
						<th scope="col">Paid with</th>
					</tr>
				</thead>
				<tbody>
					{#each data.orders as order (order.id)}
						<tr>
							<td><a href="/admin/orders/{order.id}">{order.ref}</a></td>
							<td>{order.created}</td>
							<td>{order.email}</td>
							<td><span class="status status-{order.status}">{order.status}</span></td>
							<td class="num">{order.total}</td>
							<td>{order.provider}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>

<style>
	.orders {
		max-width: var(--layout-page-max-width);
		display: flex;
		flex-direction: column;
		gap: 1rem;
		min-width: 0;
		color: var(--color-text);
	}
	p {
		margin: 0;
	}
	.filters {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.filters a {
		padding: 0.35rem 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		color: var(--color-text);
		text-decoration: none;
		text-transform: capitalize;
	}
	.filters a[aria-current='page'] {
		border-color: var(--color-primary);
		font-weight: 600;
	}
	.filters a:focus-visible,
	td a:focus-visible {
		outline: 3px solid var(--color-primary);
		outline-offset: 2px;
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
		white-space: nowrap;
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
	td a {
		color: var(--color-primary);
		font-family: var(--font-mono, monospace);
	}
	.status {
		text-transform: capitalize;
	}
	.empty {
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
