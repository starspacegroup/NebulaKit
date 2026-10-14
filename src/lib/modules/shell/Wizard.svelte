<!--
	Wizard — a multi-step form shell: a Stepper, the current step's fields (the
	default slot), Back / Next / Finish, and a summary of the answers on the
	last step. Moving on is gated: Next on an invalid step stays put, shows an
	error summary (role="alert", each entry links to its field) and marks the
	step in the Stepper. Validation is yours: pass `validate(stepId, values)`
	returning `{ field: message }` (see `runWizardRules` and `wizardRequiredRule`). Focus
	moves to the new step's heading on every change, and a polite live region
	announces "Step 2 of 4: Account". Completed steps can be revisited from the
	Stepper. The slot gets `step`, `index`, `values`, `errors` (shown only
	after a refused attempt) and `fieldId(name)` — give the field that id and
	`aria-invalid` / `aria-describedby` from `errors`. Bind `values` and read
	`on:finish` (`{ values }`); `on:step` reports each change.
-->
<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import { Button, Stepper, uid } from '$lib/ui';
	import {
		gateStep,
		visibleStepErrors,
		wizardProgressText,
		wizardReduce,
		wizardStart,
		wizardStepperSteps,
		type StepErrors,
		type WizardState
	} from './logic';

	export let steps: { id: string; label: string; description?: string }[] = [];
	export let values: Record<string, unknown> = {};
	export let validate: (stepId: string, values: Record<string, unknown>) => StepErrors = () => ({});
	/** Answers shown as a list on the last step, before Finish. */
	export let summary: { label: string; value: string }[] = [];
	export let summaryTitle = 'Review your answers';
	/** 1 to 6: the heading level of each step's heading. */
	export let level: 2 | 3 | 4 | 5 | 6 = 2;
	/** Finish is working (an async save): the button shows a spinner and ignores clicks. */
	export let busy = false;
	export let label = 'Setup steps';
	export let backLabel = 'Back';
	export let nextLabel = 'Next';
	export let finishLabel = 'Finish';
	export let errorsTitle = 'Please fix the following before continuing:';
	export let progressTemplate = 'Step {n} of {total}';
	export let finishedTitle = 'All done';
	export let finishedText = 'Your answers were submitted.';

	const dispatch = createEventDispatcher<{
		step: { index: number; id: string };
		finish: { values: Record<string, unknown> };
	}>();
	const id = uid('wizard');
	let state: WizardState = wizardStart(steps.length);
	let heading: HTMLElement | undefined;
	let started = false;

	$: if (state.count !== steps.length) state = wizardStart(steps.length, state.index);
	$: current = steps[state.index];
	$: errors = current ? validate(current.id, values) : {};
	$: gate = gateStep(errors);
	$: shown = visibleStepErrors(errors, state.attempted);
	$: shownList = gateStep(shown).list;
	$: stepperSteps = wizardStepperSteps(steps, state, !gate.valid);
	$: progress = current ? wizardProgressText(state, current.label, progressTemplate) : '';
	$: last = state.index >= state.count - 1;

	function fieldId(name: string): string {
		return `${id}-${name}`;
	}

	async function act(action: Parameters<typeof wizardReduce>[1]) {
		const before = state.index;
		state = wizardReduce(state, action);
		if (state.finished) {
			dispatch('finish', { values });
			await tick();
			heading?.focus();
			return;
		}
		if (state.index !== before) {
			started = true;
			dispatch('step', { index: state.index, id: steps[state.index].id });
		}
		await tick();
		if (state.index !== before) heading?.focus();
		else if (state.attempted) document.getElementById(`${id}-errors`)?.focus();
	}

	function focusField(event: MouseEvent, name: string) {
		const el = document.getElementById(fieldId(name));
		if (el) {
			event.preventDefault();
			el.focus();
		}
	}

	function onSelect(event: CustomEvent<{ index: number }>) {
		act({ type: 'goto', index: event.detail.index, valid: gate.valid });
	}

	/** Start over from the first step. */
	export function reset() {
		state = wizardStart(steps.length);
	}
</script>

<section class="wizard" aria-label={label}>
	<Stepper steps={stepperSteps} current={state.index} clickable {label} on:select={onSelect} />

	<p class="wizard__progress" role="status" aria-live="polite">
		{started || state.finished ? progress : ''}
	</p>

	{#if state.finished}
		<div class="wizard__done" role="status">
			<svelte:element this={`h${level}`} class="wizard__heading" tabindex="-1" bind:this={heading}
				>{finishedTitle}</svelte:element
			>
			<p>{finishedText}</p>
		</div>
	{:else if current}
		<form
			class="wizard__form"
			novalidate
			on:submit|preventDefault={() =>
				act(last ? { type: 'finish', valid: gate.valid } : { type: 'next', valid: gate.valid })}
		>
			<svelte:element
				this={`h${level}`}
				class="wizard__heading"
				id="{id}-heading"
				tabindex="-1"
				bind:this={heading}>{current.label}</svelte:element
			>
			{#if current.description}<p class="wizard__description">{current.description}</p>{/if}

			{#if shownList.length}
				<div class="wizard__errors" id="{id}-errors" role="alert" tabindex="-1">
					<p class="wizard__errors-title">{errorsTitle}</p>
					<ul>
						{#each shownList as item (item.field)}
							<li>
								<a href="#{fieldId(item.field)}" on:click={(e) => focusField(e, item.field)}
									>{item.message}</a
								>
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			<div class="wizard__fields">
				<slot step={current} index={state.index} {values} errors={shown} {fieldId} />
			</div>

			{#if last && summary.length}
				<div class="wizard__summary">
					<p class="wizard__summary-title">{summaryTitle}</p>
					<dl>
						{#each summary as row (row.label)}
							<div class="wizard__summary-row">
								<dt>{row.label}</dt>
								<dd>{row.value}</dd>
							</div>
						{/each}
					</dl>
				</div>
			{/if}

			<div class="wizard__actions">
				<Button
					variant="secondary"
					disabled={state.index === 0 || busy}
					on:click={() => act({ type: 'back' })}>{backLabel}</Button
				>
				{#if last}
					<Button type="submit" loading={busy}>{finishLabel}</Button>
				{:else}
					<Button type="submit">{nextLabel}</Button>
				{/if}
			</div>
		</form>
	{/if}
</section>

<style>
	.wizard {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
		min-width: 0;
	}

	.wizard__progress {
		margin: 0;
		color: var(--color-text-secondary);
		font-size: 0.875rem;
	}

	.wizard__form,
	.wizard__done {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
		min-width: 0;
		padding: var(--spacing-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-background);
	}

	.wizard__heading {
		margin: 0;
		font-size: 1.25rem;
	}

	.wizard__heading:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 4px;
		border-radius: var(--radius-sm);
	}

	.wizard__description {
		margin: 0;
		color: var(--color-text-secondary);
	}

	.wizard__fields {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
		min-width: 0;
	}

	.wizard__errors {
		padding: var(--spacing-md);
		border: 2px solid var(--color-danger);
		border-radius: var(--radius-md);
		color: var(--color-text);
	}

	.wizard__errors:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.wizard__errors-title {
		margin: 0 0 var(--spacing-xs);
		font-weight: 700;
	}

	.wizard__errors ul {
		margin: 0;
		padding-inline-start: 1.25rem;
	}

	.wizard__errors a {
		color: var(--color-danger);
		text-decoration: underline;
	}

	.wizard__summary {
		padding: var(--spacing-md);
		border: 1px dashed var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
	}

	.wizard__summary-title {
		margin: 0 0 var(--spacing-xs);
		font-weight: 700;
	}

	dl {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-xs);
		margin: 0;
	}

	.wizard__summary-row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-xs) var(--spacing-md);
	}

	dt {
		color: var(--color-text-secondary);
	}

	dd {
		margin: 0;
		font-weight: 600;
		overflow-wrap: anywhere;
	}

	.wizard__actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: var(--spacing-sm);
	}

	.wizard__actions :global(.btn) {
		min-height: 44px;
	}
</style>
