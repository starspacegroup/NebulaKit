<!--
	PricingTable — plans with a monthly / annual switch.

	The switch is a radio group (arrow keys work natively). Prices are
	formatted with Intl for `currency` and `locale`. Plans stack as cards on a
	phone and sit side by side from 48rem. Each feature says "Included:" or
	"Not included:" to a screen reader, so the tick and dash are not the only
	signal. Choosing a plan fires `select` with the plan id and interval.
-->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Badge from '$lib/ui/Badge.svelte';
	import Button from '$lib/ui/Button.svelte';
	import { uid } from '$lib/ui/logic';
	import {
		annualSavings,
		bestSavingsPercent,
		billedAmount,
		featureStatus,
		formatPlanPrice,
		isFreePlan,
		monthlyEquivalent,
		type PlanInterval,
		type MarketingPlan
	} from './logic';

	export let plans: MarketingPlan[] = [];
	export let interval: PlanInterval = 'monthly';
	export let currency = 'USD';
	export let locale = 'en-US';
	export let title = '';
	export let level: 2 | 3 | 4 = 2;
	export let labels = {
		billing: 'Billing period',
		monthly: 'Monthly',
		annual: 'Annual',
		perMonth: '/ month',
		free: 'Free',
		billedMonthly: 'Billed monthly',
		billedAnnually: (total: string) => `Billed ${total} per year`,
		save: (percent: number) => `Save ${percent}%`,
		saveUpTo: (percent: number) => `Save up to ${percent}% with annual billing`,
		included: 'Included:',
		excluded: 'Not included:',
		choose: (name: string) => `Choose ${name}`
	};

	const name = uid('billing');
	const titleId = uid('pricing');
	const dispatch = createEventDispatcher<{
		select: { planId: string; interval: PlanInterval };
		intervalchange: { interval: PlanInterval };
	}>();

	$: bestPercent = bestSavingsPercent(plans);

	function setBilling(next: PlanInterval) {
		interval = next;
		dispatch('intervalchange', { interval: next });
	}
</script>

<section class="pricing" aria-labelledby={title ? titleId : undefined}>
	{#if title}
		<svelte:element this={`h${level}`} id={titleId} class="pricing__title">{title}</svelte:element>
	{/if}

	<fieldset class="switch">
		<legend class="sr-only">{labels.billing}</legend>
		<label class="switch__option" class:switch__option--on={interval === 'monthly'}>
			<input
				type="radio"
				{name}
				value="monthly"
				checked={interval === 'monthly'}
				on:change={() => setBilling('monthly')}
			/>
			<span>{labels.monthly}</span>
		</label>
		<label class="switch__option" class:switch__option--on={interval === 'annual'}>
			<input
				type="radio"
				{name}
				value="annual"
				checked={interval === 'annual'}
				on:change={() => setBilling('annual')}
			/>
			<span>{labels.annual}</span>
		</label>
	</fieldset>
	{#if bestPercent > 0}
		<p class="pricing__save">{labels.saveUpTo(bestPercent)}</p>
	{/if}

	<ul class="plans">
		{#each plans as plan (plan.id)}
			{@const free = isFreePlan(plan)}
			{@const savings = annualSavings(plan)}
			<li class="plan" class:plan--highlight={plan.highlighted}>
				<div class="plan__head">
					<svelte:element this={`h${Math.min(level + 1, 6)}`} class="plan__name"
						>{plan.name}</svelte:element
					>
					{#if plan.highlighted && plan.badge}<Badge tone="info">{plan.badge}</Badge>{/if}
				</div>
				{#if plan.description}<p class="plan__desc">{plan.description}</p>{/if}
				<p class="plan__price">
					{#if free}
						<span class="plan__amount">{labels.free}</span>
					{:else}
						<span class="plan__amount"
							>{formatPlanPrice(monthlyEquivalent(plan, interval), currency, locale)}</span
						>
						<span class="plan__per">{labels.perMonth}</span>
					{/if}
				</p>
				<p class="plan__billed">
					{#if free}
						&nbsp;
					{:else if interval === 'annual'}
						{labels.billedAnnually(formatPlanPrice(billedAmount(plan, 'annual'), currency, locale))}
						{#if savings.percent > 0}<strong class="plan__badge"
								>{labels.save(savings.percent)}</strong
							>{/if}
					{:else}
						{labels.billedMonthly}
					{/if}
				</p>
				<ul class="plan__features">
					{#each plan.features as feature (feature.text)}
						<li class:plan__feature--off={!feature.included}>
							<span class="plan__mark" aria-hidden="true">{feature.included ? '✓' : '–'}</span>
							<span class="sr-only"
								>{featureStatus(feature.included, labels.included, labels.excluded)}</span
							>
							{feature.text}
						</li>
					{/each}
				</ul>
				<Button
					size="lg"
					block
					variant={plan.highlighted ? 'primary' : 'secondary'}
					href={plan.href}
					on:click={() => dispatch('select', { planId: plan.id, interval })}
					>{#if plan.cta}{plan.cta}<span class="sr-only"> – {plan.name}</span>{:else}{labels.choose(
							plan.name
						)}{/if}</Button
				>
			</li>
		{/each}
	</ul>
</section>

<style>
	.pricing {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		justify-items: center;
		gap: var(--spacing-md);
		min-width: 0;
	}

	.pricing__title {
		margin: 0;
		text-align: center;
		font-size: 1.75rem;
	}

	.switch {
		display: inline-flex;
		margin: 0;
		padding: 0.25rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-xl);
		background: var(--color-surface);
	}

	.switch__option {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-block-size: 2.75rem;
		min-inline-size: 5.5rem;
		padding-inline: var(--spacing-md);
		border-radius: var(--radius-lg);
		cursor: pointer;
		font-weight: 600;
	}

	.switch__option--on {
		background: var(--color-primary-solid);
		color: var(--color-on-solid);
	}

	.switch__option input {
		position: absolute;
		inset: 0;
		margin: 0;
		opacity: 0;
		cursor: pointer;
	}

	.switch__option:has(input:focus-visible) {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.pricing__save {
		margin: 0;
		color: var(--color-text-secondary);
		font-size: 0.9rem;
	}

	.plans {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
		inline-size: 100%;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.plan {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-sm);
		min-width: 0;
		padding: var(--spacing-lg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-background);
	}

	.plan--highlight {
		border: 2px solid var(--color-primary);
		box-shadow: var(--shadow-lg);
	}

	.plan__head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-sm);
	}

	.plan__name {
		margin: 0;
		font-size: 1.25rem;
	}

	.plan__desc,
	.plan__billed {
		margin: 0;
		color: var(--color-text-secondary);
		font-size: 0.9rem;
	}

	.plan__price {
		margin: 0;
	}

	.plan__amount {
		font-size: 2.25rem;
		font-weight: 800;
	}

	.plan__per {
		color: var(--color-text-secondary);
	}

	.plan__badge {
		margin-inline-start: var(--spacing-xs);
		color: var(--color-success);
	}

	.plan__features {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		flex: 1;
		gap: var(--spacing-sm);
		margin: var(--spacing-sm) 0;
		padding: 0;
		list-style: none;
	}

	.plan__features li {
		display: flex;
		gap: var(--spacing-sm);
	}

	.plan__feature--off {
		color: var(--color-text-secondary);
	}

	.plan__mark {
		flex: none;
		inline-size: 1.25rem;
		text-align: center;
		font-weight: 700;
	}

	@media (min-width: 48rem) {
		.plans {
			grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
		}
	}
</style>
