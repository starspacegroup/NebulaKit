<!--
	InvoiceList — billing history. A real table from 40rem up; below that each
	row becomes a card (the table roles are kept, so a screen reader still gets
	a table). Status is a badge with its word in it. The download action is a
	link when the invoice has a URL, and always an event. Pagination is a hook:
	pass every invoice and let it page, or pass one page plus `totalCount` and
	handle `pagechange` yourself.
-->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Badge from '$lib/ui/Badge.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import Pagination from '$lib/ui/Pagination.svelte';
	import { uid } from '$lib/ui/logic';
	import {
		formatCommerceDate,
		formatMoney,
		invoiceTone,
		invoiceTotals,
		paginateInvoices,
		type Invoice,
		type InvoiceStatus
	} from './logic';

	export let invoices: Invoice[] = [];
	export let currency = 'USD';
	export let locale = 'en-US';
	export let timeZone = 'UTC';
	export let page = 1;
	export let pageSize = 10;
	/** Set when `invoices` is already one page from the server. */
	export let totalCount: number | undefined = undefined;
	export let loading = false;
	export let heading = 'Invoices';
	export let level: 2 | 3 | 4 = 2;
	export let labels: Partial<typeof defaults> = {};

	const defaults = {
		number: 'Invoice',
		date: 'Date',
		description: 'Description',
		amount: 'Amount',
		status: 'Status',
		actions: 'Download',
		download: 'Download',
		downloadFor: 'Download invoice {number}',
		paid: 'Paid',
		open: 'Open',
		overdue: 'Overdue',
		void: 'Void',
		refunded: 'Refunded',
		totalPaid: 'Total paid',
		outstanding: 'Outstanding',
		empty: 'No invoices yet',
		emptyHint: 'Invoices appear here after your first payment.',
		loading: 'Loading invoices',
		pagination: 'Invoice pages',
		pageStatus: 'Page {page} of {pages}'
	};

	const dispatch = createEventDispatcher<{
		download: { invoice: Invoice };
		pagechange: { page: number };
	}>();
	const titleId = uid('invoices');

	$: t = { ...defaults, ...labels };
	$: paged = totalCount === undefined ? paginateInvoices(invoices, page, pageSize) : null;
	$: rows = paged ? paged.items : invoices;
	$: pages = paged ? paged.pages : Math.max(1, Math.ceil(totalCount! / pageSize));
	$: totals = invoiceTotals(invoices);
	$: money = (cents: number, cur?: string) => formatMoney(cents, cur ?? currency, locale);

	function changed(event: CustomEvent<{ page: number }>) {
		dispatch('pagechange', { page: event.detail.page });
	}

	function statusText(status: InvoiceStatus): string {
		return t[status];
	}
</script>

<section class="invoices" aria-labelledby={titleId} aria-busy={loading}>
	<svelte:element this={`h${level}`} class="invoices__title" id={titleId}>{heading}</svelte:element>

	{#if loading}
		<p class="invoices__loading" role="status">{t.loading}…</p>
	{:else if invoices.length === 0}
		<EmptyState title={t.empty} description={t.emptyHint} icon="🧾" />
	{:else}
		<div class="table" role="table" aria-labelledby={titleId}>
			<div class="table__head" role="rowgroup">
				<div class="row row--head" role="row">
					<span role="columnheader">{t.number}</span>
					<span role="columnheader">{t.date}</span>
					<span role="columnheader" class="col-desc">{t.description}</span>
					<span role="columnheader" class="col-amount">{t.amount}</span>
					<span role="columnheader">{t.status}</span>
					<span role="columnheader" class="col-action"
						><span class="sr-only">{t.actions}</span></span
					>
				</div>
			</div>
			<div role="rowgroup">
				{#each rows as invoice (invoice.id)}
					<div class="row" role="row">
						<span role="cell" class="cell cell--number" data-label={t.number}>{invoice.number}</span
						>
						<span role="cell" class="cell" data-label={t.date}
							><time datetime={invoice.date}
								>{formatCommerceDate(invoice.date, locale, timeZone)}</time
							></span
						>
						<span
							role="cell"
							class="cell col-desc"
							class:cell--empty={!invoice.description}
							data-label={t.description}>{invoice.description ?? ''}</span
						>
						<span role="cell" class="cell col-amount" data-label={t.amount}
							>{money(invoice.amountCents, invoice.currency)}</span
						>
						<span role="cell" class="cell" data-label={t.status}
							><Badge tone={invoiceTone(invoice.status)}>{statusText(invoice.status)}</Badge></span
						>
						<span role="cell" class="cell col-action">
							{#if invoice.downloadUrl}
								<a
									class="dl"
									href={invoice.downloadUrl}
									download
									aria-label={t.downloadFor.replace('{number}', invoice.number)}
									on:click={() => dispatch('download', { invoice })}>{t.download}</a
								>
							{:else}
								<button
									type="button"
									class="dl"
									aria-label={t.downloadFor.replace('{number}', invoice.number)}
									on:click={() => dispatch('download', { invoice })}>{t.download}</button
								>
							{/if}
						</span>
					</div>
				{/each}
			</div>
		</div>

		<dl class="totals">
			<div>
				<dt>{t.totalPaid}</dt>
				<dd>{money(totals.paid)}</dd>
			</div>
			<div>
				<dt>{t.outstanding}</dt>
				<dd>{money(totals.outstanding)}</dd>
			</div>
		</dl>

		{#if pages > 1}
			<p class="sr-only" role="status">
				{t.pageStatus
					.replace('{page}', String(paged ? paged.page : page))
					.replace('{pages}', String(pages))}
			</p>
			<Pagination
				page={paged ? paged.page : page}
				total={pages}
				label={t.pagination}
				on:change={(e) => {
					page = e.detail.page;
					changed(e);
				}}
			/>
		{/if}
	{/if}
</section>

<style>
	.invoices {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
		min-width: 0;
		color: var(--color-text);
	}

	.invoices__title {
		margin: 0;
		font-size: 1.25rem;
	}

	.invoices__loading {
		margin: 0;
		color: var(--color-text-secondary);
	}

	/* Mobile: every row is a card. */
	.table {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-sm);
		min-width: 0;
	}

	.table__head {
		display: none;
	}

	.row {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-xs);
		padding: var(--spacing-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
	}

	.table > div[role='rowgroup']:last-child {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-sm);
	}

	.cell {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-md);
		min-width: 0;
	}

	.cell::before {
		content: attr(data-label);
		color: var(--color-text-secondary);
		font-size: 0.8125rem;
	}

	.cell--number {
		font-weight: 700;
	}

	.col-action {
		justify-content: flex-end;
	}

	.col-action::before {
		content: none;
	}

	.cell--empty {
		display: none;
	}

	.dl {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 2.75rem;
		min-height: 2.75rem;
		padding: 0 var(--spacing-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-background);
		color: var(--color-primary);
		font: inherit;
		font-weight: 600;
		text-decoration: none;
		cursor: pointer;
	}

	.dl:hover {
		background: var(--color-surface-hover);
	}

	.totals {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-md) var(--spacing-xl);
		margin: 0;
	}

	.totals dt {
		color: var(--color-text-secondary);
		font-size: 0.8125rem;
	}

	.totals dd {
		margin: 0;
		font-size: 1.125rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	@media (min-width: 40rem) {
		.table {
			gap: 0;
			border: 1px solid var(--color-border);
			border-radius: var(--radius-md);
			overflow-x: auto;
		}

		.table__head {
			display: block;
		}

		.table > div[role='rowgroup']:last-child {
			display: block;
		}

		.row {
			grid-template-columns: 1.2fr 1fr 1.6fr 1fr 1fr auto;
			align-items: center;
			gap: var(--spacing-md);
			min-width: 36rem;
			border: 0;
			border-bottom: 1px solid var(--color-border);
			border-radius: 0;
			background: transparent;
		}

		.row--head {
			background: var(--color-surface);
			color: var(--color-text-secondary);
			font-size: 0.8125rem;
			font-weight: 600;
		}

		.cell {
			display: block;
		}

		.cell::before {
			content: none;
		}

		.col-amount {
			font-variant-numeric: tabular-nums;
			text-align: end;
		}

		.cell--empty {
			display: block;
		}
	}
</style>
