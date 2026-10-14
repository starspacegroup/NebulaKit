<!--
	AppearanceSettings — theme (light / dark / system as radio cards), density,
	text size, reduce motion, and a live preview. It owns no storage: bind
	`value` or listen to `change` and persist it where the app keeps settings.
-->
<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import RadioGroup from '$lib/ui/RadioGroup.svelte';
	import Slider from '$lib/ui/Slider.svelte';
	import Switch from '$lib/ui/Switch.svelte';
	import {
		DEFAULT_APPEARANCE,
		TEXT_SIZE_MAX,
		TEXT_SIZE_MIN,
		TEXT_SIZE_STEP,
		clampTextSize,
		normalizeAppearance,
		previewStyle,
		resolveTheme,
		type Appearance,
		type AppearanceDensity,
		type ThemeChoice
	} from './logic';

	export let value: Appearance = { ...DEFAULT_APPEARANCE };
	/** Whether the operating system prefers dark; read from the browser once mounted when left unset. */
	export let systemPrefersDark: boolean | undefined = undefined;
	export let level: 2 | 3 | 4 = 2;
	export let copy: Partial<typeof DEFAULT_COPY> = {};

	const DEFAULT_COPY = {
		title: 'Appearance',
		theme: 'Theme',
		themeLight: 'Light',
		themeDark: 'Dark',
		themeSystem: 'System',
		themeSystemHint: 'Follows your device',
		density: 'Density',
		comfortable: 'Comfortable',
		comfortableHint: 'More space around things',
		compact: 'Compact',
		compactHint: 'Fit more on screen',
		textSize: 'Text size',
		textSizeHint: 'Scales text in the preview and, once saved, across the app.',
		reduceMotion: 'Reduce motion',
		reduceMotionHint: 'Turns off animations and transitions.',
		preview: 'Preview',
		previewHeading: 'The quick brown fox',
		previewBody: 'This is how text, buttons and spacing will look with your choices.',
		previewButton: 'Sample button',
		previewMotion: 'Animation',
		previewMotionOn: 'playing',
		previewMotionOff: 'stopped'
	};

	const dispatch = createEventDispatcher<{ change: Appearance }>();

	$: t = { ...DEFAULT_COPY, ...copy };
	$: current = normalizeAppearance(value);
	$: resolved = resolveTheme(current.theme, systemDark);
	$: themeCards = [
		{ id: 'light' as ThemeChoice, label: t.themeLight, hint: '' },
		{ id: 'dark' as ThemeChoice, label: t.themeDark, hint: '' },
		{ id: 'system' as ThemeChoice, label: t.themeSystem, hint: t.themeSystemHint }
	];

	let detectedDark = false;
	$: systemDark = systemPrefersDark ?? detectedDark;

	onMount(() => {
		if (typeof matchMedia !== 'function') return;
		const query = matchMedia('(prefers-color-scheme: dark)');
		detectedDark = query.matches;
		const on = (e: MediaQueryListEvent) => (detectedDark = e.matches);
		query.addEventListener?.('change', on);
		return () => query.removeEventListener?.('change', on);
	});

	function update(patch: Partial<Appearance>) {
		value = normalizeAppearance({ ...current, ...patch });
		dispatch('change', value);
	}

	function onSize(event: Event) {
		update({ textSize: clampTextSize((event.target as HTMLInputElement).value) });
	}

	function onDensity(event: Event) {
		update({ density: (event.target as HTMLInputElement).value as AppearanceDensity });
	}

	function onMotion(event: Event) {
		update({ reduceMotion: (event.target as HTMLInputElement).checked });
	}

	function swatchTheme(id: ThemeChoice): 'light' | 'dark' {
		return resolveTheme(id, systemDark);
	}
</script>

<section class="appearance" aria-labelledby="appearance-title">
	<svelte:element this={`h${level}`} id="appearance-title" class="appearance__title"
		>{t.title}</svelte:element
	>

	<div class="appearance__grid">
		<div class="appearance__controls">
			<fieldset class="themes">
				<legend>{t.theme}</legend>
				<div class="themes__cards">
					{#each themeCards as card (card.id)}
						<label class="theme-card" class:theme-card--on={current.theme === card.id}>
							<input
								type="radio"
								name="appearance-theme"
								value={card.id}
								checked={current.theme === card.id}
								on:change={() => update({ theme: card.id })}
							/>
							<span class="theme-card__swatch" data-theme={swatchTheme(card.id)} aria-hidden="true">
								<span class="theme-card__bar"></span>
								<span class="theme-card__bar theme-card__bar--short"></span>
							</span>
							<span class="theme-card__label">{card.label}</span>
							{#if card.hint}<span class="theme-card__hint">{card.hint}</span>{/if}
						</label>
					{/each}
				</div>
			</fieldset>

			<RadioGroup
				legend={t.density}
				name="appearance-density"
				value={current.density}
				options={[
					{ value: 'comfortable', label: t.comfortable, hint: t.comfortableHint },
					{ value: 'compact', label: t.compact, hint: t.compactHint }
				]}
				on:change={onDensity}
			/>

			<Slider
				label={t.textSize}
				hint={t.textSizeHint}
				min={TEXT_SIZE_MIN}
				max={TEXT_SIZE_MAX}
				step={TEXT_SIZE_STEP}
				unit="%"
				value={current.textSize}
				on:input={onSize}
				on:change={onSize}
			/>

			<div>
				<Switch label={t.reduceMotion} checked={current.reduceMotion} on:change={onMotion} />
				<p class="appearance__hint">{t.reduceMotionHint}</p>
			</div>
		</div>

		<div
			class="preview"
			role="group"
			aria-label={t.preview}
			data-theme={resolved}
			data-density={current.density}
			data-reduce-motion={current.reduceMotion}
			style={previewStyle(current)}
		>
			<p class="preview__label">{t.preview}</p>
			<h3 class="preview__heading">{t.previewHeading}</h3>
			<p class="preview__body">{t.previewBody}</p>
			<div class="preview__row">
				<button type="button" class="preview__button" tabindex="-1" aria-hidden="true"
					>{t.previewButton}</button
				>
				<span class="preview__motion">
					<span class="preview__dot" aria-hidden="true"></span>
					{t.previewMotion}: {current.reduceMotion ? t.previewMotionOff : t.previewMotionOn}
				</span>
			</div>
		</div>
	</div>
</section>

<style>
	.appearance {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
		min-width: 0;
	}

	.appearance__title {
		margin: 0;
	}

	.appearance__grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-lg);
		min-width: 0;
	}

	@media (min-width: 52rem) {
		.appearance__grid {
			grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
			align-items: start;
		}
	}

	.appearance__controls {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-lg);
		min-width: 0;
	}

	.appearance__hint {
		margin: var(--spacing-xs) 0 0;
		color: var(--color-text-secondary);
		font-size: 0.875rem;
	}

	.themes {
		min-width: 0;
		margin: 0;
		padding: 0;
		border: 0;
	}

	.themes legend {
		margin-block-end: var(--spacing-sm);
		padding: 0;
		font-weight: 600;
	}

	.themes__cards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
		gap: var(--spacing-sm);
	}

	.theme-card {
		position: relative;
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		align-content: start;
		gap: var(--spacing-xs);
		min-height: 2.75rem;
		padding: var(--spacing-sm);
		border: 2px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-background);
		color: var(--color-text);
		cursor: pointer;
	}

	.theme-card:hover {
		background: var(--color-surface-hover);
	}

	.theme-card--on {
		border-color: var(--color-primary);
	}

	.theme-card input {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		margin: 0;
		opacity: 0;
		cursor: pointer;
	}

	.theme-card:has(input:focus-visible) {
		outline: 3px solid var(--color-primary);
		outline-offset: 2px;
	}

	.theme-card__swatch {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-xs);
		padding: var(--spacing-sm);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-background);
	}

	.theme-card__bar {
		display: block;
		height: 0.4rem;
		border-radius: 999px;
		background: var(--color-text);
	}

	.theme-card__bar--short {
		inline-size: 60%;
		background: var(--color-primary-solid);
	}

	.theme-card__label {
		font-weight: 600;
	}

	.theme-card--on .theme-card__label::before {
		content: '\2713\00a0';
	}

	.theme-card__hint {
		color: var(--color-text-secondary);
		font-size: 0.8rem;
	}

	.preview {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-sm);
		min-width: 0;
		padding: var(--preview-pad, 1rem);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-background);
		color: var(--color-text);
		overflow-wrap: anywhere;
	}

	.preview > * {
		margin: 0;
	}

	.preview__label {
		color: var(--color-text-secondary);
		font-size: 0.75em;
		font-weight: 600;
		text-transform: uppercase;
	}

	.preview__heading {
		font-size: 1.25em;
	}

	.preview__body {
		color: var(--color-text-secondary);
	}

	.preview__row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--preview-gap, 1rem);
	}

	.preview__button {
		padding: 0.5em 1em;
		border: 1px solid transparent;
		border-radius: var(--radius-md);
		background: var(--color-primary-solid);
		color: var(--color-on-solid);
		font: inherit;
	}

	.preview__motion {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-xs);
		font-size: 0.875em;
	}

	.preview__dot {
		inline-size: 0.75em;
		block-size: 0.75em;
		border-radius: 50%;
		background: var(--color-primary-solid);
		animation: preview-pulse 1.2s ease-in-out infinite;
	}

	.preview[data-reduce-motion='true'] .preview__dot {
		animation: none;
	}

	@keyframes preview-pulse {
		50% {
			transform: scale(1.5);
			opacity: 0.5;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.preview__dot {
			animation: none;
		}
	}
</style>
