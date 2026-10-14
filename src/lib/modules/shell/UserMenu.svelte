<!--
	UserMenu — the avatar button at the end of a header, opening a menu: who
	you are signed in as, a list of items (links or actions), and Sign out at
	the end. The ARIA menu button pattern: Enter, Space or Down opens on the
	first item, Up on the last; arrows, Home and End move; Escape closes and
	returns focus to the avatar; Tab or a click outside closes. Items with an
	`href` are links; a `danger` item is set apart and marked with a symbol as
	well as colour. Picks fire `on:select` (`{ id }`); Sign out fires
	`on:signout`.
-->
<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import { Avatar, nextIndex, uid } from '$lib/ui';

	export let user: { name: string; email?: string; avatarSrc?: string };
	export let items: {
		id: string;
		label: string;
		href?: string;
		danger?: boolean;
		disabled?: boolean;
	}[] = [];
	export let signOutLabel = 'Sign out';
	/** Names the avatar button, before the person's name: "Account menu for Ada". */
	export let buttonLabel = 'Account menu for';
	export let align: 'start' | 'end' = 'end';

	const dispatch = createEventDispatcher<{ select: { id: string }; signout: void }>();
	const id = uid('user-menu');
	let open = false;
	let root: HTMLDivElement;
	let trigger: HTMLButtonElement;
	let entries: HTMLElement[] = [];
	let focused = 0;

	$: all = [
		...items,
		{ id: '__signout', label: signOutLabel, danger: true } as (typeof items)[number]
	];
	$: disabled = all.flatMap((item, i) => (item.disabled ? [i] : []));

	async function show(at: 'first' | 'last' = 'first') {
		open = true;
		await tick();
		const start = nextIndex(
			at === 'first' ? -1 : all.length,
			all.length,
			at === 'first' ? 'Home' : 'End',
			'vertical',
			disabled
		);
		focus(start ?? 0);
	}

	function hide(returnFocus = true) {
		open = false;
		if (returnFocus) trigger?.focus();
	}

	function focus(i: number) {
		focused = i;
		entries[i]?.focus();
	}

	function pick(item: (typeof all)[number]) {
		if (item.disabled) return;
		hide();
		if (item.id === '__signout') dispatch('signout');
		else dispatch('select', { id: item.id });
	}

	function onTriggerKeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			show(event.key === 'ArrowDown' ? 'first' : 'last');
		}
	}

	function onMenuKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			hide();
			return;
		}
		if (event.key === 'Tab') {
			hide(false);
			return;
		}
		const next = nextIndex(focused, all.length, event.key, 'vertical', disabled);
		if (next === null) return;
		event.preventDefault();
		focus(next);
	}

	function onWindowPointer(event: PointerEvent) {
		if (open && !root.contains(event.target as Node)) hide(false);
	}
</script>

<svelte:window on:pointerdown={onWindowPointer} />

<div class="user-menu" bind:this={root}>
	<button
		bind:this={trigger}
		type="button"
		class="user-menu__trigger"
		aria-haspopup="menu"
		aria-expanded={open}
		aria-controls={id}
		aria-label="{buttonLabel} {user.name}"
		on:click={() => (open ? hide() : show())}
		on:keydown={onTriggerKeydown}
	>
		<Avatar name={user.name} src={user.avatarSrc} size="sm" />
	</button>

	{#if open}
		<div class="user-menu__panel user-menu__panel--{align}">
			<div class="user-menu__identity">
				<Avatar name={user.name} src={user.avatarSrc} size="md" />
				<div class="user-menu__who">
					<span class="user-menu__name">{user.name}</span>
					{#if user.email}<span class="user-menu__email">{user.email}</span>{/if}
				</div>
			</div>
			<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
			<div
				class="user-menu__list"
				role="menu"
				{id}
				aria-label="{buttonLabel} {user.name}"
				tabindex="-1"
				on:keydown={onMenuKeydown}
			>
				{#each all as item, i (item.id)}
					{#if i === all.length - 1}<div class="user-menu__separator" role="separator"></div>{/if}
					<svelte:element
						this={item.href ? 'a' : 'button'}
						bind:this={entries[i]}
						href={item.href}
						type={item.href ? undefined : 'button'}
						role="menuitem"
						class="user-menu__item"
						class:user-menu__item--danger={item.danger}
						tabindex={i === focused ? 0 : -1}
						aria-disabled={item.disabled || undefined}
						on:click={() => pick(item)}
					>
						{#if item.danger}<span aria-hidden="true" class="user-menu__mark">⚠</span>{/if}
						{item.label}
					</svelte:element>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.user-menu {
		position: relative;
		display: inline-block;
	}

	.user-menu__trigger {
		display: inline-grid;
		place-items: center;
		min-width: 44px;
		min-height: 44px;
		padding: 0;
		border: 1px solid var(--color-border);
		border-radius: 50%;
		background: var(--color-background);
		cursor: pointer;
	}

	.user-menu__trigger:focus-visible,
	.user-menu__item:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.user-menu__panel {
		position: absolute;
		inset-block-start: calc(100% + 4px);
		z-index: 60;
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		min-width: 14rem;
		max-width: calc(100vw - 1rem);
		padding: var(--spacing-xs);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-background);
		box-shadow: var(--shadow-lg);
	}

	.user-menu__panel--start {
		inset-inline-start: 0;
	}

	.user-menu__panel--end {
		inset-inline-end: 0;
	}

	.user-menu__identity {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		padding: var(--spacing-sm) var(--spacing-md);
		border-block-end: 1px solid var(--color-border);
	}

	.user-menu__who {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		min-width: 0;
	}

	.user-menu__name {
		font-weight: 700;
		overflow-wrap: anywhere;
	}

	.user-menu__email {
		color: var(--color-text-secondary);
		font-size: 0.8125rem;
		overflow-wrap: anywhere;
	}

	.user-menu__list {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		padding-block-start: var(--spacing-xs);
	}

	.user-menu__separator {
		height: 1px;
		margin: var(--spacing-xs) 0;
		background: var(--color-border);
	}

	.user-menu__item {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		min-height: 44px;
		padding: var(--spacing-sm) var(--spacing-md);
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-text);
		font: inherit;
		text-align: start;
		text-decoration: none;
		cursor: pointer;
	}

	.user-menu__item:hover,
	.user-menu__item:focus {
		background: var(--color-surface-hover);
	}

	.user-menu__item--danger {
		color: var(--color-danger);
		font-weight: 600;
	}

	.user-menu__item[aria-disabled='true'] {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
