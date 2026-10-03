<!-- Textarea — labelled multi-line input, with an optional live character count against `maxlength`. -->
<script lang="ts">
	import Field from './Field.svelte';

	export let label: string;
	export let value = '';
	export let rows = 4;
	export let placeholder = '';
	export let hint = '';
	export let error = '';
	export let required = false;
	export let disabled = false;
	export let maxlength: number | undefined = undefined;
	export let id: string | undefined = undefined;
</script>

<Field
	{label}
	{hint}
	{error}
	{required}
	{...id ? { id } : {}}
	let:id={fieldId}
	let:describedBy
	let:invalid
>
	<textarea
		id={fieldId}
		bind:value
		{rows}
		{placeholder}
		{required}
		{disabled}
		{maxlength}
		aria-describedby={describedBy}
		aria-invalid={invalid || undefined}
		on:input
		on:change
		{...$$restProps}></textarea>
	{#if maxlength}
		<p class="count" aria-live="polite">{value.length} / {maxlength}</p>
	{/if}
</Field>

<style>
	textarea {
		width: 100%;
		box-sizing: border-box;
		resize: vertical;
	}

	.count {
		margin: 0;
		justify-self: end;
		font-size: 0.8125rem;
		color: var(--color-text-secondary);
	}
</style>
