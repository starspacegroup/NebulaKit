<!--
	PageHeader — the top of a page: breadcrumbs, the title as a heading (its
	`level` is yours to set), a description, and action buttons. When the
	header is narrower than `collapseAt` pixels the actions fold into one
	"Actions" menu, so they never crowd the title. Actions with an `href` are
	links while shown; every pick, shown or folded, is reported with
	`on:action` carrying the action's id.
-->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { Breadcrumbs, Button, Menu, uid } from '$lib/ui';
	import { trackWidth } from './dom';
	import { actionsCollapsed } from './logic';

	export let title: string;
	/** 1 to 6: the heading level of the title. */
	export let level: 1 | 2 | 3 | 4 | 5 | 6 = 1;
	export let description = '';
	export let breadcrumbs: { label: string; href?: string }[] = [];
	export let actions: {
		id: string;
		label: string;
		href?: string;
		variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
		disabled?: boolean;
	}[] = [];
	/** The label of the menu the actions fold into. */
	export let actionsLabel = 'Actions';
	/** Below this header width in pixels the actions fold into a menu. */
	export let collapseAt = 560;

	const dispatch = createEventDispatcher<{ action: { id: string } }>();
	const id = uid('page-header');
	let width = 0;

	$: collapsed = actionsCollapsed(width, collapseAt);
	$: menuItems = actions.map((a) => ({
		id: a.id,
		label: a.label,
		disabled: a.disabled,
		danger: a.variant === 'danger'
	}));
</script>

<header class="page-header" use:trackWidth={(w) => (width = w)}>
	<div class="page-header__text">
		{#if breadcrumbs.length}<Breadcrumbs items={breadcrumbs} />{/if}
		<svelte:element this={`h${level}`} class="page-header__title" id="{id}-title"
			>{title}</svelte:element
		>
		{#if description}<p class="page-header__description">{description}</p>{/if}
	</div>
	{#if actions.length}
		<div class="page-header__actions" role="group" aria-label={actionsLabel}>
			{#if collapsed}
				<Menu
					label={actionsLabel}
					items={menuItems}
					align="end"
					on:select={(e) => dispatch('action', { id: e.detail.id })}
				/>
			{:else}
				{#each actions as action (action.id)}
					<Button
						variant={action.variant ?? 'secondary'}
						href={action.href}
						disabled={action.disabled}
						on:click={() => dispatch('action', { id: action.id })}>{action.label}</Button
					>
				{/each}
			{/if}
		</div>
	{/if}
</header>

<style>
	.page-header {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--spacing-md);
		min-width: 0;
		padding-block-end: var(--spacing-md);
		border-block-end: 1px solid var(--color-border);
	}

	.page-header__text {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		flex: 1 1 16rem;
		gap: var(--spacing-xs);
		min-width: 0;
	}

	.page-header__title {
		margin: 0;
		font-size: clamp(1.375rem, 4vw, 1.875rem);
		line-height: 1.2;
		overflow-wrap: anywhere;
	}

	.page-header__description {
		max-width: 65ch;
		margin: 0;
		color: var(--color-text-secondary);
	}

	.page-header__actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-sm);
		min-width: 0;
	}

	.page-header__actions :global(.btn),
	.page-header__actions :global(.menu__trigger) {
		min-height: 44px;
	}
</style>
