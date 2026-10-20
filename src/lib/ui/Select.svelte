<!-- Select — a labelled native select. Native on purpose: it is the most accessible picker there is. -->
<script lang="ts">
	import Field from './Field.svelte';

	export let label: string;
	export let value = '';
	export let options: { value: string; label: string; disabled?: boolean }[] = [];
	/** A first, empty choice. */
	export let placeholder = '';
	export let hint = '';
	export let error = '';
	export let required = false;
	export let disabled = false;
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
	<select
		id={fieldId}
		bind:value
		{required}
		{disabled}
		aria-describedby={describedBy}
		aria-invalid={invalid || undefined}
		on:change
		{...$$restProps}
	>
		{#if placeholder}<option value="" disabled>{placeholder}</option>{/if}
		{#each options as option (option.value)}
			<option value={option.value} disabled={option.disabled}>{option.label}</option>
		{/each}
	</select>
</Field>

<style>
	select {
		width: 100%;
		box-sizing: border-box;
	}
</style>
