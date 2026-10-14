<!--
	IntegrationsList — one card per connected service: status badge, what it
	can access (a disclosure), and a connect / reconnect / disconnect button.
	Disconnecting asks first. The app does the connecting; listen for
	`connect`, `reconnect` and `disconnect`, and send the new status back in.
-->
<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import AlertDialog from '$lib/ui/AlertDialog.svelte';
	import Badge from '$lib/ui/Badge.svelte';
	import Button from '$lib/ui/Button.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import TextInput from '$lib/ui/TextInput.svelte';
	import {
		countConnected,
		filterIntegrations,
		integrationAction,
		integrationStatusInfo,
		sortIntegrations,
		type Integration
	} from './logic';

	export let integrations: Integration[] = [];
	/** The id of an integration whose request is in flight; its button shows a spinner. */
	export let busyId = '';
	/** Show a search box once there are at least this many integrations (0 never shows it). */
	export let searchFrom = 6;
	export let level: 2 | 3 | 4 = 2;
	export let copy: Partial<typeof DEFAULT_COPY> = {};

	const DEFAULT_COPY = {
		title: 'Integrations',
		search: 'Search integrations',
		connect: 'Connect',
		reconnect: 'Reconnect',
		disconnect: 'Disconnect',
		cancel: 'Cancel',
		permissions: 'Permissions',
		noPermissions: 'This integration asks for no access.',
		connectedCount: 'connected',
		disconnectTitle: 'Disconnect this integration?',
		disconnectBody: 'It loses access straight away. You can connect it again later.',
		emptyTitle: 'No integrations available',
		emptyBody: 'Nothing can be connected yet.',
		noMatches: 'No integrations match your search.',
		results: 'shown',
		account: 'Account'
	};

	const dispatch = createEventDispatcher<{
		connect: { id: string };
		reconnect: { id: string };
		disconnect: { id: string };
	}>();

	$: t = { ...DEFAULT_COPY, ...copy };
	let query = '';
	$: shown = sortIntegrations(filterIntegrations(integrations, query));
	$: connected = countConnected(integrations);

	let leaving: Integration | null = null;
	let confirmOpen = false;
	let heading: HTMLElement;

	function act(item: Integration) {
		const action = integrationAction(item.status);
		if (action === 'disconnect') {
			leaving = item;
			confirmOpen = true;
		} else if (action === 'connect' || action === 'reconnect') {
			dispatch(action, { id: item.id });
		}
	}

	async function confirmDisconnect() {
		if (leaving) dispatch('disconnect', { id: leaving.id });
		leaving = null;
		await tick();
		heading?.focus();
	}
</script>

<section class="integrations" aria-labelledby="integrations-title">
	<header class="integrations__head">
		<svelte:element
			this={`h${level}`}
			id="integrations-title"
			class="integrations__title"
			tabindex="-1"
			bind:this={heading}>{t.title}</svelte:element
		>
		<p class="integrations__count">{connected} / {integrations.length} {t.connectedCount}</p>
	</header>

	{#if searchFrom > 0 && integrations.length >= searchFrom}
		<TextInput label={t.search} type="search" bind:value={query} />
		<p class="sr-only" role="status">{shown.length} {t.results}</p>
	{/if}

	{#if integrations.length === 0}
		<EmptyState title={t.emptyTitle} description={t.emptyBody} icon="🔌" />
	{:else if shown.length === 0}
		<p class="integrations__none">{t.noMatches}</p>
	{:else}
		<ul class="integrations__grid">
			{#each shown as item (item.id)}
				{@const info = integrationStatusInfo(item.status)}
				{@const action = integrationAction(item.status)}
				<li class="integration">
					<div class="integration__top">
						<svelte:element this={`h${level + 1}`} class="integration__name"
							>{item.name}</svelte:element
						>
						<Badge tone={info.tone}>{info.label}</Badge>
					</div>
					<p class="integration__desc">{item.description}</p>
					{#if item.account && item.status === 'connected'}
						<p class="integration__account">{t.account}: {item.account}</p>
					{/if}
					<details class="integration__perms">
						<summary>{t.permissions} ({item.permissions.length})</summary>
						{#if item.permissions.length}
							<ul>
								{#each item.permissions as permission}<li>{permission}</li>{/each}
							</ul>
						{:else}
							<p>{t.noPermissions}</p>
						{/if}
					</details>
					{#if action}
						<div class="integration__action">
							<Button
								variant={action === 'disconnect' ? 'secondary' : 'primary'}
								loading={busyId === item.id}
								on:click={() => act(item)}
								>{action === 'disconnect'
									? t.disconnect
									: action === 'reconnect'
										? t.reconnect
										: t.connect}<span class="sr-only"> {item.name}</span></Button
							>
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>

<AlertDialog
	bind:open={confirmOpen}
	tone="danger"
	title={leaving ? `${t.disconnectTitle} (${leaving.name})` : t.disconnectTitle}
	description={t.disconnectBody}
	confirmLabel={t.disconnect}
	cancelLabel={t.cancel}
	on:confirm={confirmDisconnect}
	on:cancel={() => (leaving = null)}
/>

<style>
	.integrations {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
		min-width: 0;
	}

	.integrations__head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--spacing-sm);
	}

	.integrations__title {
		margin: 0;
	}

	.integrations__title:focus-visible {
		outline: 3px solid var(--color-primary);
		outline-offset: 2px;
	}

	.integrations__count,
	.integrations__none {
		margin: 0;
		color: var(--color-text-secondary);
		font-size: 0.9rem;
	}

	.integrations__grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 1fr));
		gap: var(--spacing-md);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.integration {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		align-content: start;
		gap: var(--spacing-sm);
		min-width: 0;
		padding: var(--spacing-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-background);
	}

	.integration__top {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-xs);
	}

	.integration__name {
		margin: 0;
		font-size: 1.05rem;
	}

	.integration__desc,
	.integration__account {
		margin: 0;
		color: var(--color-text-secondary);
		font-size: 0.9rem;
	}

	.integration__perms summary {
		min-block-size: 2.75rem;
		padding-block: var(--spacing-sm);
		cursor: pointer;
		font-size: 0.9rem;
	}

	.integration__perms summary:focus-visible {
		outline: 3px solid var(--color-primary);
		outline-offset: 2px;
	}

	.integration__perms ul {
		margin: 0;
		padding-inline-start: 1.25rem;
		font-size: 0.875rem;
	}

	.integration__perms p {
		margin: 0;
		font-size: 0.875rem;
	}
</style>
