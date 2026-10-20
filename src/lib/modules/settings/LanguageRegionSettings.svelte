<!--
	LanguageRegionSettings — language, time zone (a searchable combobox), date
	style, clock, number format and currency, with a live preview made by Intl.
	Bind `value` or listen to `change`. Pass `now` so the preview is stable.
-->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Combobox from '$lib/ui/Combobox.svelte';
	import RadioGroup from '$lib/ui/RadioGroup.svelte';
	import Select from '$lib/ui/Select.svelte';
	import {
		DEFAULT_REGION,
		LANGUAGES,
		TIME_ZONES,
		isValidTimeZone,
		regionPreview,
		zoneCity,
		zoneOptions,
		type LanguageOption,
		type RegionPrefs
	} from './logic';

	export let value: RegionPrefs = { ...DEFAULT_REGION };
	export let languages: LanguageOption[] = LANGUAGES;
	export let timeZones: string[] = TIME_ZONES;
	export let currencies: string[] = ['USD', 'EUR', 'GBP', 'JPY', 'BRL'];
	/** The instant the preview formats. */
	export let now: string = new Date().toISOString();
	export let level: 2 | 3 | 4 = 2;
	export let copy: Partial<typeof DEFAULT_COPY> = {};

	const DEFAULT_COPY = {
		title: 'Language and region',
		language: 'Language',
		timeZone: 'Time zone',
		timeZoneHint: 'Type a city to search.',
		timeZoneEmpty: 'No matching time zone',
		dateStyle: 'Date format',
		short: 'Short',
		medium: 'Medium',
		long: 'Long',
		full: 'Full',
		clock: 'Clock',
		clockAuto: 'Match language',
		clock12: '12-hour',
		clock24: '24-hour',
		numbers: 'Number format',
		numbersAuto: 'Same as language',
		currency: 'Currency',
		preview: 'Preview',
		date: 'Date',
		time: 'Time',
		number: 'Number',
		money: 'Currency amount',
		percent: 'Percentage'
	};

	const dispatch = createEventDispatcher<{ change: RegionPrefs }>();

	$: t = { ...DEFAULT_COPY, ...copy };
	$: zones =
		isValidTimeZone(value.timeZone) && !timeZones.includes(value.timeZone)
			? [...timeZones, value.timeZone]
			: timeZones;
	$: zoneChoices = zoneOptions(zones, now);
	$: preview = regionPreview(value, now);
	$: styles = [
		{ value: 'short', label: t.short },
		{ value: 'medium', label: t.medium },
		{ value: 'long', label: t.long },
		{ value: 'full', label: t.full }
	];

	function update(patch: Partial<RegionPrefs>) {
		value = { ...value, ...patch };
		dispatch('change', value);
	}

	function pick(key: keyof RegionPrefs, event: Event) {
		update({ [key]: (event.target as HTMLInputElement | HTMLSelectElement).value });
	}

	function onZone(event: CustomEvent<{ value: string }>) {
		if (isValidTimeZone(event.detail.value)) update({ timeZone: event.detail.value });
	}

	$: zoneHint = `${t.timeZoneHint} ${zoneCity(value.timeZone)}.`;
</script>

<section class="region" aria-labelledby="region-title">
	<svelte:element this={`h${level}`} id="region-title" class="region__title"
		>{t.title}</svelte:element
	>

	<div class="region__grid">
		<div class="region__form">
			<Select
				label={t.language}
				value={value.language}
				options={languages}
				on:change={(e) => pick('language', e)}
			/>

			<Combobox
				label={t.timeZone}
				hint={zoneHint}
				options={zoneChoices}
				value={value.timeZone}
				emptyText={t.timeZoneEmpty}
				on:change={onZone}
			/>

			<Select
				label={t.dateStyle}
				value={value.dateStyle}
				options={styles}
				on:change={(e) => pick('dateStyle', e)}
			/>

			<RadioGroup
				legend={t.clock}
				name="region-clock"
				inline
				value={value.hourCycle}
				options={[
					{ value: 'auto', label: t.clockAuto },
					{ value: '12', label: t.clock12 },
					{ value: '24', label: t.clock24 }
				]}
				on:change={(e) => pick('hourCycle', e)}
			/>

			<Select
				label={t.numbers}
				value={value.numberLocale}
				options={[{ value: '', label: t.numbersAuto }, ...languages]}
				on:change={(e) => pick('numberLocale', e)}
			/>

			<Select
				label={t.currency}
				value={value.currency}
				options={currencies.map((c) => ({ value: c, label: c }))}
				on:change={(e) => pick('currency', e)}
			/>
		</div>

		<div class="preview" role="group" aria-label={t.preview}>
			<p class="preview__label">{t.preview}</p>
			<dl class="preview__list" aria-live="polite">
				<div>
					<dt>{t.date}</dt>
					<dd>{preview.date}</dd>
				</div>
				<div>
					<dt>{t.time}</dt>
					<dd>{preview.time}</dd>
				</div>
				<div>
					<dt>{t.number}</dt>
					<dd>{preview.number}</dd>
				</div>
				<div>
					<dt>{t.money}</dt>
					<dd>{preview.currency}</dd>
				</div>
				<div>
					<dt>{t.percent}</dt>
					<dd>{preview.percent}</dd>
				</div>
			</dl>
		</div>
	</div>
</section>

<style>
	.region {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
		min-width: 0;
	}

	.region__title {
		margin: 0;
	}

	.region__grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-lg);
		min-width: 0;
	}

	@media (min-width: 52rem) {
		.region__grid {
			grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
			align-items: start;
		}
	}

	.region__form {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
		min-width: 0;
	}

	.preview {
		min-width: 0;
		padding: var(--spacing-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-background);
	}

	.preview__label {
		margin: 0 0 var(--spacing-sm);
		color: var(--color-text-secondary);
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
	}

	.preview__list {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-sm);
		margin: 0;
	}

	.preview__list div {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 0.125rem;
	}

	.preview__list dt {
		color: var(--color-text-secondary);
		font-size: 0.8rem;
	}

	.preview__list dd {
		margin: 0;
		font-size: 1.05rem;
		font-variant-numeric: tabular-nums;
		overflow-wrap: anywhere;
	}
</style>
