<!--
	NumberInput — a labelled number field with − and + buttons (the ARIA
	spinbutton pattern). ArrowUp/ArrowDown step, PageUp/PageDown take a big
	step, Home and End go to min and max. Typed values are snapped to the step
	and held to [min, max] when the field is left or Enter is pressed. Bind
	`value`; it is null while the field is empty.
-->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Field from './Field.svelte';
	import { parseNumber, snapToStep, stepNumber } from './form-logic';

	export let label: string;
	export let value: number | null = null;
	export let min = -Infinity;
	export let max = Infinity;
	export let step = 1;
	/** How far PageUp and PageDown move. Ten steps unless set. */
	export let bigStep: number | undefined = undefined;
	/** Shown after the number and read with it, e.g. "kg". */
	export let unit = '';
	export let placeholder = '';
	export let hint = '';
	export let error = '';
	export let required = false;
	export let disabled = false;
	export let hideLabel = false;
	export let id: string | undefined = undefined;

	const dispatch = createEventDispatcher<{ change: { value: number | null } }>();
	let text = value === null ? '' : String(value);
	let editing = false;

	$: if (!editing) text = value === null ? '' : String(value);
	$: big = bigStep ?? step * 10;
	$: atMin = value !== null && value <= min;
	$: atMax = value !== null && value >= max;

	function set(next: number | null) {
		editing = false;
		text = next === null ? '' : String(next);
		if (next === value) return;
		value = next;
		dispatch('change', { value });
	}

	function nudge(steps: number, size = step) {
		if (disabled) return;
		// Step from what is typed, if anything is, rather than the last committed value.
		const from = editing ? (parseNumber(text) ?? value) : value;
		set(stepNumber(from, (steps * size) / step, step, min, max));
	}

	function commit() {
		const parsed = parseNumber(text);
		set(parsed === null ? null : snapToStep(parsed, step, min, max));
	}

	function onKeydown(event: KeyboardEvent) {
		const keys: Record<string, () => void> = {
			ArrowUp: () => nudge(1),
			ArrowDown: () => nudge(-1),
			PageUp: () => nudge(1, big),
			PageDown: () => nudge(-1, big),
			Home: () => Number.isFinite(min) && set(min),
			End: () => Number.isFinite(max) && set(max),
			Enter: commit
		};
		const action = keys[event.key];
		if (!action) return;
		event.preventDefault();
		action();
	}
</script>

<Field
	{label}
	{hint}
	{error}
	{required}
	{hideLabel}
	{...id ? { id } : {}}
	let:id={fieldId}
	let:describedBy
	let:invalid
>
	<div class="number" class:number--disabled={disabled}>
		<button
			type="button"
			class="number__step"
			tabindex="-1"
			aria-label="Decrease {label}"
			disabled={disabled || atMin}
			on:click={() => nudge(-1)}
		>
			<span aria-hidden="true">−</span>
		</button>
		<input
			id={fieldId}
			class="number__input"
			type="text"
			inputmode="decimal"
			role="spinbutton"
			autocomplete="off"
			aria-valuenow={value ?? undefined}
			aria-valuemin={Number.isFinite(min) ? min : undefined}
			aria-valuemax={Number.isFinite(max) ? max : undefined}
			aria-valuetext={value === null ? undefined : `${value}${unit ? ` ${unit}` : ''}`}
			aria-describedby={describedBy}
			aria-invalid={invalid || undefined}
			bind:value={text}
			{placeholder}
			{required}
			{disabled}
			on:input={() => (editing = true)}
			on:keydown={onKeydown}
			on:blur={commit}
		/>
		{#if unit}<span class="number__unit" aria-hidden="true">{unit}</span>{/if}
		<button
			type="button"
			class="number__step"
			tabindex="-1"
			aria-label="Increase {label}"
			disabled={disabled || atMax}
			on:click={() => nudge(1)}
		>
			<span aria-hidden="true">+</span>
		</button>
	</div>
</Field>

<style>
	.number {
		display: flex;
		align-items: stretch;
		max-width: 14rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		overflow: hidden;
	}

	.number:focus-within {
		border-color: var(--color-primary);
		outline: 2px solid var(--color-primary);
		outline-offset: 1px;
	}

	:global(.field--invalid) .number {
		border-color: var(--color-error);
	}

	.number__input {
		flex: 1;
		min-width: 0;
		border: 0;
		border-radius: 0;
		background: transparent;
		font-variant-numeric: tabular-nums;
		text-align: center;
	}

	.number__input:focus {
		box-shadow: none;
	}

	.number__unit {
		display: flex;
		align-items: center;
		padding-right: var(--spacing-sm);
		color: var(--color-text-secondary);
	}

	.number__step {
		width: 2.5rem;
		flex-shrink: 0;
		border: 0;
		background: transparent;
		color: var(--color-text);
		font-size: 1.125rem;
		cursor: pointer;
	}

	.number__step:hover:not(:disabled) {
		background: var(--color-surface-hover);
	}

	.number__step:disabled {
		color: var(--color-text-secondary);
		opacity: 0.5;
		cursor: not-allowed;
	}

	.number--disabled {
		opacity: 0.55;
	}
</style>
