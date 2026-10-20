<!--
	DatePicker — a labelled date field with a button that opens a Calendar in
	a panel anchored below it (the APG date picker dialog). Type a date as
	yyyy-mm-dd, or open the calendar: focus moves to the chosen day, picking
	closes it, and Escape or a click outside closes it and returns focus to
	the button. Bind `value` as a yyyy-mm-dd string.
-->
<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import Calendar from './Calendar.svelte';
	import Field from './Field.svelte';
	import {
		formatISODate,
		fullDateLabel,
		isDateDisabled,
		parseISODate,
		type Weekday,
		type YMD
	} from './form-logic';
	import { uid } from './logic';

	export let label: string;
	export let value = '';
	export let min = '';
	export let max = '';
	export let isDisabled: ((iso: string, date: YMD) => boolean) | null = null;
	export let weekStartsOn: Weekday = 0;
	export let locale = 'en-US';
	export let placeholder = 'yyyy-mm-dd';
	export let hint = '';
	export let error = '';
	export let required = false;
	export let disabled = false;
	export let hideLabel = false;
	export let id: string | undefined = undefined;
	/** The message shown for typed text that is not an allowed date. */
	export let invalidText = 'Enter a date as yyyy-mm-dd.';
	export let today: string | undefined = undefined;

	const dispatch = createEventDispatcher<{ change: { value: string } }>();
	const panelId = uid('datepicker');
	let root: HTMLDivElement;
	let button: HTMLButtonElement;
	let calendar: Calendar;
	let open = false;
	let text = value;
	let typedError = '';

	$: if (!typedError) text = value;
	$: selected = parseISODate(value);
	$: buttonLabel = selected ? `Change date, ${fullDateLabel(selected, locale)}` : 'Choose date';

	function setValue(next: string) {
		typedError = '';
		text = next;
		if (next === value) return;
		value = next;
		dispatch('change', { value });
	}

	function onTextChange() {
		const trimmed = text.trim();
		if (trimmed === '') return setValue('');
		const date = parseISODate(trimmed);
		const check = isDisabled ? (d: YMD) => isDisabled!(formatISODate(d), d) : null;
		if (!date || isDateDisabled(date, parseISODate(min), parseISODate(max), check)) {
			typedError = invalidText;
			return;
		}
		setValue(formatISODate(date));
	}

	async function show() {
		open = true;
		await tick();
		calendar?.focus();
	}

	function hide(returnFocus = true) {
		open = false;
		if (returnFocus) button?.focus();
	}

	function onPick(event: CustomEvent<{ value: string }>) {
		setValue(event.detail.value);
		hide();
	}

	// Escape anywhere in the panel closes it. An action, since the dialog
	// itself is not a control a key handler belongs on.
	function escapeCloses(node: HTMLElement) {
		const onKeydown = (event: KeyboardEvent) => {
			if (event.key !== 'Escape') return;
			event.preventDefault();
			event.stopPropagation();
			hide();
		};
		node.addEventListener('keydown', onKeydown);
		return { destroy: () => node.removeEventListener('keydown', onKeydown) };
	}

	function onWindowPointer(event: PointerEvent) {
		if (open && !root.contains(event.target as Node)) hide(false);
	}

	function onFocusOut(event: FocusEvent) {
		// Tabbing out of the picker closes it; focus going nowhere (a click on
		// blank page) is left to the pointer handler.
		const next = event.relatedTarget as Node | null;
		if (open && next && !root.contains(next)) hide(false);
	}
</script>

<svelte:window on:pointerdown={onWindowPointer} />

<Field
	{label}
	{hint}
	error={typedError || error}
	{required}
	{hideLabel}
	{...id ? { id } : {}}
	let:id={fieldId}
	let:describedBy
	let:invalid
>
	<div class="datepicker" bind:this={root} on:focusout={onFocusOut}>
		<div class="datepicker__control">
			<input
				id={fieldId}
				type="text"
				class="datepicker__input"
				inputmode="numeric"
				autocomplete="off"
				bind:value={text}
				{placeholder}
				{required}
				{disabled}
				aria-describedby={describedBy}
				aria-invalid={invalid || undefined}
				on:change={onTextChange}
			/>
			<button
				bind:this={button}
				type="button"
				class="datepicker__button"
				aria-label={buttonLabel}
				aria-haspopup="dialog"
				aria-expanded={open}
				aria-controls={panelId}
				{disabled}
				on:click={() => (open ? hide() : show())}
			>
				<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
					<rect
						x="3"
						y="5"
						width="18"
						height="16"
						rx="2"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					/>
					<path d="M3 10h18M8 3v4M16 3v4" fill="none" stroke="currentColor" stroke-width="2" />
				</svg>
			</button>
		</div>
		{#if open}
			<div
				id={panelId}
				class="datepicker__panel"
				role="dialog"
				aria-modal="false"
				aria-label={label}
				tabindex="-1"
				use:escapeCloses
			>
				<Calendar
					bind:this={calendar}
					{value}
					{min}
					{max}
					{isDisabled}
					{weekStartsOn}
					{locale}
					{...today ? { today } : {}}
					{label}
					on:change={onPick}
				/>
			</div>
		{/if}
	</div>
</Field>

<style>
	.datepicker {
		position: relative;
	}

	.datepicker__control {
		display: flex;
	}

	.datepicker__input {
		flex: 1;
		/* A percentage width lets the field shrink below the input's default 20ch. */
		width: 100%;
		min-width: 0;
		border-top-right-radius: 0;
		border-bottom-right-radius: 0;
		font-variant-numeric: tabular-nums;
	}

	.datepicker__button {
		display: grid;
		place-items: center;
		width: 2.75rem;
		border: 1px solid var(--color-border);
		border-left: 0;
		border-radius: 0 var(--radius-md) var(--radius-md) 0;
		background: var(--color-surface);
		color: var(--color-text);
		cursor: pointer;
	}

	.datepicker__button:hover {
		background: var(--color-surface-hover);
	}

	.datepicker__button:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.datepicker__button:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.datepicker__panel {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		z-index: 60;
		max-width: calc(100vw - 2rem);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-background);
		box-shadow: var(--shadow-lg);
	}

	.datepicker__panel:focus {
		outline: none;
	}
</style>
