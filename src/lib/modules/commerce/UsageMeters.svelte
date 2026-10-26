<!--
	UsageMeters — quota bars: how much of each limit is used.

	Each bar is role="meter" with a text value ("8,400 of 10,000 API calls"),
	and the state is written out ("Near limit", "Over by 1,200"), never shown by
	colour alone. A limit of null means unlimited. Reset date is printed with
	Intl in the given time zone.
-->
<script lang="ts">
	import { uid } from '$lib/ui/logic';
	import {
		type UsageMeter,
		daysUntilDate,
		formatCommerceDate,
		formatUsageAmount,
		usageOverage,
		usagePercent,
		usageState,
		type UsageState
	} from './logic';

	export let meters: UsageMeter[] = [];
	/** Warn from this fraction of the limit. */
	export let warnAt = 0.8;
	/** ISO date the quotas reset. */
	export let resetsAt: string | undefined = undefined;
	export let now: Date | null = null;
	export let locale = 'en-US';
	export let timeZone = 'UTC';
	export let heading = 'Usage this period';
	export let level: 2 | 3 | 4 | 5 = 3;
	export let labels: Partial<typeof defaults> = {};

	const defaults = {
		ok: 'Within limit',
		warning: 'Near limit',
		over: 'Over by {amount}',
		unlimited: 'Unlimited',
		of: '{used} of {limit}',
		used: '{used} used',
		resets: 'Resets {date}',
		resetsIn: 'in {days} days',
		resetsToday: 'today',
		resetsTomorrow: 'tomorrow',
		empty: 'No usage to show.'
	};

	const titleId = uid('usage');

	$: t = { ...defaults, ...labels };

	function valueText(m: UsageMeter, state: UsageState): string {
		const used = formatUsageAmount(m.used, '', locale);
		const unit = m.unit ? ` ${m.unit}` : '';
		if (state === 'unlimited') return t.used.replace('{used}', used + unit);
		return (
			t.of.replace('{used}', used).replace('{limit}', formatUsageAmount(m.limit ?? 0, '', locale)) +
			unit
		);
	}

	function stateText(m: UsageMeter, state: UsageState): string {
		if (state === 'over') {
			return t.over.replace(
				'{amount}',
				formatUsageAmount(usageOverage(m.used, m.limit), m.unit ?? '', locale)
			);
		}
		return t[state];
	}

	$: reset = (() => {
		if (!resetsAt) return '';
		const date = formatCommerceDate(resetsAt, locale, timeZone);
		if (!date) return '';
		let text = t.resets.replace('{date}', date);
		if (now) {
			const d = daysUntilDate(resetsAt, now);
			const rel =
				d === 0
					? t.resetsToday
					: d === 1
						? t.resetsTomorrow
						: t.resetsIn.replace('{days}', String(d));
			text += ` (${rel})`;
		}
		return text;
	})();
</script>

<section class="usage" aria-labelledby={titleId}>
	<svelte:element this={`h${level}`} class="usage__title" id={titleId}>{heading}</svelte:element>
	{#if reset}<p class="usage__reset">{reset}</p>{/if}
	{#if meters.length === 0}
		<p class="usage__empty">{t.empty}</p>
	{:else}
		<ul class="usage__list">
			{#each meters as m (m.id)}
				{@const state = usageState(m.used, m.limit, warnAt)}
				{@const pct = usagePercent(m.used, m.limit)}
				<li class="meter meter--{state}">
					<div class="meter__head">
						<span class="meter__label" id="{titleId}-{m.id}-label">{m.label}</span>
						<span class="meter__state"
							><span class="meter__icon" aria-hidden="true"
								>{state === 'over'
									? '!'
									: state === 'warning'
										? '!'
										: state === 'ok'
											? '✓'
											: '∞'}</span
							>
							{stateText(m, state)}</span
						>
					</div>
					<div
						class="meter__track"
						role="meter"
						aria-labelledby="{titleId}-{m.id}-label"
						aria-valuemin={0}
						aria-valuemax={state === 'unlimited' ? Math.max(m.used, 1) : m.limit}
						aria-valuenow={state === 'unlimited' ? m.used : Math.min(m.used, m.limit ?? m.used)}
						aria-valuetext="{valueText(m, state)}. {stateText(m, state)}"
					>
						<div class="meter__bar" style:width="{state === 'unlimited' ? 0 : pct}%"></div>
					</div>
					<p class="meter__value">{valueText(m, state)}</p>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.usage {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-sm);
		min-width: 0;
	}

	.usage__title {
		margin: 0;
		font-size: 1.125rem;
	}

	.usage__reset,
	.usage__empty {
		margin: 0;
		color: var(--color-text-secondary);
		font-size: 0.875rem;
	}

	.usage__list {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.meter {
		--tone: var(--color-primary);
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-xs);
		min-width: 0;
	}

	.meter--warning {
		--tone: var(--color-warning);
	}

	.meter--over {
		--tone: var(--color-danger);
	}

	.meter--ok {
		--tone: var(--color-success);
	}

	.meter__head {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: var(--spacing-xs) var(--spacing-md);
		font-size: 0.9375rem;
	}

	.meter__label {
		color: var(--color-text);
		font-weight: 600;
	}

	.meter__state {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-xs);
		color: var(--color-text);
		font-size: 0.8125rem;
		font-weight: 600;
	}

	.meter__icon {
		display: inline-grid;
		place-items: center;
		width: 1.125rem;
		height: 1.125rem;
		border-radius: 50%;
		background: var(--tone);
		color: var(--color-background);
		font-size: 0.7rem;
		line-height: 1;
	}

	.meter__track {
		height: 0.625rem;
		overflow: hidden;
		border: 1px solid var(--color-border);
		border-radius: 999px;
		background: var(--color-surface-hover);
	}

	.meter__bar {
		height: 100%;
		background: var(--tone);
		transition: width var(--transition-base);
	}

	/* Over the limit: stripes as well as colour. */
	.meter--over .meter__bar {
		background-image: repeating-linear-gradient(
			45deg,
			transparent 0 6px,
			color-mix(in srgb, var(--color-background) 35%, transparent) 6px 12px
		);
		background-color: var(--tone);
	}

	.meter__value {
		margin: 0;
		color: var(--color-text-secondary);
		font-size: 0.8125rem;
		font-variant-numeric: tabular-nums;
	}

	@media (forced-colors: active) {
		.meter__bar {
			background: Highlight;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.meter__bar {
			transition: none;
		}
	}
</style>
