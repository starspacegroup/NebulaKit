<!--
	ComparisonTable — plans across, features down, as a real <table>.

	The table scrolls inside its own labelled, focusable region, so a narrow
	screen never scrolls the page and a keyboard user can scroll it with the
	arrow keys. The first column is sticky. A tick or dash always carries
	"Included" / "Not included" text for screen readers.
-->
<script lang="ts">
	export let caption: string;
	export let plans: { id: string; name: string }[] = [];
	export let rows: { id?: string; label: string; values: (boolean | string)[] }[] = [];
	/** Id of a plan to emphasise. */
	export let highlight = '';
	export let featureLabel = 'Feature';
	export let includedLabel = 'Included';
	export let excludedLabel = 'Not included';
	/** Accessible name of the scroll region; defaults to the caption. */
	export let regionLabel = '';
</script>

<!-- svelte-ignore a11y-no-noninteractive-tabindex -->
<div class="scroller" role="region" aria-label={regionLabel || caption} tabindex="0">
	<table>
		<caption class="sr-only">{caption}</caption>
		<thead>
			<tr>
				<th scope="col" class="corner">{featureLabel}</th>
				{#each plans as plan (plan.id)}
					<th scope="col" class:hl={plan.id === highlight}>{plan.name}</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each rows as row (row.id ?? row.label)}
				<tr>
					<th scope="row">{row.label}</th>
					{#each plans as plan, i (plan.id)}
						{@const value = row.values[i]}
						<td class:hl={plan.id === highlight}>
							{#if value === true}
								<span aria-hidden="true" class="yes">✓</span><span class="sr-only"
									>{includedLabel}</span
								>
							{:else if value === false || value === undefined}
								<span aria-hidden="true" class="no">–</span><span class="sr-only"
									>{excludedLabel}</span
								>
							{:else}
								{value}
							{/if}
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.scroller {
		max-inline-size: 100%;
		position: relative;
		overflow-x: auto;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-background);
	}

	.scroller:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	table {
		inline-size: 100%;
		min-inline-size: 36rem;
		border-collapse: separate;
		border-spacing: 0;
	}

	th,
	td {
		padding: var(--spacing-md);
		border-block-end: 1px solid var(--color-border);
		text-align: center;
	}

	thead th {
		background: var(--color-surface);
	}

	tbody th {
		text-align: start;
		font-weight: 500;
	}

	th:first-child {
		position: sticky;
		inset-inline-start: 0;
		z-index: 1;
		min-inline-size: 9rem;
		border-inline-end: 1px solid var(--color-border);
		background: var(--color-surface);
		text-align: start;
	}

	tbody tr:last-child th,
	tbody tr:last-child td {
		border-block-end: 0;
	}

	.hl {
		background: var(--color-surface-hover);
		font-weight: 700;
	}

	.yes {
		color: var(--color-success);
		font-weight: 700;
	}

	.no {
		color: var(--color-text-secondary);
	}
</style>
