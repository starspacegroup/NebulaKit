<script lang="ts">
	import type { PageData } from './$types';
	import ObfuscatedText from '$lib/components/admin/ObfuscatedText.svelte';

	export let data: PageData;

	function formatDate(value: string): string {
		const d = new Date(value);
		return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
	}
</script>

<svelte:head>
	<title>Contact Form Submissions | Admin</title>
</svelte:head>

<div class="page-header">
	<h1>Contact Form Submissions</h1>
	<a
		class="filter-link"
		href={data.unresolvedOnly
			? '/admin/contact-form-submissions'
			: '/admin/contact-form-submissions?unresolved=1'}
	>
		{data.unresolvedOnly ? '← Show all' : 'Unresolved only'}
	</a>
</div>

<p class="count">{data.total} submission{data.total === 1 ? '' : 's'}</p>

{#if data.submissions.length === 0}
	<p class="empty">No submissions{data.unresolvedOnly ? ' awaiting review' : ' yet'}.</p>
{:else}
	<div class="table-wrap">
		<table>
			<thead>
				<tr>
					<th>Date</th>
					<th>Name</th>
					<th>Email</th>
					<th>Status</th>
					<th></th>
				</tr>
			</thead>
			<tbody>
				{#each data.submissions as s (s.id)}
					<tr>
						<td>{formatDate(s.createdAt)}</td>
						<td><ObfuscatedText value={s.name} /></td>
						<td><ObfuscatedText value={s.email} /></td>
						<td>
							<span class="badge" class:resolved={s.isResolved}>
								{s.isResolved ? 'Resolved' : 'Open'}
							</span>
						</td>
						<td><a href="/admin/contact-form-submission/{s.id}">View</a></td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	{#if data.totalPages > 1}
		<div class="pagination">
			{#if data.page > 1}
				<a
					href="/admin/contact-form-submissions?page={data.page - 1}{data.unresolvedOnly
						? '&unresolved=1'
						: ''}">← Prev</a
				>
			{/if}
			<span>Page {data.page} of {data.totalPages}</span>
			{#if data.page < data.totalPages}
				<a
					href="/admin/contact-form-submissions?page={data.page + 1}{data.unresolvedOnly
						? '&unresolved=1'
						: ''}">Next →</a
				>
			{/if}
		</div>
	{/if}
{/if}

<style>
	.page-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-md);
		flex-wrap: wrap;
	}

	h1 {
		font-size: 1.75rem;
		font-weight: 700;
		color: var(--color-text);
	}

	.filter-link {
		color: var(--color-primary);
		text-decoration: none;
		font-size: 0.9rem;
	}

	.count {
		color: var(--color-text-secondary);
		margin: var(--spacing-sm) 0 var(--spacing-lg);
	}

	.empty {
		color: var(--color-text-secondary);
		padding: var(--spacing-xl) 0;
	}

	.table-wrap {
		overflow-x: auto;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9rem;
	}

	th,
	td {
		text-align: left;
		padding: var(--spacing-md);
		border-bottom: 1px solid var(--color-border);
		white-space: nowrap;
	}

	th {
		color: var(--color-text-secondary);
		font-weight: 600;
		background: var(--color-surface);
	}

	tbody tr:last-child td {
		border-bottom: none;
	}

	td {
		color: var(--color-text);
	}

	td a {
		color: var(--color-primary);
		text-decoration: none;
	}

	.badge {
		display: inline-block;
		padding: 0.15rem var(--spacing-sm);
		border-radius: var(--radius-sm);
		font-size: 0.8rem;
		background: color-mix(in srgb, var(--color-warning) 15%, transparent);
		color: var(--color-warning);
	}

	.badge.resolved {
		background: color-mix(in srgb, var(--color-success) 15%, transparent);
		color: var(--color-success);
	}

	.pagination {
		display: flex;
		align-items: center;
		gap: var(--spacing-lg);
		margin-top: var(--spacing-lg);
		color: var(--color-text-secondary);
		font-size: 0.9rem;
	}

	.pagination a {
		color: var(--color-primary);
		text-decoration: none;
	}
</style>
