<!--
	WebhooksManager — a list of webhook endpoints, an add / edit dialog with URL
	validation and an event multi-select, an enable switch per endpoint, and each
	endpoint's recent deliveries. It sends nothing itself: `save`, `toggle` and
	`remove` events tell the app what to do.
-->
<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import AlertDialog from '$lib/ui/AlertDialog.svelte';
	import Badge from '$lib/ui/Badge.svelte';
	import Button from '$lib/ui/Button.svelte';
	import Checkbox from '$lib/ui/Checkbox.svelte';
	import Dialog from '$lib/ui/Dialog.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import Switch from '$lib/ui/Switch.svelte';
	import TextInput from '$lib/ui/TextInput.svelte';
	import {
		WEBHOOK_MESSAGES,
		deliveryStatus,
		endpointHealth,
		formatSettingsDateTime,
		sortDeliveries,
		toggleEvent,
		validateWebhook,
		type Webhook,
		type WebhookErrors
	} from './logic';

	export let endpoints: Webhook[] = [];
	export let events: { value: string; label: string }[] = [];
	/** Let http:// through for localhost, for development. */
	export let allowLocalHttp = false;
	export let busy = false;
	export let locale = 'en';
	export let timeZone = 'UTC';
	export let level: 2 | 3 | 4 = 2;
	export let copy: Partial<typeof DEFAULT_COPY> = {};

	const DEFAULT_COPY = {
		title: 'Webhooks',
		add: 'Add endpoint',
		addTitle: 'Add a webhook endpoint',
		editTitle: 'Edit webhook endpoint',
		description: 'We send a signed POST request to this URL when the events you pick happen.',
		url: 'Endpoint URL',
		urlHint: 'Must start with https://',
		events: 'Events',
		save: 'Save endpoint',
		cancel: 'Cancel',
		edit: 'Edit',
		remove: 'Delete',
		removeTitle: 'Delete this endpoint?',
		removeBody: 'Deliveries stop straight away. This cannot be undone.',
		removeConfirm: 'Delete endpoint',
		enabled: 'Enabled',
		errorsTitle: 'Fix these before saving:',
		emptyTitle: 'No webhook endpoints',
		emptyBody: 'Add an endpoint to be told when things happen.',
		deliveries: 'Recent deliveries',
		noDeliveries: 'No deliveries yet.',
		list: 'Webhook endpoints',
		healthy: 'Healthy',
		degraded: 'Some failures',
		failing: 'Failing',
		noData: 'No data'
	};

	const dispatch = createEventDispatcher<{
		save: { id: string | null; url: string; events: string[]; enabled: boolean };
		toggle: { id: string; enabled: boolean };
		remove: { id: string };
	}>();

	$: t = { ...DEFAULT_COPY, ...copy };
	$: available = events.map((e) => e.value);
	$: healthLabels = {
		healthy: t.healthy,
		degraded: t.degraded,
		failing: t.failing,
		'no-data': t.noData
	};
	$: labels = Object.fromEntries(events.map((e) => [e.value, e.label]));

	let formOpen = false;
	let editing: Webhook | null = null;
	let url = '';
	let picked: string[] = [];
	let submitted = false;
	let errors: WebhookErrors = {};
	let removing: Webhook | null = null;
	let removeOpen = false;
	let heading: HTMLElement;

	// Revalidate first: Svelte 4 cannot see that revalidate() assigns `errors`, so it
	// orders these two by source. errorList must come after the call it reads from.
	$: if (submitted) revalidate(url, picked);
	$: errorList = [errors.url, errors.events].filter(Boolean) as string[];

	function revalidate(u: string, p: string[]) {
		errors = validateWebhook({ url: u, events: p }, { allowLocalHttp }, WEBHOOK_MESSAGES);
	}

	function openForm(endpoint: Webhook | null) {
		editing = endpoint;
		url = endpoint?.url ?? '';
		picked = endpoint ? [...endpoint.events] : [];
		submitted = false;
		errors = {};
		formOpen = true;
	}

	function submit() {
		submitted = true;
		revalidate(url, picked);
		if (errors.url || errors.events) return;
		dispatch('save', {
			id: editing?.id ?? null,
			url: url.trim(),
			events: picked,
			enabled: editing?.enabled ?? true
		});
		formOpen = false;
	}

	function onToggle(endpoint: Webhook, event: Event) {
		dispatch('toggle', { id: endpoint.id, enabled: (event.target as HTMLInputElement).checked });
	}

	function askRemove(endpoint: Webhook) {
		removing = endpoint;
		removeOpen = true;
	}

	async function confirmRemove() {
		if (removing) dispatch('remove', { id: removing.id });
		removing = null;
		await tick();
		heading?.focus();
	}

	function healthTone(h: ReturnType<typeof endpointHealth>) {
		return (
			{ healthy: 'success', degraded: 'warning', failing: 'danger', 'no-data': 'neutral' } as const
		)[h];
	}
</script>

<section class="hooks" aria-labelledby="hooks-title">
	<header class="hooks__head">
		<svelte:element
			this={`h${level}`}
			id="hooks-title"
			class="hooks__title"
			tabindex="-1"
			bind:this={heading}>{t.title}</svelte:element
		>
		<Button on:click={() => openForm(null)} disabled={busy}>{t.add}</Button>
	</header>

	{#if endpoints.length === 0}
		<EmptyState title={t.emptyTitle} description={t.emptyBody} icon="🔔" />
	{:else}
		<ul class="hooks__list" aria-label={t.list}>
			{#each endpoints as endpoint (endpoint.id)}
				{@const health = endpointHealth(endpoint.deliveries)}
				{@const recent = sortDeliveries(endpoint.deliveries).slice(0, 5)}
				<li class="hook">
					<div class="hook__top">
						<div class="hook__main">
							<p class="hook__url">{endpoint.url}</p>
							<p class="hook__events">{endpoint.events.map((v) => labels[v] ?? v).join(', ')}</p>
						</div>
						<Badge tone={healthTone(health)}>{healthLabels[health]}</Badge>
					</div>
					<div class="hook__actions">
						<Switch
							label="{t.enabled}: {endpoint.url}"
							checked={endpoint.enabled}
							disabled={busy}
							on:change={(e) => onToggle(endpoint, e)}
						/>
						<span class="hook__buttons">
							<Button
								variant="secondary"
								size="sm"
								on:click={() => openForm(endpoint)}
								disabled={busy}>{t.edit}<span class="sr-only"> {endpoint.url}</span></Button
							>
							<Button
								variant="danger"
								size="sm"
								on:click={() => askRemove(endpoint)}
								disabled={busy}>{t.remove}<span class="sr-only"> {endpoint.url}</span></Button
							>
						</span>
					</div>
					<details class="hook__deliveries">
						<summary>{t.deliveries} ({endpoint.deliveries.length})</summary>
						{#if recent.length === 0}
							<p class="hook__none">{t.noDeliveries}</p>
						{:else}
							<ul class="deliveries">
								{#each recent as d (d.id)}
									{@const s = deliveryStatus(d.status)}
									<li>
										<Badge tone={s.tone}>{s.label}{d.status ? ` ${d.status}` : ''}</Badge>
										<span class="deliveries__event">{labels[d.event] ?? d.event}</span>
										<time datetime={d.at}>{formatSettingsDateTime(d.at, locale, timeZone)}</time>
									</li>
								{/each}
							</ul>
						{/if}
					</details>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<Dialog bind:open={formOpen} title={editing ? t.editTitle : t.addTitle} description={t.description}>
	<form class="form" on:submit|preventDefault={submit} novalidate>
		{#if submitted && errorList.length}
			<div class="form__errors" role="alert">
				<p>{t.errorsTitle}</p>
				<ul>
					{#each errorList as message}<li>{message}</li>{/each}
				</ul>
			</div>
		{/if}
		<TextInput
			label={t.url}
			type="url"
			hint={t.urlHint}
			bind:value={url}
			error={errors.url ?? ''}
			required
		/>
		<fieldset
			class="form__events"
			aria-describedby={errors.events ? 'hook-events-error' : undefined}
		>
			<legend>{t.events}</legend>
			{#each events as event (event.value)}
				<Checkbox
					label={event.label}
					value={event.value}
					checked={picked.includes(event.value)}
					on:change={() => (picked = toggleEvent(picked, event.value, available))}
				/>
			{/each}
			{#if errors.events}<p id="hook-events-error" class="form__error">{errors.events}</p>{/if}
		</fieldset>
		<div class="form__actions">
			<Button variant="secondary" on:click={() => (formOpen = false)}>{t.cancel}</Button>
			<Button type="submit" loading={busy}>{t.save}</Button>
		</div>
	</form>
</Dialog>

<AlertDialog
	bind:open={removeOpen}
	tone="danger"
	title={removing ? `${t.removeTitle} (${removing.url})` : t.removeTitle}
	description={t.removeBody}
	confirmLabel={t.removeConfirm}
	cancelLabel={t.cancel}
	on:confirm={confirmRemove}
	on:cancel={() => (removing = null)}
/>

<style>
	.hooks {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
		min-width: 0;
	}

	.hooks__head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-sm);
	}

	.hooks__title {
		margin: 0;
	}

	.hooks__title:focus-visible {
		outline: 3px solid var(--color-primary);
		outline-offset: 2px;
	}

	.hooks__list,
	.deliveries {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-sm);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.hook {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-sm);
		min-width: 0;
		padding: var(--spacing-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-background);
	}

	.hook__top {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--spacing-sm);
	}

	.hook__main {
		min-width: 0;
		flex: 1 1 14rem;
	}

	.hook__main > * {
		margin: 0;
	}

	.hook__url {
		font-family: var(--font-mono);
		font-size: 0.9rem;
		font-weight: 600;
		overflow-wrap: anywhere;
	}

	.hook__events,
	.hook__none {
		color: var(--color-text-secondary);
		font-size: 0.85rem;
	}

	/* The switch label carries the endpoint URL, which has no break points. */
	.hook__actions :global(.switch) {
		max-width: 100%;
		min-width: 0;
	}

	.hook__actions :global(.switch > span:last-child) {
		min-width: 0;
		overflow-wrap: anywhere;
	}

	.hook__actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-sm);
	}

	.hook__buttons {
		display: inline-flex;
		flex-wrap: wrap;
		gap: var(--spacing-xs);
	}

	.hook__deliveries summary {
		min-block-size: 2.75rem;
		padding-block: var(--spacing-sm);
		cursor: pointer;
	}

	.hook__deliveries summary:focus-visible {
		outline: 3px solid var(--color-primary);
		outline-offset: 2px;
	}

	.deliveries li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--spacing-sm);
		font-size: 0.85rem;
	}

	.deliveries__event {
		font-weight: 600;
	}

	.deliveries time {
		color: var(--color-text-secondary);
	}

	.form {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
	}

	.form__errors {
		padding: var(--spacing-sm) var(--spacing-md);
		border: 1px solid var(--color-error);
		border-radius: var(--radius-md);
		color: var(--color-error);
	}

	.form__errors p {
		margin: 0 0 var(--spacing-xs);
		font-weight: 600;
	}

	.form__errors ul {
		margin: 0;
		padding-inline-start: 1.25rem;
	}

	.form__events {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-sm);
		min-width: 0;
		margin: 0;
		padding: 0;
		border: 0;
	}

	.form__events legend {
		margin-block-end: var(--spacing-xs);
		padding: 0;
		font-weight: 600;
	}

	.form__error {
		margin: 0;
		color: var(--color-error);
		font-size: 0.9rem;
	}

	.form__error::before {
		content: '\26A0\00a0';
	}

	.form__actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-sm);
		justify-content: flex-end;
	}

	/* Digits that change keep their width, so a live count or time never nudges what is beside it. */
	time {
		font-variant-numeric: tabular-nums;
	}
</style>
