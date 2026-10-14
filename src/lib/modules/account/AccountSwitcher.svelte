<!--
	AccountSwitcher — a menu of accounts or organisations with the current one
	marked. The ARIA menu-button pattern with radio items: Enter, Space or the
	arrow keys open it on the current account; arrows, Home and End move
	(skipping disabled ones), a letter jumps to the next account starting with
	it, Enter or Space picks, Escape closes and returns focus to the button,
	Tab closes. The current account says so in words ("current") as well as with
	a check mark. Bind `current` or listen for `select` with { id }.
	An optional "add account" row emits `add`.
-->
<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import { Avatar, nextIndex, uid } from '$lib/ui';
	import { accountByInitial, currentIndex, disabledIndexes, type SwitcherAccount } from './logic';

	export let accounts: SwitcherAccount[] = [];
	export let current = '';
	export let label = 'Switch account';
	export let align: 'start' | 'end' = 'start';
	/** Text for an extra last row such as "Add account"; empty for none. */
	export let addLabel = '';
	export let currentText = 'current';

	const dispatch = createEventDispatcher<{ select: { id: string }; add: void }>();
	const id = uid('account-switcher');

	let open = false;
	let root: HTMLDivElement;
	let trigger: HTMLButtonElement;
	let entries: HTMLButtonElement[] = [];
	let focused = 0;

	$: active = accounts.find((a) => a.id === current) ?? accounts[0];
	$: count = accounts.length + (addLabel ? 1 : 0);
	$: disabled = disabledIndexes(accounts);

	async function show(at: 'current' | 'first' | 'last' = 'current') {
		open = true;
		await tick();
		const start =
			at === 'current'
				? currentIndex(accounts, current)
				: (nextIndex(
						at === 'first' ? -1 : count,
						count,
						at === 'first' ? 'Home' : 'End',
						'vertical',
						disabled
					) ?? 0);
		focus(start);
	}

	function hide(returnFocus = true) {
		open = false;
		if (returnFocus) trigger?.focus();
	}

	function focus(i: number) {
		focused = i;
		entries[i]?.focus();
	}

	function pick(account: SwitcherAccount) {
		if (account.disabled) return;
		if (account.id !== current) {
			current = account.id;
			dispatch('select', { id: account.id });
		}
		hide();
	}

	function add() {
		hide();
		dispatch('add');
	}

	function onTriggerKeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			show(event.key === 'ArrowDown' ? 'current' : 'last');
		}
	}

	function onMenuKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			hide();
			return;
		}
		if (event.key === 'Tab') {
			hide(false);
			return;
		}
		const next = nextIndex(focused, count, event.key, 'vertical', disabled);
		if (next !== null) {
			event.preventDefault();
			focus(next);
			return;
		}
		if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
			const jump = accountByInitial(accounts, focused < accounts.length ? focused : -1, event.key);
			if (jump !== null) {
				event.preventDefault();
				focus(jump);
			}
		}
	}

	function onWindowPointer(event: PointerEvent) {
		if (open && !root.contains(event.target as Node)) hide(false);
	}
</script>

<svelte:window on:pointerdown={onWindowPointer} />

<div class="switcher" bind:this={root}>
	<button
		bind:this={trigger}
		type="button"
		class="switcher__trigger"
		aria-haspopup="menu"
		aria-expanded={open}
		aria-controls={id}
		on:click={() => (open ? hide() : show())}
		on:keydown={onTriggerKeydown}
	>
		{#if active}
			<span aria-hidden="true"><Avatar name={active.name} src={active.avatarUrl} size="sm" /></span>
			<span class="switcher__text">
				<span class="switcher__name">{active.name}</span>
				<span class="sr-only">{label}</span>
			</span>
		{:else}
			<span class="switcher__text">{label}</span>
		{/if}
		<span aria-hidden="true">▾</span>
	</button>

	{#if open}
		<div
			{id}
			class="switcher__list switcher__list--{align}"
			role="menu"
			aria-label={label}
			tabindex="-1"
			on:keydown={onMenuKeydown}
		>
			{#each accounts as account, i (account.id)}
				<button
					bind:this={entries[i]}
					type="button"
					role="menuitemradio"
					class="switcher__item"
					aria-checked={account.id === current}
					aria-disabled={account.disabled || undefined}
					tabindex={i === focused ? 0 : -1}
					on:click={() => pick(account)}
				>
					<span aria-hidden="true"
						><Avatar name={account.name} src={account.avatarUrl} size="sm" /></span
					>
					<span class="switcher__text">
						<span class="switcher__name">{account.name}</span>
						{#if account.description}<span class="switcher__desc">{account.description}</span>{/if}
					</span>
					{#if account.id === current}
						<span class="switcher__mark" aria-hidden="true">✓</span>
						<span class="sr-only">({currentText})</span>
					{/if}
				</button>
			{/each}
			{#if addLabel}
				<div class="switcher__separator" role="separator"></div>
				<button
					bind:this={entries[accounts.length]}
					type="button"
					role="menuitem"
					class="switcher__item"
					tabindex={focused === accounts.length ? 0 : -1}
					on:click={add}
				>
					<span class="switcher__plus" aria-hidden="true">+</span>
					<span class="switcher__text"><span class="switcher__name">{addLabel}</span></span>
				</button>
			{/if}
		</div>
	{/if}
</div>

<style>
	.switcher {
		position: relative;
		display: inline-block;
		max-inline-size: 100%;
	}

	.switcher__trigger,
	.switcher__item {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		min-block-size: 44px;
		inline-size: 100%;
		padding: var(--spacing-sm) var(--spacing-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-text);
		font: inherit;
		text-align: start;
		cursor: pointer;
	}

	.switcher__item {
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
	}

	.switcher__trigger:hover,
	.switcher__item:hover,
	.switcher__item:focus {
		background: var(--color-surface-hover);
	}

	.switcher__trigger:focus-visible,
	.switcher__item:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: -2px;
	}

	.switcher__text {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		flex: 1;
		min-width: 0;
	}

	.switcher__name {
		overflow: hidden;
		font-weight: 600;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.switcher__desc {
		overflow: hidden;
		color: var(--color-text-secondary);
		font-size: 0.8125rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.switcher__mark {
		color: var(--color-success);
		font-weight: 700;
	}

	.switcher__plus {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		place-items: center;
		inline-size: 2rem;
		font-size: 1.25rem;
	}

	.switcher__list {
		position: absolute;
		z-index: 60;
		inset-block-start: calc(100% + 4px);
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		min-inline-size: min(18rem, calc(100vw - 2rem));
		padding: var(--spacing-xs);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-background);
		box-shadow: var(--shadow-lg);
	}

	.switcher__list--start {
		inset-inline-start: 0;
	}

	.switcher__list--end {
		inset-inline-end: 0;
	}

	.switcher__item[aria-disabled='true'] {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.switcher__separator {
		margin-block: var(--spacing-xs);
		border-block-start: 1px solid var(--color-border);
	}

	@media (forced-colors: active) {
		.switcher__item[aria-checked='true'] {
			outline: 1px solid CanvasText;
		}
	}
</style>
