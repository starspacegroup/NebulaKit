<!--
	Stepper — where someone is in a multi-step flow. Steps before `current`
	are complete, the current one carries aria-current="step", and a step
	with `error` says so in words as well as colour. With `clickable`,
	completed steps are buttons that report `on:select` to go back to them.
-->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { stepSelectable, stepStates } from './layout-logic';
	import type { StepStatus } from './layout-logic';

	export let steps: { id?: string; label: string; description?: string; error?: boolean }[] = [];
	export let current = 0;
	export let orientation: 'horizontal' | 'vertical' = 'horizontal';
	export let clickable = false;
	export let label = 'Progress';

	const dispatch = createEventDispatcher<{ select: { index: number; id: string | undefined } }>();
	const spoken: Record<StepStatus, string> = {
		complete: 'Completed',
		current: 'Current step',
		upcoming: 'Not started',
		error: 'Has an error'
	};

	$: states = stepStates(steps, current);
</script>

<ol class="stepper stepper--{orientation}" aria-label={label}>
	{#each steps as step, i (step.id ?? i)}
		{@const status = states[i]}
		<li
			class="stepper__step stepper__step--{status}"
			aria-current={i === current ? 'step' : undefined}
		>
			{#if stepSelectable(status, clickable)}
				<button
					type="button"
					class="stepper__body stepper__body--button"
					on:click={() => dispatch('select', { index: i, id: step.id })}
				>
					<span class="stepper__marker" aria-hidden="true">✓</span>
					<span class="stepper__text">
						<span class="stepper__label">{step.label}</span>
						<span class="visually-hidden">({spoken[status]})</span>
						{#if step.description}<span class="stepper__description">{step.description}</span>{/if}
					</span>
				</button>
			{:else}
				<div class="stepper__body">
					<span class="stepper__marker" aria-hidden="true"
						>{status === 'complete' ? '✓' : status === 'error' ? '!' : i + 1}</span
					>
					<span class="stepper__text">
						<span class="stepper__label">{step.label}</span>
						<span class="visually-hidden">({spoken[status]})</span>
						{#if step.description}<span class="stepper__description">{step.description}</span>{/if}
					</span>
				</div>
			{/if}
		</li>
	{/each}
</ol>

<style>
	.stepper {
		display: flex;
		gap: var(--spacing-sm);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.stepper--vertical {
		flex-direction: column;
		gap: 0;
	}

	.stepper__step {
		position: relative;
		flex: 1 1 0;
		min-width: 0;
	}

	/* The connecting line runs from each marker to the next. */
	.stepper--horizontal .stepper__step:not(:last-child)::after {
		content: '';
		position: absolute;
		top: 1rem;
		left: calc(2rem + var(--spacing-sm));
		right: 0;
		height: 2px;
		background: var(--color-border);
	}

	.stepper--vertical .stepper__step:not(:last-child)::after {
		content: '';
		position: absolute;
		top: calc(2rem + var(--spacing-xs));
		bottom: var(--spacing-xs);
		left: calc(1rem - 1px);
		width: 2px;
		background: var(--color-border);
	}

	.stepper__step--complete:not(:last-child)::after {
		background: var(--color-primary-solid);
	}

	.stepper__body {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--spacing-xs);
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--color-text);
		font: inherit;
		text-align: left;
	}

	.stepper--vertical .stepper__body {
		flex-direction: row;
		gap: var(--spacing-md);
		padding-bottom: var(--spacing-lg);
	}

	.stepper__body--button {
		border-radius: var(--radius-md);
		cursor: pointer;
	}

	.stepper__body--button:hover .stepper__label {
		text-decoration: underline;
	}

	.stepper__body--button:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 4px;
	}

	.stepper__marker {
		position: relative;
		z-index: 1;
		display: inline-grid;
		flex: 0 0 auto;
		place-items: center;
		width: 2rem;
		height: 2rem;
		border: 2px solid var(--color-border);
		border-radius: 50%;
		background: var(--color-background);
		color: var(--color-text-secondary);
		font-size: 0.875rem;
		font-weight: 700;
	}

	.stepper__step--complete .stepper__marker {
		border-color: var(--color-primary-solid);
		background: var(--color-primary-solid);
		color: var(--color-on-solid);
	}

	.stepper__step--current .stepper__marker {
		border-color: var(--color-primary);
		color: var(--color-primary);
	}

	.stepper__step--error .stepper__marker {
		border-color: var(--color-danger-solid);
		background: var(--color-danger-solid);
		color: var(--color-on-solid);
	}

	.stepper__text {
		display: grid;
		gap: 2px;
		min-width: 0;
	}

	.stepper__label {
		font-weight: 600;
		overflow-wrap: anywhere;
	}

	.stepper__step--upcoming .stepper__label {
		color: var(--color-text-secondary);
	}

	.stepper__step--error .stepper__label {
		color: var(--color-danger);
	}

	.stepper__description {
		color: var(--color-text-secondary);
		font-size: 0.8125rem;
	}

	/* On a phone a horizontal stepper keeps its markers and drops the words of
	   all but the current step, which a screen reader still hears. */
	@media (max-width: 480px) {
		.stepper--horizontal .stepper__step:not(.stepper__step--current) .stepper__text {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip: rect(0 0 0 0);
			white-space: nowrap;
		}
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
</style>
