<!-- /components demos: Forms. -->
<script lang="ts">
	import {
		Checkbox,
		Field,
		RadioGroup,
		Select,
		Slider,
		Switch,
		TextInput,
		Textarea
	} from '$lib/ui';
	import CatalogItem from '../CatalogItem.svelte';

	let email = '';
	let bio = '';
	let plan = '';
	let agree = true;
	let partial = true;
	let billing = 'monthly';
	let notify = true;
	let volume = 40;
	let colour = '#3b82f6';

	$: emailError = email && !email.includes('@') ? 'That does not look like an email address.' : '';
</script>

<CatalogItem id="text-input">
	<div class="stack">
		<TextInput
			label="Email"
			type="email"
			bind:value={email}
			placeholder="you@example.com"
			hint="Type something without an @ to see the error."
			error={emailError}
			required
		/>
	</div>
</CatalogItem>
<CatalogItem id="textarea">
	<div class="stack">
		<Textarea label="Bio" bind:value={bio} maxlength={160} rows={3} />
	</div>
</CatalogItem>
<CatalogItem id="select">
	<div class="stack">
		<Select
			label="Plan"
			bind:value={plan}
			placeholder="Choose a plan"
			options={[
				{ value: 'free', label: 'Free' },
				{ value: 'pro', label: 'Pro' },
				{ value: 'team', label: 'Team', disabled: true }
			]}
		/>
	</div>
</CatalogItem>
<CatalogItem id="checkbox">
	<div class="stack">
		<Checkbox label="Email me updates" hint="About once a month." bind:checked={agree} />
		<Checkbox
			label="Select all (some selected)"
			indeterminate={partial}
			on:change={() => (partial = false)}
		/>
		<Checkbox label="Disabled" disabled />
	</div>
</CatalogItem>
<CatalogItem id="radio-group">
	<RadioGroup
		legend="Billing"
		bind:value={billing}
		inline
		options={[
			{ value: 'monthly', label: 'Monthly' },
			{ value: 'yearly', label: 'Yearly', hint: 'Two months free' },
			{ value: 'lifetime', label: 'Lifetime', disabled: true }
		]}
	/>
</CatalogItem>
<CatalogItem id="switch">
	<Switch label="Notifications" bind:checked={notify} />
	<Switch label="Disabled" disabled />
</CatalogItem>
<CatalogItem id="slider">
	<div class="stack"><Slider label="Volume" bind:value={volume} unit="%" /></div>
</CatalogItem>
<CatalogItem id="field">
	<div class="stack">
		<Field label="Accent colour" hint="Any colour; this one is native." let:id let:describedBy>
			<input {id} type="color" bind:value={colour} aria-describedby={describedBy} />
		</Field>
	</div>
</CatalogItem>
