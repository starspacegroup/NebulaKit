<!--
	SessionsList — where the account is signed in. The current session comes
	first with a "Current session" badge (a word, not just a colour); the rest
	are newest first, each with a Revoke button named for its device. "Sign out
	of all other sessions" asks for confirmation in an alert dialog. "Last
	active" is worked out from `now`, which you pass in, so it renders the same
	on server and client and can be tested.
	Events: `revoke` with { id }, `revokeAll` with { ids }.
	Put ids that are being revoked in `revoking` to show them as busy.
-->
<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import { Alert, AlertDialog, Badge, Button, Skeleton, uid } from '$lib/ui';
	import {
		otherSessions,
		relativeTime,
		sortSessions,
		fillMessage,
		isoTime,
		type AccountSession
	} from './logic';

	export let sessions: AccountSession[] = [];
	export let title = 'Active sessions';
	export let description = 'Devices where you are signed in.';
	export let level: 2 | 3 | 4 = 2;
	/** The time to measure "last active" from, in ms since epoch. */
	export let now: number = Date.now();
	export let locale = 'en';
	export let revoking: string[] = [];
	export let loading = false;
	export let error = '';

	export let currentLabel = 'Current session';
	export let lastActiveLabel = 'Last active';
	export let justNowLabel = 'Just now';
	export let revokeLabel = 'Revoke';
	export let revokeAria = 'Revoke session on {device}';
	export let revokingLabel = 'Revoking';
	export let revokeAllLabel = 'Sign out of all other sessions';
	export let confirmTitle = 'Sign out of all other sessions?';
	export let confirmText = 'This signs out {count} other {noun}. You stay signed in here.';
	export let confirmLabel = 'Sign out other sessions';
	export let sessionNoun = 'session';
	export let sessionsNoun = 'sessions';
	export let cancelLabel = 'Cancel';
	export let emptyText = 'No other active sessions.';
	export let loadingLabel = 'Loading sessions';
	export let revokedText = '{device} was signed out.';

	const dispatch = createEventDispatcher<{
		revoke: { id: string };
		revokeAll: { ids: string[] };
	}>();
	const id = uid('sessions');

	let confirming = false;
	let heading: HTMLElement;
	let announcement = '';
	let pending: { id: string; device: string } | null = null;

	$: ordered = sortSessions(sessions);
	$: others = otherSessions(sessions);
	$: noun = others.length === 1 ? sessionNoun : sessionsNoun;
	$: settle(sessions);

	// After a revoked session leaves the list, say so and put focus somewhere real.
	function settle(list: AccountSession[]) {
		if (pending && !list.some((s) => s.id === pending?.id)) {
			announcement = fillMessage(revokedText, { device: pending.device });
			pending = null;
			tick().then(() => heading?.focus());
		}
	}

	function revoke(session: AccountSession) {
		if (revoking.includes(session.id)) return;
		pending = { id: session.id, device: session.device };
		dispatch('revoke', { id: session.id });
	}

	function revokeAll() {
		dispatch('revokeAll', { ids: others.map((s) => s.id) });
	}
</script>

<section class="sessions" aria-labelledby="{id}-title" aria-busy={loading}>
	<header>
		<div>
			<svelte:element this={`h${level}`} id="{id}-title" tabindex="-1" bind:this={heading}
				>{title}</svelte:element
			>
			{#if description}<p class="muted">{description}</p>{/if}
		</div>
		{#if others.length > 0}
			<Button variant="danger" on:click={() => (confirming = true)}>{revokeAllLabel}</Button>
		{/if}
	</header>

	{#if error}<Alert tone="danger">{error}</Alert>{/if}

	{#if loading}
		<div class="loading" role="status">
			<span class="sr-only">{loadingLabel}</span>
			<Skeleton height="4rem" shape="block" />
			<Skeleton height="4rem" shape="block" />
		</div>
	{:else}
		<ul class="list">
			{#each ordered as session (session.id)}
				<li class="session" class:session--current={session.current}>
					<div class="session__info">
						<p class="session__device">
							{session.device}
							{#if session.current}<Badge tone="success">{currentLabel}</Badge>{/if}
						</p>
						<p class="session__meta">
							{#if session.location}<span>{session.location}</span>{/if}
							<span>
								{lastActiveLabel}:
								<time datetime={isoTime(session.lastActive)}>
									{relativeTime(session.lastActive, now, { locale, justNow: justNowLabel })}
								</time>
							</span>
						</p>
					</div>
					{#if !session.current}
						<Button
							variant="secondary"
							loading={revoking.includes(session.id)}
							aria-label={fillMessage(revokeAria, { device: session.device })}
							on:click={() => revoke(session)}
						>
							{revoking.includes(session.id) ? revokingLabel : revokeLabel}
						</Button>
					{/if}
				</li>
			{/each}
		</ul>
		{#if others.length === 0}<p class="muted">{emptyText}</p>{/if}
	{/if}

	<p class="sr-only" role="status">{announcement}</p>

	<AlertDialog
		bind:open={confirming}
		title={confirmTitle}
		description={fillMessage(confirmText, { count: others.length, noun })}
		{confirmLabel}
		{cancelLabel}
		tone="danger"
		on:confirm={revokeAll}
	/>
</section>

<style>
	.sessions {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
		min-width: 0;
		color: var(--color-text);
	}

	header {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--spacing-md);
	}

	h2,
	h3,
	h4 {
		margin: 0;
		font-size: 1.25rem;
	}

	h2:focus-visible,
	h3:focus-visible,
	h4:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 4px;
	}

	.muted {
		margin: var(--spacing-xs) 0 0;
		color: var(--color-text-secondary);
	}

	.list {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-sm);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.loading {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-sm);
	}

	.session {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-sm) var(--spacing-md);
		min-width: 0;
		padding: var(--spacing-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-background);
	}

	.session--current {
		border-color: var(--color-success);
	}

	.session__info {
		flex: 1 1 14rem;
		min-width: 0;
	}

	.session__device {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--spacing-sm);
		margin: 0;
		font-weight: 600;
		overflow-wrap: anywhere;
	}

	.session__meta {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-xs) var(--spacing-md);
		margin: var(--spacing-xs) 0 0;
		color: var(--color-text-secondary);
		font-size: 0.875rem;
	}

	/* Digits that change keep their width, so a live count or time never nudges what is beside it. */
	time {
		font-variant-numeric: tabular-nums;
	}
</style>
