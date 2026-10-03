<!-- /components demos: Forms. -->
<script lang="ts">
	import {
		Button,
		Calendar,
		Checkbox,
		Combobox,
		DatePicker,
		Field,
		FileDrop,
		InputGroup,
		InputOTP,
		NumberInput,
		RadioGroup,
		Select,
		Slider,
		Switch,
		TagInput,
		Textarea,
		TextInput
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

	// Combobox: creatable, so a new city is added to the list.
	let cities = [
		{ value: 'ams', label: 'Amsterdam' },
		{ value: 'ber', label: 'Berlin' },
		{ value: 'lis', label: 'Lisbon' },
		{ value: 'lon', label: 'London' },
		{ value: 'mad', label: 'Madrid' },
		{ value: 'osl', label: 'Oslo' },
		{ value: 'par', label: 'Paris', disabled: true },
		{ value: 'sao', label: 'São Paulo' },
		{ value: 'zur', label: 'Zürich' }
	];
	let city = '';
	const addCity = (value: string) => (cities = [...cities, { value, label: value }]);

	// Calendar and DatePicker: today onward, weekends off in the calendar.
	const pad = (n: number) => String(n).padStart(2, '0');
	const now = new Date();
	const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
	let day = '';
	let start = '';
	const weekend = (iso: string) => [0, 6].includes(new Date(iso).getUTCDay());

	// InputOTP: "verifies" 123456.
	let code = '';
	let codeState: 'idle' | 'ok' | 'bad' = 'idle';
	$: if (code.length < 6) codeState = 'idle';

	let site = '';
	let search = '';
	let guests: number | null = 2;
	let weight: number | null = 70.5;
	let topics = ['svelte', 'accessibility'];
	let files: File[] = [];
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
<CatalogItem id="combobox">
	<div class="stack">
		<Combobox
			label="City"
			options={cities}
			bind:value={city}
			placeholder="Start typing… try “zur” or “sao”"
			hint="Accents do not matter. Type a new city and press Enter to add it."
			creatable
			on:create={(e) => addCity(e.detail.value)}
		/>
		<p class="note">Chosen: {city || 'nothing yet'}</p>
	</div>
</CatalogItem>
<CatalogItem id="calendar">
	<div class="stack">
		<Calendar bind:value={day} min={today} isDisabled={weekend} weekStartsOn={1} />
		<p class="note">
			{day ? `Booked for ${day}.` : 'Pick a weekday. Try PageDown, and Shift+PageDown.'}
		</p>
	</div>
</CatalogItem>
<CatalogItem id="date-picker">
	<div class="stack">
		<DatePicker
			label="Start date"
			bind:value={start}
			min={today}
			hint="Type yyyy-mm-dd, or open the calendar."
			required
		/>
	</div>
</CatalogItem>
<CatalogItem id="input-otp">
	<div class="stack">
		<InputOTP
			label="Verification code"
			bind:value={code}
			hint="We sent a code to your phone. Try 123456, or paste it."
			error={codeState === 'bad' ? 'That code did not match. Try again.' : ''}
			on:complete={(e) => (codeState = e.detail.value === '123456' ? 'ok' : 'bad')}
		/>
		{#if codeState === 'ok'}<p class="note">Verified.</p>{/if}
	</div>
</CatalogItem>
<CatalogItem id="input-group">
	<div class="stack">
		<InputGroup
			label="Website"
			prefix="https://"
			suffix=".com"
			bind:value={site}
			placeholder="your-name"
		/>
		<InputGroup
			label="Search the docs"
			type="search"
			bind:value={search}
			hideLabel
			placeholder="Search"
		>
			<svg slot="leading" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
				<circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2" />
				<path d="m20 20-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
			</svg>
			<Button slot="trailing" size="sm" disabled={!search}>Go</Button>
		</InputGroup>
	</div>
</CatalogItem>
<CatalogItem id="number-input">
	<div class="stack">
		<NumberInput label="Guests" bind:value={guests} min={1} max={12} hint="Between 1 and 12." />
		<NumberInput label="Weight" bind:value={weight} step={0.5} min={0} unit="kg" />
	</div>
</CatalogItem>
<CatalogItem id="tag-input">
	<div class="stack">
		<TagInput
			label="Topics"
			bind:tags={topics}
			max={5}
			hint="Enter or a comma adds; Backspace removes the last. Up to five."
			validate={(t) => (t.length > 20 ? 'Keep each topic under 20 characters.' : '')}
		/>
	</div>
</CatalogItem>
<CatalogItem id="file-drop">
	<div class="stack">
		<FileDrop
			label="Attachments"
			bind:files
			accept="image/*,.pdf"
			maxSize={5 * 1024 * 1024}
			multiple
			hint="Try a .txt file, or something over 5 MB, to see a refusal."
		/>
	</div>
</CatalogItem>
