<!--
  TrustBadges — a strip of badges a visitor can check for themselves.
  Each badge links to its live public report and shows the date it was
  measured. Failed or stale checks are not shown. See docs/TRUST_BADGES.md.
-->
<script lang="ts">
	import { visibleTrustChecks, DEFAULT_MAX_AGE_DAYS, type TrustCheck } from '$lib/seo/trust-badges';

	export let checks: TrustCheck[];
	export let heading: string = 'Check it yourself';
	export let maxAgeDays: number = DEFAULT_MAX_AGE_DAYS;
	/** Injectable for tests. */
	export let now: Date = new Date();

	$: shown = visibleTrustChecks(checks, now, maxAgeDays);
</script>

{#if shown.length}
	<section class="trust" aria-label={heading}>
		<h2 class="trust-heading">{heading}</h2>
		<ul>
			{#each shown as c}
				<li>
					<a href={c.reportUrl} target="_blank" rel="noopener noreferrer">
						<span class="label">{c.label}</span>
						<span class="date">measured <time datetime={c.measuredOn}>{c.measuredOn}</time></span>
					</a>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<style>
	.trust-heading {
		font-size: 0.875rem;
		color: var(--color-text-secondary);
		margin: 0 0 var(--spacing-sm);
	}
	ul {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-sm);
		list-style: none;
		margin: 0;
		padding: 0;
	}
	a {
		display: inline-flex;
		flex-direction: column;
		padding: var(--spacing-xs) var(--spacing-sm);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md, 0.5rem);
		background: var(--color-surface);
		color: var(--color-text);
		text-decoration: none;
	}
	a:hover,
	a:focus-visible {
		border-color: var(--color-primary);
	}
	.label {
		font-weight: 600;
	}
	.date {
		font-size: 0.75rem;
		color: var(--color-text-secondary);
	}
</style>
