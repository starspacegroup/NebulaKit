<!--
	ToggleGroup — a row of toggles with one tab stop. type="single" is a radio
	group (one choice, arrow keys move and choose, the ARIA radio pattern);
	type="multiple" is a set of pressed buttons (arrow keys move, Space or
	Enter presses). Home and End jump to the ends. Bind `value`: a string for
	single, an array of strings for multiple.
-->
<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import { isToggled, toggleGroupValue } from './form-logic';
	import { nextIndex } from './logic';

	export let items: { value: string; label: string; disabled?: boolean; icon?: string }[] = [];
	export let type: 'single' | 'multiple' = 'single';
	export let value: string | string[] = type === 'multiple' ? [] : '';
	/** The group's accessible name. */
	export let label: string;
	export let size: 'sm' | 'md' = 'md';
	export let variant: 'default' | 'outline' = 'outline';
	/** Show icons only; the labels become the buttons' accessible names. */
	export let iconOnly = false;

	const dispatch = createEventDispatcher<{ change: { value: string | string[] } }>();
	let buttons: HTMLButtonElement[] = [];
	let focused = -1;

	$: disabled = items.flatMap((item, i) => (item.disabled ? [i] : []));
	$: order = items.map((item) => item.value);
	$: firstOn = items.findIndex((item, i) => isToggled(value, item.value) && !disabled.includes(i));
	$: firstUsable = items.findIndex((item) => !item.disabled);
	// The tab stop. A radio group's is its checked item; a set of toggles keeps
	// it where focus last was. Otherwise, the first usable item.
	$: preferred = type === 'single' ? [firstOn, focused] : [focused, firstOn];
	$: stop = preferred.find((i) => i >= 0) ?? firstUsable;

	function press(i: number) {
		const item = items[i];
		if (item.disabled) return;
		focused = i;
		const next = toggleGroupValue(type, value, item.value, order);
		if (type === 'single' && next === value) return;
		value = next;
		dispatch('change', { value });
	}

	async function onKeydown(event: KeyboardEvent) {
		// Both arrow axes move, as in the APG radio group.
		const vertical: Record<string, string> = { ArrowDown: 'ArrowRight', ArrowUp: 'ArrowLeft' };
		const key = vertical[event.key] ?? event.key;
		const next = nextIndex(stop, items.length, key, 'horizontal', disabled);
		if (next === null) return;
		event.preventDefault();
		focused = next;
		if (type === 'single') press(next);
		await tick();
		buttons[next]?.focus();
	}
</script>

<div
	class="toggle-group"
	role={type === 'single' ? 'radiogroup' : 'group'}
	aria-label={label}
	tabindex="-1"
	on:keydown={onKeydown}
>
	{#each items as item, i (item.value)}
		<button
			bind:this={buttons[i]}
			type="button"
			class="toggle-group__item toggle-group__item--{size} toggle-group__item--{variant}"
			role={type === 'single' ? 'radio' : undefined}
			aria-checked={type === 'single' ? isToggled(value, item.value) : undefined}
			aria-pressed={type === 'multiple' ? isToggled(value, item.value) : undefined}
			aria-label={iconOnly ? item.label : undefined}
			title={iconOnly ? item.label : undefined}
			tabindex={i === stop ? 0 : -1}
			disabled={item.disabled}
			on:click={() => press(i)}
			on:focus={() => (focused = i)}
		>
			{#if item.icon}<span class="toggle-group__icon" aria-hidden="true">{item.icon}</span>{/if}
			{#if !iconOnly}<span>{item.label}</span>{/if}
		</button>
	{/each}
</div>

<style>
	.toggle-group {
		display: inline-flex;
		flex-wrap: wrap;
		gap: 2px;
		max-width: 100%;
		padding: 2px;
		border-radius: var(--radius-md);
	}

	.toggle-group:focus {
		outline: none;
	}

	.toggle-group__item {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--spacing-xs);
		border: 1px solid transparent;
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--color-text-secondary);
		font: inherit;
		font-weight: 600;
		line-height: 1;
		cursor: pointer;
		transition:
			background-color var(--transition-fast),
			color var(--transition-fast);
	}

	.toggle-group__item--md {
		min-width: 2.5rem;
		height: 2.5rem;
		padding: 0 var(--spacing-md);
	}

	.toggle-group__item--sm {
		min-width: 2rem;
		height: 2rem;
		padding: 0 var(--spacing-sm);
		font-size: 0.875rem;
	}

	.toggle-group__item--outline {
		border-color: var(--color-border);
	}

	.toggle-group__item:hover:not(:disabled) {
		background: var(--color-surface-hover);
		color: var(--color-text);
	}

	/* Selection shows in the fill and the border; the label stays in the text colour,
	   because --color-primary on a tint misses 4.5:1 in the dark theme. */
	.toggle-group__item[aria-pressed='true'],
	.toggle-group__item[aria-checked='true'] {
		background: color-mix(in srgb, var(--color-primary) 18%, var(--color-surface));
		color: var(--color-text);
	}

	.toggle-group__item--outline[aria-pressed='true'],
	.toggle-group__item--outline[aria-checked='true'] {
		border-color: var(--color-primary);
	}

	.toggle-group__item:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.toggle-group__item:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	@media (prefers-reduced-motion: reduce) {
		.toggle-group__item {
			transition: none;
		}
	}
</style>
