<!-- TextInput — a labelled single-line input. Pass `type` for email, password, search, url, tel or number. -->
<script lang="ts">
	import Field from './Field.svelte';

	export let label: string;
	export let value = '';
	export let type: 'text' | 'email' | 'password' | 'search' | 'url' | 'tel' | 'number' = 'text';
	export let placeholder = '';
	export let hint = '';
	export let error = '';
	export let required = false;
	export let disabled = false;
	export let hideLabel = false;
	export let id: string | undefined = undefined;

	// `type` cannot be dynamic with bind:value, so the value is wired by hand.
	function onInput(event: Event) {
		value = (event.currentTarget as HTMLInputElement).value;
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
	<input
		id={fieldId}
		{type}
		{value}
		{placeholder}
		{required}
		{disabled}
		aria-describedby={describedBy}
		aria-invalid={invalid || undefined}
		on:input={onInput}
		on:input
		on:change
		on:blur
		{...$$restProps}
	/>
</Field>

<style>
	input {
		width: 100%;
		box-sizing: border-box;
	}
</style>
