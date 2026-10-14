<!--
	CommentForm — a labelled textarea with a live character allowance and a
	submit button. The error appears after a failed submit (or as soon as the
	limit is passed), is tied to the field with aria-describedby + aria-invalid
	and is announced. The remaining-characters count is only spoken when the
	limit is close, so typing is not narrated.
-->
<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { uid } from '$lib/ui/logic';
	import { nearLimit, validateComment } from '../comment-logic';

	export let label: string;
	export let value = '';
	export let maxLength = 1000;
	export let submitLabel = 'Post';
	export let cancelLabel = 'Cancel';
	export let cancelable = false;
	export let autofocus = false;
	export let hideLabel = false;
	export let placeholder = '';
	export let messages = { empty: 'Write something first.', tooLong: 'This comment is too long.' };
	export let remainingLabel = (n: number) => `${n} characters left`;

	const dispatch = createEventDispatcher<{ submit: { text: string }; cancel: void }>();
	const id = uid('comment-form');
	let area: HTMLTextAreaElement;
	let attempted = false;

	$: result = validateComment(value, maxLength, messages);
	$: showError = !result.ok && (attempted || result.remaining < 0);
	$: warn = nearLimit(result.remaining, maxLength);

	onMount(() => {
		if (autofocus) area?.focus();
	});

	function submit() {
		attempted = true;
		if (!result.ok) {
			area.focus();
			return;
		}
		dispatch('submit', { text: value.trim() });
		value = '';
		attempted = false;
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && cancelable) {
			event.preventDefault();
			dispatch('cancel');
		} else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
			event.preventDefault();
			submit();
		}
	}
</script>

<form class="cform" on:submit|preventDefault={submit} novalidate>
	<label for="{id}-area" class="cform__label" class:sr-only={hideLabel}>{label}</label>
	<!-- prettier-ignore -->
	<textarea
		id="{id}-area"
		bind:this={area}
		bind:value
		rows="3"
		{placeholder}
		autocomplete="off"
		aria-invalid={showError ? 'true' : undefined}
		aria-describedby="{id}-count{showError ? ` ${id}-error` : ''}"
		on:keydown={onKeydown}></textarea>
	<div class="cform__meta">
		<span id="{id}-count" class="cform__count" class:cform__count--warn={warn}>
			<span aria-hidden="true">{result.remaining}</span>
			<span class="sr-only" aria-live={warn ? 'polite' : 'off'}
				>{warn ? remainingLabel(result.remaining) : ''}</span
			>
		</span>
		{#if showError}
			<p id="{id}-error" class="cform__error" role="alert">{result.error}</p>
		{/if}
	</div>
	<div class="cform__buttons">
		<button type="submit" class="cform__primary">{submitLabel}</button>
		{#if cancelable}
			<button type="button" class="cform__btn" on:click={() => dispatch('cancel')}
				>{cancelLabel}</button
			>
		{/if}
	</div>
</form>

<style>
	.cform {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-sm);
	}

	.cform__label {
		font-size: 0.9375rem;
		font-weight: 600;
	}

	textarea {
		width: 100%;
		min-height: 5rem;
		box-sizing: border-box;
		resize: vertical;
	}

	textarea[aria-invalid='true'] {
		border-color: var(--color-error);
	}

	.cform__meta {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--spacing-sm);
	}

	.cform__count {
		color: var(--color-text-secondary);
		font-size: 0.8125rem;
		font-variant-numeric: tabular-nums;
	}

	.cform__count--warn {
		color: var(--color-text);
		font-weight: 700;
	}

	.cform__error {
		margin: 0;
		color: var(--color-error);
		font-size: 0.875rem;
	}

	.cform__buttons {
		display: flex;
		gap: var(--spacing-sm);
	}

	.cform__btn,
	.cform__primary {
		min-height: 2.75rem;
		padding: 0.5rem 1.125rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-background);
		color: var(--color-text);
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}

	.cform__primary {
		border-color: var(--color-primary-solid);
		background: var(--color-primary-solid);
		color: var(--color-on-solid);
	}

	.cform__btn:hover {
		background: var(--color-surface-hover);
	}

	.cform__btn:focus-visible,
	.cform__primary:focus-visible,
	textarea:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}
</style>
