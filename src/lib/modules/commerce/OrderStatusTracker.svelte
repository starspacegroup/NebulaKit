<!--
	OrderStatusTracker — the steps an order goes through, with where it is now.
	An ordered list; the current step has aria-current="step" and every step says
	"Completed", "Current step" or "Upcoming" in text, so state is never only a
	colour or an icon. Pass `current` as the index of the step in progress, or
	the step count when everything is done.
-->
<script lang="ts">
	import { uid } from '$lib/ui/logic';
	import { formatCommerceDate, stepState } from './logic';

	export let steps: { id: string; label: string; description?: string; at?: string }[] = [];
	export let current = 0;
	/** ISO date or date-time the order should arrive. */
	export let eta: string | undefined = undefined;
	export let orderNumber: string | undefined = undefined;
	export let locale = 'en-US';
	export let timeZone = 'UTC';
	export let heading = 'Order status';
	export let level: 2 | 3 | 4 = 3;
	export let labels: Partial<typeof defaults> = {};

	const defaults = {
		done: 'Completed',
		current: 'Current step',
		upcoming: 'Upcoming',
		eta: 'Estimated delivery',
		order: 'Order {number}',
		delivered: 'All steps complete'
	};

	const titleId = uid('tracker');

	$: t = { ...defaults, ...labels };
	$: finished = steps.length > 0 && current >= steps.length;
</script>

<section class="tracker" aria-labelledby={titleId}>
	<header class="tracker__head">
		<svelte:element this={`h${level}`} class="tracker__title" id={titleId}>{heading}</svelte:element
		>
		{#if orderNumber}<p class="tracker__order">{t.order.replace('{number}', orderNumber)}</p>{/if}
		{#if eta}
			<p class="tracker__eta">
				{t.eta}:
				<strong
					><time datetime={eta}>{formatCommerceDate(eta, locale, timeZone, 'long')}</time></strong
				>
			</p>
		{/if}
		{#if finished}<p class="tracker__eta">{t.delivered}</p>{/if}
	</header>
	<ol class="steps">
		{#each steps as step, i (step.id)}
			{@const state = stepState(i, current)}
			<li class="step step--{state}" aria-current={state === 'current' ? 'step' : undefined}>
				<span class="step__marker" aria-hidden="true"
					>{state === 'done' ? '✓' : state === 'current' ? '●' : ''}</span
				>
				<div class="step__body">
					<p class="step__label">
						{step.label}
						<span class="step__state">{t[state]}</span>
					</p>
					{#if step.description}<p class="step__desc">{step.description}</p>{/if}
					{#if step.at}<p class="step__desc">
							<time datetime={step.at}>{formatCommerceDate(step.at, locale, timeZone)}</time>
						</p>{/if}
				</div>
			</li>
		{/each}
	</ol>
</section>

<style>
	.tracker {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
		min-width: 0;
		color: var(--color-text);
	}

	.tracker__head {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-xs);
	}

	.tracker__title {
		margin: 0;
		font-size: 1.125rem;
	}

	.tracker__order,
	.tracker__eta {
		margin: 0;
		color: var(--color-text-secondary);
		font-size: 0.9375rem;
	}

	.tracker__eta strong {
		color: var(--color-text);
	}

	.steps {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.step {
		position: relative;
		display: grid;
		grid-template-columns: 2rem minmax(0, 1fr);
		gap: var(--spacing-md);
		padding-bottom: var(--spacing-lg);
	}

	/* The line down to the next step. */
	.step:not(:last-child)::before {
		content: '';
		position: absolute;
		inset-block: 2rem 0;
		inset-inline-start: calc(1rem - 1px);
		width: 2px;
		background: var(--color-border);
	}

	.step--done:not(:last-child)::before {
		background: var(--color-success);
	}

	.step__marker {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		place-items: center;
		width: 2rem;
		height: 2rem;
		border: 2px solid var(--color-border);
		border-radius: 50%;
		background: var(--color-background);
		font-size: 0.875rem;
		font-weight: 700;
	}

	.step--done .step__marker {
		border-color: var(--color-success);
		background: var(--color-success);
		color: var(--color-background);
	}

	.step--current .step__marker {
		border-color: var(--color-primary);
		color: var(--color-primary);
	}

	.step__label {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--spacing-xs) var(--spacing-sm);
		margin: 0;
		padding-top: 0.2rem;
		font-weight: 600;
	}

	.step--upcoming .step__label {
		color: var(--color-text-secondary);
		font-weight: 500;
	}

	.step__state {
		color: var(--color-text-secondary);
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.03em;
		text-transform: uppercase;
	}

	.step--current .step__state {
		color: var(--color-primary);
	}

	.step__desc {
		margin: 0;
		color: var(--color-text-secondary);
		font-size: 0.875rem;
	}

	@media (min-width: 48rem) {
		.steps {
			grid-auto-flow: column;
			grid-auto-columns: minmax(0, 1fr);
		}

		.step {
			grid-template-columns: minmax(0, 1fr);
			gap: var(--spacing-sm);
			padding-bottom: 0;
			padding-inline-end: var(--spacing-sm);
		}

		.step:not(:last-child)::before {
			inset-block: calc(1rem - 1px) auto;
			inset-inline: 2rem 0;
			width: auto;
			height: 2px;
		}
	}

	@media (forced-colors: active) {
		.step--done .step__marker {
			border-color: Highlight;
			background: Highlight;
			color: HighlightText;
		}
	}

	/* Digits that change keep their width, so a live count or time never nudges what is beside it. */
	time {
		font-variant-numeric: tabular-nums;
	}
</style>
