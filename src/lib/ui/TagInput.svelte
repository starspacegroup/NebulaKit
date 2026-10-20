<!--
	TagInput — a labelled field that turns what you type into removable
	chips. Enter or a comma adds (a pasted "a, b, c" adds three); Backspace in
	the empty field removes the last chip; every chip has its own remove
	button. Duplicates, anything past `max` and anything `validate` refuses
	are turned away with a message. Additions and removals are announced.
	Bind `tags`.
-->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Field from './Field.svelte';
	import { addTags } from './form-logic';

	export let label: string;
	export let tags: string[] = [];
	export let max = Infinity;
	/** Return an error message to refuse a tag. */
	export let validate: ((tag: string) => string | void | null | undefined) | undefined = undefined;
	export let ignoreCase = true;
	export let placeholder = 'Add a tag';
	export let hint = '';
	export let error = '';
	export let required = false;
	export let disabled = false;
	export let hideLabel = false;
	export let id: string | undefined = undefined;

	const dispatch = createEventDispatcher<{ change: { tags: string[] } }>();
	let input: HTMLInputElement;
	let text = '';
	let refusal = '';
	let announcement = '';

	$: full = tags.length >= max;

	function add(raw: string) {
		const result = addTags(tags, raw, { max, validate, ignoreCase });
		refusal = result.error;
		const added = result.tags.slice(tags.length);
		if (added.length === 0) return;
		tags = result.tags;
		announcement = `Added ${added.join(', ')}.`;
		dispatch('change', { tags });
	}

	function remove(index: number, refocus = true) {
		const gone = tags[index];
		tags = tags.filter((_, i) => i !== index);
		refusal = '';
		announcement = `Removed ${gone}.`;
		dispatch('change', { tags });
		if (refocus) input?.focus();
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ',') {
			event.preventDefault();
			commit();
		} else if (event.key === 'Backspace' && text === '' && tags.length > 0) {
			event.preventDefault();
			remove(tags.length - 1, false);
		}
	}

	// Add what is typed. Also on leaving the field, so a typed tag is not lost.
	function commit() {
		if (!text.trim()) return;
		add(text);
		if (!refusal) text = '';
	}

	// A paste or an IME can bring commas in without a key press.
	function onInput() {
		refusal = '';
		if (!text.includes(',')) return;
		const parts = text.split(',');
		const rest = parts.pop() ?? '';
		add(parts.join(','));
		text = rest;
	}
</script>

<Field
	{label}
	{hint}
	error={refusal || error}
	{required}
	{hideLabel}
	{...id ? { id } : {}}
	let:id={fieldId}
	let:describedBy
	let:invalid
>
	<div class="tags" class:tags--disabled={disabled}>
		{#if tags.length > 0}
			<ul class="tags__list" aria-label="{label}, {tags.length} added">
				{#each tags as tag, i}
					<li class="tags__chip">
						<span class="tags__text">{tag}</span>
						<button
							type="button"
							class="tags__remove"
							aria-label="Remove {tag}"
							{disabled}
							on:click={() => remove(i)}
						>
							<span aria-hidden="true">×</span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
		<input
			bind:this={input}
			id={fieldId}
			class="tags__input"
			type="text"
			autocomplete="off"
			enterkeyhint="done"
			bind:value={text}
			placeholder={full ? '' : placeholder}
			required={required && tags.length === 0}
			{disabled}
			aria-describedby={describedBy}
			aria-invalid={invalid || undefined}
			on:keydown={onKeydown}
			on:input={onInput}
			on:blur={commit}
		/>
	</div>
	<span class="sr-only" role="status">{announcement}</span>
</Field>

<style>
	.tags {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--spacing-xs);
		min-height: 2.75rem;
		box-sizing: border-box;
		padding: var(--spacing-xs);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
	}

	.tags:focus-within {
		border-color: var(--color-primary);
		outline: 2px solid var(--color-primary);
		outline-offset: 1px;
	}

	:global(.field--invalid) .tags {
		border-color: var(--color-error);
	}

	.tags__list {
		display: contents;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.tags__chip {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		max-width: 100%;
		padding: 2px 2px 2px var(--spacing-sm);
		border: 1px solid var(--color-border);
		border-radius: 999px;
		background: var(--color-background);
		color: var(--color-text);
		font-size: 0.875rem;
	}

	.tags__text {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.tags__remove {
		display: grid;
		place-items: center;
		width: 1.5rem;
		height: 1.5rem;
		flex-shrink: 0;
		border: 0;
		border-radius: 50%;
		background: transparent;
		color: var(--color-text-secondary);
		font-size: 1rem;
		line-height: 1;
		cursor: pointer;
	}

	.tags__remove:hover:not(:disabled) {
		background: var(--color-surface-hover);
		color: var(--color-danger);
	}

	.tags__remove:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 1px;
	}

	.tags__input {
		flex: 1;
		min-width: 8rem;
		padding: var(--spacing-xs) var(--spacing-sm);
		border: 0;
		background: transparent;
		box-shadow: none;
	}

	.tags__input:focus {
		box-shadow: none;
	}

	.tags--disabled {
		opacity: 0.55;
	}
</style>
