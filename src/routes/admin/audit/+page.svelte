<script lang="ts">
	import { AuditLog } from '$lib/modules/data';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Audit log</title></svelte:head>

<section class="audit-page">
	<header>
		<h1>Audit log</h1>
		<p>
			Who changed what from the admin area or the site API. Changes only: page views and reads are
			not recorded, and secret values never are. Entries are kept {data.retentionDays} days.
		</p>
	</header>

	<form method="GET" class="filters" aria-label="Narrow the log">
		<label>
			Actor
			<input name="actor" value={data.actor} maxlength="100" autocomplete="off" />
		</label>
		<label>
			Action
			<select name="action">
				<option value="">Any action</option>
				{#each data.actions as name (name)}
					<option value={name} selected={name === data.action}>{name}</option>
				{/each}
			</select>
		</label>
		<button type="submit">Apply</button>
		{#if data.actor || data.action}<a href="/admin/audit">Clear</a>{/if}
	</form>

	<AuditLog label="Admin actions" events={data.events} pageSize={25} exportable={false} />
</section>

<style>
	.audit-page {
		display: grid;
		gap: var(--spacing-md);
	}

	h1,
	p {
		margin: 0;
	}

	header p {
		color: var(--color-text-secondary);
	}

	.filters {
		display: flex;
		flex-wrap: wrap;
		align-items: end;
		gap: var(--spacing-md);
	}

	.filters label {
		display: grid;
		gap: var(--spacing-xs);
		font-weight: 600;
	}

	.filters input,
	.filters select {
		min-height: 2.75rem;
		padding: 0 var(--spacing-sm);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-text);
		font: inherit;
	}

	.filters button {
		min-height: 2.75rem;
		padding: 0 var(--spacing-lg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-text);
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}

	.filters a {
		align-self: center;
		color: var(--color-primary);
	}
</style>
