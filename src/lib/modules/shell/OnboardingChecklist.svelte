<!--
	OnboardingChecklist — "get set up" steps with a progress bar. Each step is
	a disclosure button (aria-expanded) that opens its description and
	action; a step marked done says "Done" in words, not just a tick. Bind
	`steps`: "Mark as done" in a step's panel sets it and reports
	`on:step` (`{ id, done }`). When the last step is done a celebration
	message is announced politely (its animation is skipped under
	prefers-reduced-motion) and `on:complete` fires once. "Dismiss" hides the
	checklist (bind `dismissed`) and fires `on:dismiss`.
-->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { Button, Progress, uid } from '$lib/ui';
	import { checklistProgress, checklistSummary, setStepDone, toggleOpenStep } from './logic';

	export let steps: {
		id: string;
		title: string;
		description?: string;
		done: boolean;
		actionLabel?: string;
		href?: string;
	}[] = [];
	export let title = 'Get started';
	/** 1 to 6: the heading level of the title. */
	export let level: 2 | 3 | 4 | 5 | 6 = 2;
	export let dismissed = false;
	/** The step whose panel is open. */
	export let expanded: string | null = null;
	export let dismissLabel = 'Dismiss';
	export let markDoneLabel = 'Mark as done';
	export let markUndoneLabel = 'Mark as not done';
	export let doneLabel = 'Done';
	export let todoLabel = 'To do';
	export let progressLabel = 'Setup progress';
	export let celebrationTitle = 'You’re all set!';
	export let celebrationText = 'Every step is done. Nice work.';
	export let summaryTemplate = '{done} of {total} done';

	const dispatch = createEventDispatcher<{
		step: { id: string; done: boolean };
		complete: void;
		dismiss: void;
	}>();
	const id = uid('checklist');
	let announced = false;

	$: progress = checklistProgress(steps);
	$: if (progress.complete && !announced) {
		announced = true;
		dispatch('complete');
	} else if (!progress.complete) {
		announced = false;
	}

	function setDone(stepId: string, done: boolean) {
		steps = setStepDone(steps, stepId, done);
		dispatch('step', { id: stepId, done });
	}

	function dismiss() {
		dismissed = true;
		dispatch('dismiss');
	}
</script>

{#if !dismissed}
	<section class="checklist" aria-labelledby="{id}-title">
		<header class="checklist__header">
			<svelte:element this={`h${level}`} class="checklist__title" id="{id}-title"
				>{title}</svelte:element
			>
			<Button variant="ghost" size="sm" on:click={dismiss}>{dismissLabel}</Button>
		</header>

		<Progress
			value={progress.done}
			max={Math.max(1, progress.total)}
			label={progressLabel}
			showValue={false}
			tone={progress.complete ? 'success' : 'primary'}
		/>
		<p class="checklist__summary">{checklistSummary(progress, summaryTemplate)}</p>

		<div class="checklist__celebration-slot" role="status" aria-live="polite">
			{#if progress.complete}
				<div class="checklist__celebration">
					<span class="checklist__burst" aria-hidden="true">🎉</span>
					<div>
						<p class="checklist__celebration-title">{celebrationTitle}</p>
						<p class="checklist__celebration-text">{celebrationText}</p>
					</div>
				</div>
			{/if}
		</div>

		<ol class="checklist__steps">
			{#each steps as step (step.id)}
				{@const open = expanded === step.id}
				<li class="step" class:step--done={step.done}>
					<button
						type="button"
						class="step__toggle"
						aria-expanded={open}
						aria-controls="{id}-panel-{step.id}"
						on:click={() => (expanded = toggleOpenStep(expanded, step.id))}
					>
						<span class="step__marker" aria-hidden="true">{step.done ? '✓' : '○'}</span>
						<span class="step__title">{step.title}</span>
						<span class="step__state">{step.done ? doneLabel : todoLabel}</span>
					</button>
					{#if open}
						<div class="step__panel" id="{id}-panel-{step.id}">
							{#if step.description}<p class="step__description">{step.description}</p>{/if}
							<div class="step__actions">
								{#if step.actionLabel && !step.done}
									<Button size="sm" href={step.href}>{step.actionLabel}</Button>
								{/if}
								<Button size="sm" variant="secondary" on:click={() => setDone(step.id, !step.done)}
									>{step.done ? markUndoneLabel : markDoneLabel}<span class="checklist__sr"
										>: {step.title}</span
									></Button
								>
							</div>
						</div>
					{/if}
				</li>
			{/each}
		</ol>
	</section>
{/if}

<style>
	.checklist {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-sm);
		min-width: 0;
		padding: var(--spacing-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-background);
	}

	.checklist__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-sm);
	}

	.checklist__title {
		margin: 0;
		font-size: 1.125rem;
	}

	.checklist__header :global(.btn) {
		min-height: 44px;
	}

	.checklist__summary {
		margin: 0;
		color: var(--color-text-secondary);
		font-size: 0.875rem;
	}

	.checklist__celebration {
		display: flex;
		align-items: center;
		gap: var(--spacing-md);
		padding: var(--spacing-md);
		border: 1px solid var(--color-success);
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--color-success) 12%, var(--color-background));
	}

	.checklist__burst {
		font-size: 2rem;
		line-height: 1;
	}

	@media (prefers-reduced-motion: no-preference) {
		.checklist__celebration {
			animation: checklist-pop 500ms ease-out;
		}

		.checklist__burst {
			display: inline-block;
			animation: checklist-bounce 900ms ease-out;
		}
	}

	@keyframes checklist-pop {
		from {
			opacity: 0;
			transform: scale(0.94);
		}
	}

	@keyframes checklist-bounce {
		0% {
			transform: scale(0.4) rotate(-20deg);
		}
		60% {
			transform: scale(1.3) rotate(10deg);
		}
	}

	.checklist__celebration-title {
		margin: 0;
		font-weight: 700;
	}

	.checklist__celebration-text {
		margin: 0;
		color: var(--color-text-secondary);
	}

	.checklist__steps {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-xs);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.step {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}

	.step__toggle {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		width: 100%;
		min-height: 44px;
		padding: var(--spacing-sm) var(--spacing-md);
		border: 0;
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--color-text);
		font: inherit;
		text-align: start;
		cursor: pointer;
	}

	.step__toggle:hover {
		background: var(--color-surface-hover);
	}

	.step__toggle:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: -2px;
	}

	.step__marker {
		flex: none;
		width: 1.25rem;
		color: var(--color-text-secondary);
		text-align: center;
	}

	.step--done .step__marker {
		color: var(--color-success);
		font-weight: 700;
	}

	.step__title {
		flex: 1;
		min-width: 0;
		font-weight: 600;
		overflow-wrap: anywhere;
	}

	.step--done .step__title {
		text-decoration: line-through;
		text-decoration-thickness: 1px;
	}

	.step__state {
		flex: none;
		color: var(--color-text-secondary);
		font-size: 0.8125rem;
	}

	.step__panel {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-sm);
		padding: 0 var(--spacing-md) var(--spacing-md);
	}

	.step__description {
		margin: 0;
		color: var(--color-text-secondary);
	}

	.step__actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-sm);
	}

	.step__actions :global(.btn) {
		min-height: 44px;
	}

	.checklist__sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
</style>
