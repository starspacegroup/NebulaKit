<!--
	NotificationCenter — a bell button with a popover list of notifications.
	The unread count is part of the button's accessible name ("Notifications,
	3 unread"), not only the badge. The list is grouped by day (Today,
	Yesterday, then dated) against the `now` you pass in, newest first. Each
	row opens its notification; "Mark as read" and "Mark all as read" clear
	the unread state. Arrow keys, Home and End move between rows. Bind
	`items`: the module marks them read in place and also reports it with
	`on:read` (`{ id }`), `on:readall` and `on:select` (`{ id, href }`).
-->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { Popover } from '$lib/ui';
	import {
		bellLabel,
		formatCountBadge,
		formatNotificationTime,
		groupNotificationsByDay,
		timeAttribute,
		markAllNotificationsRead,
		markNotificationRead,
		unreadCount,
		type NotificationItem
	} from './logic';

	export let items: NotificationItem[] = [];
	/** The current time, injected so grouping is deterministic. */
	export let now: string | number | Date = new Date();
	export let timeZone = 'UTC';
	export let locale = 'en-US';
	export let label = 'Notifications';
	export let unreadWord = 'unread';
	export let markReadLabel = 'Mark as read';
	export let markAllLabel = 'Mark all as read';
	export let emptyTitle = 'You’re all caught up';
	export let emptyDescription = 'New notifications will show up here.';
	export let todayLabel = 'Today';
	export let yesterdayLabel = 'Yesterday';
	/** 1 to 6: the heading level of the day headings (the panel title is one level above). */
	export let level: 3 | 4 | 5 | 6 = 3;
	export let open = false;

	const dispatch = createEventDispatcher<{
		read: { id: string };
		readall: void;
		select: { id: string; href: string | undefined };
	}>();
	let list: HTMLElement | undefined;

	$: unread = unreadCount(items);
	$: badge = formatCountBadge(unread);
	$: groups = groupNotificationsByDay(items, now, {
		timeZone,
		locale,
		todayLabel,
		yesterdayLabel
	});

	function read(id: string) {
		items = markNotificationRead(items, id);
		dispatch('read', { id });
	}

	function readAll() {
		items = markAllNotificationsRead(items);
		dispatch('readall');
	}

	function select(item: NotificationItem) {
		if (!item.read) read(item.id);
		dispatch('select', { id: item.id, href: item.href });
	}

	function onKeydown(event: KeyboardEvent) {
		if (!list) return;
		const rows = [...list.querySelectorAll<HTMLElement>('[data-nav]')];
		const at = rows.indexOf(document.activeElement as HTMLElement);
		let next = -1;
		if (event.key === 'ArrowDown') next = at < 0 ? 0 : Math.min(rows.length - 1, at + 1);
		else if (event.key === 'ArrowUp') next = at < 0 ? rows.length - 1 : Math.max(0, at - 1);
		else if (event.key === 'Home') next = 0;
		else if (event.key === 'End') next = rows.length - 1;
		if (next < 0 || !rows.length) return;
		event.preventDefault();
		rows[next].focus();
	}
</script>

<Popover bind:open title={label} placement="bottom" align="end">
	<button
		slot="trigger"
		type="button"
		class="bell"
		aria-label={bellLabel(label, unread, unreadWord)}
	>
		<span aria-hidden="true" class="bell__icon">🔔</span>
		{#if badge}<span class="bell__badge" aria-hidden="true">{badge}</span>{/if}
	</button>

	<div class="center">
		<div class="center__bar">
			<button type="button" class="center__link" disabled={unread === 0} on:click={readAll}
				>{markAllLabel}</button
			>
		</div>

		{#if groups.length === 0}
			<div class="center__empty">
				<p class="center__empty-title">{emptyTitle}</p>
				<p class="center__empty-text">{emptyDescription}</p>
			</div>
		{:else}
			<!-- svelte-ignore a11y-no-static-element-interactions -->
			<div class="center__list" bind:this={list} on:keydown={onKeydown}>
				{#each groups as group (group.key)}
					<section aria-label={group.label}>
						<svelte:element this={`h${level}`} class="center__day">{group.label}</svelte:element>
						<ul>
							{#each group.items as item (item.id)}
								<li class="row" class:row--unread={!item.read}>
									<svelte:element
										this={item.href ? 'a' : 'button'}
										href={item.href}
										type={item.href ? undefined : 'button'}
										class="row__main"
										data-nav
										on:click={() => select(item)}
									>
										<span class="row__title">
											{#if !item.read}<span class="row__dot" aria-hidden="true"></span><span
													class="row__sr"
													>{unreadWord}:
												</span>{/if}{item.title}
										</span>
										{#if item.body}<span class="row__body">{item.body}</span>{/if}
										<time class="row__time" datetime={timeAttribute(item.at)}
											>{formatNotificationTime(item.at, locale, timeZone)}</time
										>
									</svelte:element>
									{#if !item.read}
										<button type="button" class="row__read" on:click={() => read(item.id)}>
											{markReadLabel}<span class="row__sr">: {item.title}</span>
										</button>
									{/if}
								</li>
							{/each}
						</ul>
					</section>
				{/each}
			</div>
		{/if}
	</div>
</Popover>

<style>
	.bell {
		position: relative;
		display: inline-grid;
		place-items: center;
		min-width: 44px;
		min-height: 44px;
		padding: 0;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-background);
		color: var(--color-text);
		font: inherit;
		cursor: pointer;
	}

	.bell:hover {
		background: var(--color-surface-hover);
	}

	.bell:focus-visible,
	.row__main:focus-visible,
	.row__read:focus-visible,
	.center__link:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.bell__icon {
		font-size: 1.25rem;
		line-height: 1;
	}

	.bell__badge {
		position: absolute;
		inset-block-start: -6px;
		inset-inline-end: -6px;
		min-width: 1.25rem;
		padding: 0 0.3rem;
		border-radius: 999px;
		background: var(--color-danger-solid);
		color: var(--color-on-solid);
		font-size: 0.7rem;
		font-weight: 700;
		line-height: 1.25rem;
		text-align: center;
	}

	.center {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-sm);
		inline-size: min(22rem, calc(100vw - 3rem));
		min-width: 0;
	}

	.center__bar {
		display: flex;
		justify-content: flex-end;
	}

	.center__link {
		min-height: 44px;
		padding: 0 var(--spacing-sm);
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-primary);
		font: inherit;
		font-weight: 600;
		text-decoration: underline;
		cursor: pointer;
	}

	.center__link:disabled {
		color: var(--color-text-secondary);
		text-decoration: none;
		cursor: default;
	}

	.center__list {
		max-height: min(24rem, 60dvh);
		overflow-y: auto;
	}

	.center__day {
		margin: var(--spacing-sm) 0 var(--spacing-xs);
		color: var(--color-text-secondary);
		font-size: 0.75rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	ul {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-xs);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.row {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-xs);
		padding: var(--spacing-xs);
		border-radius: var(--radius-md);
	}

	.row--unread {
		background: color-mix(in srgb, var(--color-primary) 8%, var(--color-background));
		border-inline-start: 3px solid var(--color-primary);
	}

	.row__main {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 2px;
		min-height: 44px;
		padding: var(--spacing-xs) var(--spacing-sm);
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-text);
		font: inherit;
		text-align: start;
		text-decoration: none;
		cursor: pointer;
	}

	.row__main:hover {
		background: var(--color-surface-hover);
	}

	.row__title {
		font-weight: 600;
		overflow-wrap: anywhere;
	}

	.row__dot {
		display: inline-block;
		width: 0.5rem;
		height: 0.5rem;
		margin-inline-end: var(--spacing-xs);
		border-radius: 50%;
		background: var(--color-primary);
	}

	.row__body {
		color: var(--color-text-secondary);
		font-size: 0.875rem;
		overflow-wrap: anywhere;
	}

	.row__time {
		color: var(--color-text-secondary);
		font-size: 0.75rem;
	}

	.row__read {
		justify-self: start;
		min-height: 44px;
		padding: 0 var(--spacing-sm);
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-primary);
		font: inherit;
		font-size: 0.875rem;
		text-decoration: underline;
		cursor: pointer;
	}

	.row__sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	.center__empty {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-xs);
		padding: var(--spacing-lg) var(--spacing-md);
		text-align: center;
	}

	.center__empty-title {
		margin: 0;
		font-weight: 700;
	}

	.center__empty-text {
		margin: 0;
		color: var(--color-text-secondary);
	}
</style>
