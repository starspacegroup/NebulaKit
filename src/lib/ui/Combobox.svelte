<!--
	Combobox — a text field that filters a list of options as you type (the
	ARIA combobox pattern with a listbox popup). Focus stays in the field:
	ArrowDown and ArrowUp move the highlighted option (aria-activedescendant),
	Enter picks it, Escape closes the list and, when it is already closed,
	clears the field. With `creatable`, Enter on text that matches nothing
	offers it as a new value and reports it with `on:create`. Bind `value`.
-->
<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import Field from './Field.svelte';
	import { canCreate, filterOptions, type ComboOption } from './form-logic';
	import { nextIndex, uid } from './logic';

	export let label: string;
	export let options: ComboOption[] = [];
	export let value = '';
	export let placeholder = '';
	export let hint = '';
	export let error = '';
	export let required = false;
	export let disabled = false;
	export let hideLabel = false;
	/** Let Enter keep text that matches no option, as a new value. */
	export let creatable = false;
	export let emptyText = 'No results';
	export let id: string | undefined = undefined;

	const dispatch = createEventDispatcher<{
		change: { value: string };
		create: { value: string };
	}>();
	const listId = uid('combobox-list');
	let root: HTMLDivElement;
	let input: HTMLInputElement;
	let open = false;
	let active = -1;
	let query = labelFor(value);

	// Opened without typing (the button, ArrowDown), the list shows every option.
	let showAll = false;
	$: filtered = showAll ? options : filterOptions(options, query);
	$: offerCreate = creatable && canCreate(options, query);
	$: count = filtered.length + (offerCreate ? 1 : 0);
	$: disabledIndexes = filtered.flatMap((option, i) => (option.disabled ? [i] : []));
	$: activeId = open && active >= 0 && active < count ? `${listId}-${active}` : undefined;
	$: status = open ? (count === 0 ? emptyText : `${count} result${count === 1 ? '' : 's'}`) : '';

	function labelFor(v: string): string {
		return options.find((option) => option.value === v)?.label ?? v;
	}

	function show(all = true) {
		if (disabled) return;
		if (!open) showAll = all;
		open = true;
	}

	function hide() {
		open = false;
		active = -1;
	}

	function pick(option: ComboOption) {
		if (option.disabled) return;
		commit(option.value, option.label);
	}

	function create() {
		const text = query.trim();
		dispatch('create', { value: text });
		commit(text, text);
	}

	function commit(next: string, text: string) {
		query = text;
		hide();
		if (next !== value) {
			value = next;
			dispatch('change', { value });
		}
	}

	async function move(key: 'ArrowDown' | 'ArrowUp') {
		if (count === 0) return;
		// From nothing highlighted, Down starts at the top and Up at the bottom.
		const step = active < 0 ? (key === 'ArrowDown' ? 'Home' : 'End') : key;
		active = nextIndex(active, count, step, 'vertical', disabledIndexes) ?? active;
		await tick();
		document.getElementById(`${listId}-${active}`)?.scrollIntoView?.({ block: 'nearest' });
	}

	// Pointer picks, delegated from the list. Mousedown is cancelled so focus
	// stays in the field; keyboard users never reach the options themselves.
	function pointerPick(node: HTMLElement) {
		const onDown = (event: MouseEvent) => event.preventDefault();
		const onClick = (event: MouseEvent) => {
			const target = (event.target as Element).closest('[data-index]');
			if (!target) return;
			const i = Number(target.getAttribute('data-index'));
			if (i < filtered.length) pick(filtered[i]);
			else create();
		};
		node.addEventListener('mousedown', onDown);
		node.addEventListener('click', onClick);
		return {
			destroy() {
				node.removeEventListener('mousedown', onDown);
				node.removeEventListener('click', onClick);
			}
		};
	}

	function onInput() {
		query = input.value;
		active = -1;
		showAll = false;
		show(false);
	}

	function onKeydown(event: KeyboardEvent) {
		switch (event.key) {
			case 'ArrowDown':
			case 'ArrowUp':
				event.preventDefault();
				if (!open) {
					show();
					if (event.altKey) return;
				}
				move(event.key);
				return;
			case 'Enter':
				if (!open) return;
				event.preventDefault();
				if (active >= 0 && active < filtered.length) pick(filtered[active]);
				else if (offerCreate && (active === filtered.length || filtered.length === 0)) create();
				else if (filtered.length === 1) pick(filtered[0]);
				return;
			case 'Escape':
				event.preventDefault();
				if (open) {
					hide();
					query = labelFor(value);
				} else {
					query = '';
					commit('', '');
				}
				return;
			case 'Tab':
				hide();
		}
	}

	function onBlur(event: FocusEvent) {
		const next = event.relatedTarget as Node | null;
		if (next && root.contains(next)) return;
		hide();
		query = labelFor(value);
	}

	// When the value or options change from outside, show the matching label.
	$: syncQuery(value, options);

	function syncQuery(v: string, _options: ComboOption[]) {
		if (!open && (typeof document === 'undefined' || input !== document.activeElement)) {
			query = labelFor(v);
		}
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
	<div class="combobox" bind:this={root}>
		<input
			bind:this={input}
			id={fieldId}
			type="text"
			role="combobox"
			class="combobox__input"
			autocomplete="off"
			aria-autocomplete="list"
			aria-expanded={open}
			aria-controls={listId}
			aria-activedescendant={activeId}
			aria-describedby={describedBy}
			aria-invalid={invalid || undefined}
			value={query}
			{placeholder}
			{required}
			{disabled}
			on:input={onInput}
			on:keydown={onKeydown}
			on:click={() => show()}
			on:blur={onBlur}
		/>
		<button
			type="button"
			class="combobox__toggle"
			tabindex="-1"
			aria-label="Show options"
			aria-controls={listId}
			aria-expanded={open}
			{disabled}
			on:mousedown|preventDefault
			on:click={() => {
				if (open) hide();
				else show();
				input.focus();
			}}
		>
			<span aria-hidden="true">▾</span>
		</button>
		<div class="combobox__popup" hidden={!open}>
			<ul use:pointerPick id={listId} role="listbox" aria-label={label} class="combobox__list">
				{#each filtered as option, i (option.value)}
					<li
						id="{listId}-{i}"
						role="option"
						class="combobox__option"
						class:combobox__option--active={i === active}
						aria-selected={option.value === value}
						aria-disabled={option.disabled || undefined}
						data-index={i}
					>
						<span class="combobox__check" aria-hidden="true"
							>{option.value === value ? '✓' : ''}</span
						>
						{option.label}
					</li>
				{/each}
				{#if offerCreate}
					<li
						id="{listId}-{filtered.length}"
						role="option"
						class="combobox__option combobox__option--create"
						class:combobox__option--active={active === filtered.length}
						aria-selected="false"
						data-index={filtered.length}
					>
						<span class="combobox__check" aria-hidden="true">+</span>
						Create “{query.trim()}”
					</li>
				{/if}
			</ul>
			{#if count === 0}<p class="combobox__empty">{emptyText}</p>{/if}
		</div>
		<span class="sr-only" role="status">{status}</span>
	</div>
</Field>

<style>
	.combobox {
		position: relative;
	}

	.combobox__input {
		width: 100%;
		box-sizing: border-box;
		padding-right: 2.5rem;
	}

	.combobox__toggle {
		position: absolute;
		top: 0;
		right: 0;
		bottom: 0;
		width: 2.5rem;
		border: 0;
		background: transparent;
		color: var(--color-text-secondary);
		cursor: pointer;
	}

	.combobox__toggle:disabled {
		cursor: not-allowed;
		opacity: 0.55;
	}

	.combobox__popup {
		position: absolute;
		top: calc(100% + 4px);
		right: 0;
		left: 0;
		z-index: 60;
		padding: var(--spacing-xs);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-background);
		box-shadow: var(--shadow-lg);
	}

	.combobox__popup[hidden] {
		display: none;
	}

	.combobox__list {
		max-height: 15rem;
		margin: 0;
		padding: 0;
		overflow-y: auto;
		list-style: none;
	}

	.combobox__option {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		padding: var(--spacing-sm) var(--spacing-md) var(--spacing-sm) var(--spacing-sm);
		border-radius: var(--radius-sm);
		color: var(--color-text);
		cursor: pointer;
	}

	.combobox__option:hover,
	.combobox__option--active {
		background: var(--color-surface-hover);
	}

	.combobox__option--active {
		outline: 2px solid var(--color-primary);
		outline-offset: -2px;
	}

	.combobox__option[aria-disabled='true'] {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.combobox__option--create {
		color: var(--color-primary);
		font-weight: 600;
	}

	.combobox__check {
		width: 1rem;
		flex-shrink: 0;
		text-align: center;
		color: var(--color-primary);
	}

	.combobox__empty {
		margin: 0;
		padding: var(--spacing-sm) var(--spacing-md);
		color: var(--color-text-secondary);
	}
</style>
