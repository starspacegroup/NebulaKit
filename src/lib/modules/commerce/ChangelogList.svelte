<!--
	ChangelogList — releases, newest first, each with its changes tagged New /
	Improved / Fixed / Security / Breaking / Deprecated. Every version heading is
	an anchor link (#v1-2-0) so a release can be shared. The filter is a group of
	checkboxes; how many releases are showing is announced politely.
-->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Badge from '$lib/ui/Badge.svelte';
	import { uid } from '$lib/ui/logic';
	import {
		CHANGE_TYPE_LABELS,
		changeTone,
		changeTypesIn,
		filterReleases,
		formatCommerceDate,
		sortReleases,
		versionSlug,
		type ChangeType,
		type Release
	} from './logic';

	export let releases: Release[] = [];
	/** Types currently shown. Empty means all. Bind it. */
	export let types: ChangeType[] = [];
	export let showFilter = true;
	export let locale = 'en-US';
	export let timeZone = 'UTC';
	export let heading = 'Changelog';
	export let level: 2 | 3 | 4 = 2;
	export let typeLabels: Record<ChangeType, string> = CHANGE_TYPE_LABELS;
	export let labels: Partial<typeof defaults> = {};

	const defaults = {
		filter: 'Show only',
		clear: 'Show all',
		showing: 'Showing {shown} of {total} releases',
		showingOne: 'Showing 1 of {total} releases',
		link: 'Link to version {version}',
		none: 'No releases match this filter.',
		empty: 'No releases yet.'
	};

	const dispatch = createEventDispatcher<{ filter: { types: ChangeType[] } }>();
	const id = uid('changelog');

	$: t = { ...defaults, ...labels };
	$: sorted = sortReleases(releases);
	$: available = changeTypesIn(releases);
	$: visible = filterReleases(sorted, types);
	$: status = (visible.length === 1 ? t.showingOne : t.showing)
		.replace('{shown}', String(visible.length))
		.replace('{total}', String(releases.length));

	function toggle(type: ChangeType) {
		types = types.includes(type) ? types.filter((x) => x !== type) : [...types, type];
		dispatch('filter', { types });
	}

	function clear() {
		types = [];
		dispatch('filter', { types });
	}
</script>

<section class="changelog" aria-labelledby="{id}-h">
	<svelte:element this={`h${level}`} class="changelog__title" id="{id}-h">{heading}</svelte:element>

	{#if showFilter && available.length > 1}
		<fieldset class="filter">
			<legend>{t.filter}</legend>
			<div class="filter__chips">
				{#each available as type (type)}
					<label class="chip" class:chip--on={types.includes(type)}>
						<input type="checkbox" checked={types.includes(type)} on:change={() => toggle(type)} />
						<span>{typeLabels[type]}</span>
					</label>
				{/each}
				{#if types.length}
					<button type="button" class="filter__clear" on:click={clear}>{t.clear}</button>
				{/if}
			</div>
		</fieldset>
	{/if}

	<p class="changelog__status" role="status">{releases.length ? status : ''}</p>

	{#if releases.length === 0}
		<p class="changelog__none">{t.empty}</p>
	{:else if visible.length === 0}
		<p class="changelog__none">{t.none}</p>
	{:else}
		<ol class="releases">
			{#each visible as release (release.version)}
				{@const slug = versionSlug(release.version)}
				<li>
					<article class="release" id={slug} aria-labelledby="{slug}-title">
						<header class="release__head">
							<svelte:element
								this={`h${Math.min(level + 1, 5)}`}
								class="release__title"
								id="{slug}-title"
							>
								<a href="#{slug}" aria-label={t.link.replace('{version}', release.version)}
									>{release.version}</a
								>{#if release.title}<span class="release__name">— {release.title}</span>{/if}
							</svelte:element>
							<time class="release__date" datetime={release.date}
								>{formatCommerceDate(release.date, locale, timeZone, 'long')}</time
							>
						</header>
						<ul class="changes">
							{#each release.changes as change, i (i)}
								<li class="change">
									<Badge tone={changeTone(change.type)}>{typeLabels[change.type]}</Badge>
									<span>{change.text}</span>
								</li>
							{/each}
						</ul>
					</article>
				</li>
			{/each}
		</ol>
	{/if}
</section>

<style>
	.changelog {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
		min-width: 0;
		color: var(--color-text);
	}

	.changelog__title {
		margin: 0;
		font-size: 1.25rem;
	}

	.changelog__status,
	.changelog__none {
		margin: 0;
		color: var(--color-text-secondary);
		font-size: 0.875rem;
	}

	.filter {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-xs);
		margin: 0;
		padding: 0;
		border: 0;
	}

	.filter legend {
		padding: 0;
		margin-bottom: var(--spacing-xs);
		font-size: 0.9375rem;
		font-weight: 600;
	}

	.filter__chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-sm);
	}

	.chip {
		position: relative;
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		padding: 0 var(--spacing-md);
		border: 1px solid var(--color-border);
		border-radius: 999px;
		background: var(--color-background);
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
	}

	.chip--on {
		border-color: var(--color-primary);
		background: color-mix(in srgb, var(--color-primary) 14%, var(--color-background));
	}

	.chip--on::before {
		content: '✓';
		margin-inline-end: var(--spacing-xs);
	}

	.chip input {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		margin: 0;
		opacity: 0;
		cursor: pointer;
	}

	.chip:has(input:focus-visible) {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.filter__clear {
		min-height: 2.75rem;
		padding: 0 var(--spacing-sm);
		color: var(--color-primary);
		font-weight: 600;
		text-decoration: underline;
	}

	.releases {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-lg);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.release {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-sm);
		scroll-margin-top: 5rem;
	}

	.release__head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--spacing-xs) var(--spacing-md);
		padding-bottom: var(--spacing-xs);
		border-bottom: 1px solid var(--color-border);
	}

	.release__title {
		margin: 0;
		font-size: 1.125rem;
	}

	.release__title a {
		color: inherit;
		text-decoration: none;
	}

	.release__title a:hover {
		text-decoration: underline;
	}

	.release__name {
		margin-inline-start: var(--spacing-xs);
		font-weight: 400;
	}

	.release__date {
		color: var(--color-text-secondary);
		font-size: 0.875rem;
	}

	.changes {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-sm);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.change {
		display: flex;
		align-items: flex-start;
		gap: var(--spacing-sm);
	}

	.change :global(.badge) {
		flex-shrink: 0;
		min-width: 5.5rem;
		justify-content: flex-start;
	}

	/* Digits that change keep their width, so a live count or time never nudges what is beside it. */
	time {
		font-variant-numeric: tabular-nums;
	}
</style>
