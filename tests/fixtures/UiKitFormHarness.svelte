<!--
	Renders the UI kit's richer form controls the way a page would — bound,
	with slots filled — so their tests can read the bound value back from
	`data-testid="state"` and hear their events through `onEvent`. A callback
	prop works the same under Svelte 4 and 5; the testing-library event APIs
	do not.
-->
<script lang="ts">
	import Calendar from '$lib/ui/Calendar.svelte';
	import Combobox from '$lib/ui/Combobox.svelte';
	import DatePicker from '$lib/ui/DatePicker.svelte';
	import FileDrop from '$lib/ui/FileDrop.svelte';
	import InputGroup from '$lib/ui/InputGroup.svelte';
	import InputOTP from '$lib/ui/InputOTP.svelte';
	import NumberInput from '$lib/ui/NumberInput.svelte';
	import TagInput from '$lib/ui/TagInput.svelte';
	import Toggle from '$lib/ui/Toggle.svelte';
	import ToggleGroup from '$lib/ui/ToggleGroup.svelte';

	export let which:
		| 'combobox'
		| 'calendar'
		| 'datepicker'
		| 'otp'
		| 'group'
		| 'number'
		| 'toggle'
		| 'toggle-group'
		| 'tags'
		| 'files';
	export let props: Record<string, unknown> = {};
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	export let value: any = '';
	export let pressed = false;
	export let tags: string[] = [];
	export let files: File[] = [];
	// `any` so each test can type the detail it expects.
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	export let onEvent: (name: string, detail: any) => void = () => {};

	let calendar: { focus: () => void };

	const cities = [
		{ value: 'ber', label: 'Berlin' },
		{ value: 'lis', label: 'Lisbon' },
		{ value: 'lon', label: 'London', disabled: true },
		{ value: 'zur', label: 'Zürich' }
	];
</script>

{#if which === 'combobox'}
	<Combobox
		label="City"
		options={cities}
		bind:value
		{...props}
		on:change={(e) => onEvent('change', e.detail)}
		on:create={(e) => onEvent('create', e.detail)}
	/>
	<button type="button">Elsewhere</button>
{:else if which === 'calendar'}
	<Calendar
		bind:this={calendar}
		today="2024-01-15"
		bind:value
		{...props}
		on:change={(e) => onEvent('change', e.detail)}
	/>
	<button type="button" on:click={() => (value = '2023-09-01')}>Set September</button>
	<button type="button" on:click={() => calendar.focus()}>Focus calendar</button>
{:else if which === 'datepicker'}
	<DatePicker
		label="Start date"
		today="2024-01-15"
		bind:value
		{...props}
		on:change={(e) => onEvent('change', e.detail)}
	/>
	<button type="button">Elsewhere</button>
{:else if which === 'otp'}
	<InputOTP bind:value {...props} on:complete={(e) => onEvent('complete', e.detail)} />
{:else if which === 'group'}
	<InputGroup label="Website" prefix="https://" suffix=".com" bind:value {...props}>
		<span slot="leading" data-testid="icon">🌐</span>
		<button slot="trailing" type="button">Check</button>
	</InputGroup>
{:else if which === 'number'}
	<NumberInput
		label="Guests"
		bind:value
		{...props}
		on:change={(e) => onEvent('change', e.detail)}
	/>
{:else if which === 'toggle'}
	<Toggle bind:pressed {...props} on:change={(e) => onEvent('change', e.detail)}>Bold</Toggle>
{:else if which === 'toggle-group'}
	<ToggleGroup
		label="Text style"
		items={[
			{ value: 'b', label: 'Bold' },
			{ value: 'i', label: 'Italic', disabled: true },
			{ value: 'u', label: 'Underline' },
			{ value: 's', label: 'Strike' }
		]}
		bind:value
		{...props}
		on:change={(e) => onEvent('change', e.detail)}
	/>
{:else if which === 'tags'}
	<TagInput label="Topics" bind:tags {...props} on:change={(e) => onEvent('change', e.detail)} />
{:else if which === 'files'}
	<FileDrop
		label="Attachments"
		bind:files
		{...props}
		on:change={(e) => onEvent('change', e.detail)}
		on:reject={(e) => onEvent('reject', e.detail)}
	/>
{/if}
<span data-testid="state"
	>{JSON.stringify({ value, pressed, tags, files: files.map((f) => f.name) })}</span
>
