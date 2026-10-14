<!--
	ActivityFeed — what happened, grouped by day. Each day is a heading (level
	configurable) over an ordered list; every entry has the person's avatar, what
	they did, and a <time> whose text is relative ("5 minutes ago") and whose
	title and datetime are exact. "Today" and "Yesterday" are worked out from the
	`now` you pass, in the `timeZone` you pass, so a feed renders the same on the
	server and in the browser. "Load more" asks the parent for older items and
	moves focus to the first new one.

	<ActivityFeed label="Activity" {items} {now} hasMore on:loadmore={…} />
-->
<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import Alert from '$lib/ui/Alert.svelte';
	import Avatar from '$lib/ui/Avatar.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import Skeleton from '$lib/ui/Skeleton.svelte';
	import { uid } from '$lib/ui/logic';
	import {
		absoluteTimeText,
		groupByDay,
		isoString,
		relativeTimeText,
		type DateInput
	} from './time-logic';

	type Item = {
		id: string;
		at: DateInput;
		actor: { name: string; avatar?: string };
		/** What they did: "commented on", "merged". */
		action: string;
		/** What it was done to. */
		target?: string;
		href?: string;
		detail?: string;
	};

	export let label = 'Activity';
	export let items: Item[] = [];
	/** The moment "Today" is measured from. Pass the same value on server and client. */
	export let now: DateInput = new Date();
	export let timeZone = 'UTC';
	export let locale = 'en-US';
	/** Heading level of the day headings. */
	export let level: 2 | 3 | 4 | 5 | 6 = 3;
	export let hasMore = false;
	export let loading = false;
	export let error = '';
	export let copy = {
		empty: 'No activity yet.',
		loadMore: 'Load more',
		loading: 'Loading activity',
		retry: 'Try again',
		justNow: 'just now',
		today: 'Today',
		yesterday: 'Yesterday'
	};

	const dispatch = createEventDispatcher<{ loadmore: void; retry: void }>();

	const prefix = uid('feed');
	let root: HTMLElement;
	let known: string[] | null = null;

	$: heading = `h${level}`;
	$: groups = groupByDay(items, (i) => i.at, now, {
		timeZone,
		locale,
		labels: { today: copy.today, yesterday: copy.yesterday }
	});
	$: if (known && items.length > known.length) focusNew();

	async function focusNew() {
		const before = known;
		known = null;
		await tick();
		const fresh = [...root.querySelectorAll<HTMLElement>('[data-feed-id]')].find(
			(el) => !before?.includes(el.dataset.feedId ?? '')
		);
		fresh?.focus();
	}

	function more() {
		known = items.map((i) => i.id);
		dispatch('loadmore');
	}
</script>

<section class="feed" aria-label={label} aria-busy={loading || undefined} bind:this={root}>
	{#if error}
		<Alert tone="danger" title={error}>
			<button type="button" class="feed__button" on:click={() => dispatch('retry')}
				>{copy.retry}</button
			>
		</Alert>
	{/if}

	{#if groups.length === 0 && !loading && !error}
		<EmptyState title={copy.empty} />
	{/if}

	{#each groups as group (group.key)}
		<section class="feed__day" aria-labelledby="{prefix}-{group.key}">
			<svelte:element this={heading} id="{prefix}-{group.key}" class="feed__heading"
				>{group.label}</svelte:element
			>
			<ol class="feed__list">
				{#each group.items as item (item.id)}
					<li class="feed__item" data-feed-id={item.id} tabindex="-1">
						<Avatar name={item.actor.name} src={item.actor.avatar} size="sm" />
						<div class="feed__body">
							<p class="feed__text">
								<strong>{item.actor.name}</strong>
								{item.action}
								{#if item.target}
									{#if item.href}<a href={item.href}>{item.target}</a>{:else}<em>{item.target}</em
										>{/if}
								{/if}
							</p>
							{#if item.detail}<p class="feed__detail">{item.detail}</p>{/if}
							<time
								class="feed__time"
								datetime={isoString(item.at)}
								title={absoluteTimeText(item.at, { locale, timeZone })}
								>{relativeTimeText(item.at, now, { locale, justNow: copy.justNow })}</time
							>
						</div>
					</li>
				{/each}
			</ol>
		</section>
	{/each}

	{#if loading}
		<div class="feed__loading" role="status">
			<span class="sr-only">{copy.loading}</span>
			<Skeleton lines={3} />
		</div>
	{/if}

	{#if hasMore && !loading}
		<button type="button" class="feed__button feed__more" on:click={more}>{copy.loadMore}</button>
	{/if}
</section>

<style>
	.feed {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-lg);
		min-width: 0;
	}

	.feed__heading {
		margin: 0 0 var(--spacing-sm);
		color: var(--color-text-secondary);
		font-size: 0.875rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.feed__list {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.feed__item {
		display: flex;
		align-items: flex-start;
		gap: var(--spacing-md);
		min-width: 0;
		border-radius: var(--radius-md);
	}

	.feed__item:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 4px;
	}

	.feed__body {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 0.125rem;
		min-width: 0;
	}

	.feed__text,
	.feed__detail {
		margin: 0;
		overflow-wrap: anywhere;
	}

	.feed__detail {
		color: var(--color-text-secondary);
		font-size: 0.9rem;
	}

	.feed__time {
		color: var(--color-text-secondary);
		font-size: 0.8125rem;
	}

	.feed a {
		color: var(--color-primary);
	}

	.feed__button {
		min-height: 2.75rem;
		padding: 0.5rem 1rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-text);
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}

	.feed__more {
		justify-self: start;
	}

	.feed__button:hover {
		background: var(--color-surface-hover);
	}

	.feed__button:focus-visible,
	.feed a:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}
</style>
