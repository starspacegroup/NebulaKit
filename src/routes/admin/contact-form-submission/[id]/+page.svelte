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
	<title>Contact Submission | Admin</title>
</svelte:head>

<a class="back" href="/admin/contact-form-submissions">← Back to submissions</a>

<div class="detail-card">
	<div class="detail-header">
		<h1>Submission</h1>
		<span class="badge" class:resolved={data.submission.isResolved}>
			{data.submission.isResolved ? 'Resolved' : 'Open'}
		</span>
	</div>

	<dl>
		<dt>ID</dt>
		<dd class="mono">{data.submission.id}</dd>

		<dt>Date</dt>
		<dd>{formatDate(data.submission.createdAt)}</dd>

		<dt>Name</dt>
		<dd><ObfuscatedText value={data.submission.name} /></dd>

		<dt>Email</dt>
		<dd><ObfuscatedText value={data.submission.email} /></dd>
	</dl>

	<div class="message">
		<h2>Message</h2>
		<p>{data.submission.message}</p>
	</div>

	{#if !data.submission.isResolved}
		<form method="POST" action="?/resolve">
			<button type="submit" class="resolve-btn">Mark as Resolved</button>
		</form>
	{/if}
</div>

<style>
	.back {
		display: inline-block;
		margin-bottom: var(--spacing-lg);
		color: var(--color-primary);
		text-decoration: none;
		font-size: 0.9rem;
	}

	.detail-card {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: var(--spacing-xl);
		max-width: 42rem;
	}

	.detail-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: var(--spacing-lg);
	}

	h1 {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--color-text);
	}

	dl {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: var(--spacing-sm) var(--spacing-lg);
		margin-bottom: var(--spacing-xl);
	}

	dt {
		color: var(--color-text-secondary);
		font-size: 0.9rem;
	}

	dd {
		color: var(--color-text);
		word-break: break-word;
	}

	.mono {
		font-family: var(--font-mono);
		font-size: 0.85rem;
	}

	.message h2 {
		font-size: 1rem;
		color: var(--color-text);
		margin-bottom: var(--spacing-sm);
	}

	.message p {
		white-space: pre-wrap;
		color: var(--color-text);
		background: var(--color-background);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		padding: var(--spacing-md);
		margin-bottom: var(--spacing-xl);
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

	.resolve-btn {
		padding: var(--spacing-md) var(--spacing-xl);
		border: none;
		border-radius: var(--radius-md);
		background: var(--color-primary);
		color: var(--color-background);
		font: inherit;
		font-weight: 600;
		cursor: pointer;
		transition: background var(--transition-fast);
	}

	.resolve-btn:hover {
		background: var(--color-primary-hover);
	}
</style>
