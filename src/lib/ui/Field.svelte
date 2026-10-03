<!--
	Field — the label, hint and error around one control, wired together.

	The control goes in the slot and takes `id` and `describedBy` from it, so
	the label is a real <label for>, the hint and error are read with the
	control, and an error sets aria-invalid. Every form control in the kit is
	built on this; use it directly for anything custom.
-->
<script lang="ts">
	import { uid } from './logic';

	export let label: string;
	export let hint = '';
	export let error = '';
	export let required = false;
	export let id: string = uid('field');
	/** Hide the label visually while keeping it for assistive technology. */
	export let hideLabel = false;

	$: hintId = hint ? `${id}-hint` : '';
	$: errorId = error ? `${id}-error` : '';
	$: describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
</script>

<div class="field" class:field--invalid={error}>
	<label for={id} class="field__label" class:sr-only={hideLabel}>
		{label}
		{#if required}<span class="field__required" aria-hidden="true">*</span>{/if}
	</label>
	<slot {id} {describedBy} invalid={Boolean(error)} />
	{#if hint}<p id={hintId} class="field__hint">{hint}</p>{/if}
	{#if error}<p id={errorId} class="field__error">{error}</p>{/if}
</div>

<style>
	.field {
		display: grid;
		gap: var(--spacing-xs);
	}

	.field__label {
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--color-text);
	}

	.field__required {
		margin-left: 0.125rem;
		color: var(--color-error);
	}

	.field__hint,
	.field__error {
		margin: 0;
		font-size: 0.8125rem;
	}

	.field__hint {
		color: var(--color-text-secondary);
	}

	.field__error {
		color: var(--color-error);
		font-weight: 600;
	}

	.field--invalid :global(input),
	.field--invalid :global(textarea),
	.field--invalid :global(select) {
		border-color: var(--color-error);
	}
</style>
