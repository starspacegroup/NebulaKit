<!--
	TeamMembers — who is on the team and who has been asked. Each member has a
	role select (the last owner is locked, with the reason in text) and a remove
	button that asks first. "Invite people" opens a dialog with a multi-address
	tag input (a pasted list is split, bad, duplicate and already-present
	addresses are refused with a reason) and a role. Pending invites can be
	resent or revoked, and show "Expired" in words once they are old. Bind
	`members` and `invites`; every change is also an event to persist.

	<TeamMembers bind:members bind:invites currentUserId="u1" {now} />
-->
<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import AlertDialog from '$lib/ui/AlertDialog.svelte';
	import Avatar from '$lib/ui/Avatar.svelte';
	import Badge from '$lib/ui/Badge.svelte';
	import Dialog from '$lib/ui/Dialog.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import Select from '$lib/ui/Select.svelte';
	import TagInput from '$lib/ui/TagInput.svelte';
	import { uid } from '$lib/ui/logic';
	import {
		addInvites,
		canChangeRole,
		canRemoveMember,
		changeRole,
		DEFAULT_ROLES,
		inviteStatus,
		inviteSummary,
		inviteValidator,
		removeMember,
		resendInvite,
		revokeInvite,
		roleLabel,
		type RoleOption,
		type TeamInvite,
		type TeamMember
	} from './team-logic';
	import { absoluteTimeText, isoString, relativeTimeText, type DateInput } from './time-logic';

	export let members: TeamMember[] = [];
	export let invites: TeamInvite[] = [];
	export let roles: RoleOption[] = DEFAULT_ROLES;
	export let currentUserId = '';
	export let canManage = true;
	export let now: DateInput = new Date();
	export let locale = 'en-US';
	export let timeZone = 'UTC';
	/** Role pre-selected in the invite dialog. */
	export let defaultRole = 'member';
	export let maxInvites = 20;
	export let inviteExpiryDays = 14;
	/** Heading level for the section headings. */
	export let level: 2 | 3 | 4 | 5 | 6 = 3;
	export let loading = false;
	export let newId: (email: string, index: number) => string = () => uid('invite');
	export let copy = {
		members: 'Members',
		pending: 'Pending invites',
		invite: 'Invite people',
		inviteTitle: 'Invite people',
		inviteHint: 'Type or paste email addresses. Press Enter or comma after each.',
		emails: 'Email addresses',
		role: 'Role',
		roleFor: 'Role for',
		send: 'Send invites',
		cancel: 'Cancel',
		remove: 'Remove',
		resend: 'Resend',
		revoke: 'Revoke',
		expired: 'Expired',
		sent: 'Sent',
		lastOwner: 'The last owner cannot be changed or removed. Make someone else an owner first.',
		you: 'you',
		noEmails: 'Add at least one email address.',
		noMembers: 'No members yet.',
		noInvites: 'No pending invites.',
		confirmRemove: 'Remove this member?',
		confirmRemoveBody: 'They lose access straight away.',
		confirmRevoke: 'Revoke this invite?',
		confirmRevokeBody: 'The link in the email stops working.',
		loading: 'Loading team'
	};

	const dispatch = createEventDispatcher<{
		rolechange: { id: string; role: string };
		remove: { id: string };
		invite: { emails: string[]; role: string; invites: TeamInvite[] };
		resend: { id: string };
		revoke: { id: string };
	}>();

	const prefix = uid('team');
	let root: HTMLElement;
	let inviteOpen = false;
	let tags: string[] = [];
	let inviteRole = defaultRole;
	let inviteError = '';
	let announcement = '';
	let removing: TeamMember | null = null;
	let removeOpen = false;
	let revoking: TeamInvite | null = null;
	let revokeOpen = false;

	$: heading = `h${level}`;
	$: validate = inviteValidator(members, invites);
	$: stamp = isoString(now);

	function focusHeading(name: 'members' | 'pending') {
		return tick().then(() => root?.querySelector<HTMLElement>(`#${prefix}-${name}`)?.focus());
	}

	async function openInvite() {
		tags = [];
		inviteRole = defaultRole;
		inviteError = '';
		inviteOpen = true;
		await tick();
		root?.querySelector<HTMLElement>('dialog[open] input[type="text"]')?.focus();
	}

	function onInviteRole(event: Event) {
		inviteRole = (event.currentTarget as HTMLSelectElement).value;
	}

	function send() {
		if (tags.length === 0) {
			inviteError = copy.noEmails;
			return;
		}
		const emails = tags;
		const next = addInvites(invites, emails, inviteRole, stamp, newId);
		invites = next;
		inviteOpen = false;
		announcement = inviteSummary(emails.length, roleLabel(roles, inviteRole));
		dispatch('invite', {
			emails,
			role: inviteRole,
			invites: next.slice(invites.length - emails.length)
		});
		focusHeading('pending');
	}

	function setRole(member: TeamMember, event: Event) {
		const role = (event.currentTarget as HTMLSelectElement).value;
		members = changeRole(members, member.id, role);
		announcement = `${member.name} is now ${roleLabel(roles, role)}.`;
		dispatch('rolechange', { id: member.id, role });
	}

	function askRemove(member: TeamMember) {
		removing = member;
		removeOpen = true;
	}

	function confirmRemove() {
		const member = removing;
		removing = null;
		if (!member) return;
		members = removeMember(members, member.id);
		announcement = `${member.name} was removed.`;
		dispatch('remove', { id: member.id });
		focusHeading('members');
	}

	function resend(invite: TeamInvite) {
		invites = resendInvite(invites, invite.id, stamp);
		announcement = `Invite resent to ${invite.email}.`;
		dispatch('resend', { id: invite.id });
	}

	function askRevoke(invite: TeamInvite) {
		revoking = invite;
		revokeOpen = true;
	}

	function confirmRevoke() {
		const invite = revoking;
		revoking = null;
		if (!invite) return;
		invites = revokeInvite(invites, invite.id);
		announcement = `Invite to ${invite.email} was revoked.`;
		dispatch('revoke', { id: invite.id });
		focusHeading('pending');
	}
</script>

<section class="team" aria-busy={loading || undefined} bind:this={root}>
	<div class="team__bar">
		<svelte:element this={heading} id="{prefix}-members" class="team__title" tabindex="-1">
			{copy.members} <span class="team__count">({members.length})</span>
		</svelte:element>
		{#if canManage}
			<button type="button" class="team__primary" on:click={openInvite}>{copy.invite}</button>
		{/if}
	</div>

	{#if loading}
		<p role="status">{copy.loading}</p>
	{:else if members.length === 0}
		<EmptyState title={copy.noMembers} />
	{:else}
		<ul class="team__list" aria-labelledby="{prefix}-members">
			{#each members as member (member.id)}
				{@const locked = !canChangeRole(members, member.id)}
				<li class="team__row">
					<div class="team__who">
						<Avatar name={member.name} src={member.avatar} />
						<div class="team__name">
							<strong>{member.name}</strong>
							{#if member.id === currentUserId}<Badge>{copy.you}</Badge>{/if}
							<span class="team__email">{member.email}</span>
						</div>
					</div>
					<div class="team__role">
						{#if canManage}
							<label class="sr-only" for="{prefix}-role-{member.id}"
								>{copy.roleFor} {member.name}</label
							>
							<select
								id="{prefix}-role-{member.id}"
								value={member.role}
								disabled={locked}
								aria-describedby={locked ? `${prefix}-locked` : undefined}
								on:change={(e) => setRole(member, e)}
							>
								{#each roles as role (role.value)}
									<option value={role.value} selected={role.value === member.role}
										>{role.label}</option
									>
								{/each}
							</select>
						{:else}
							<span>{roleLabel(roles, member.role)}</span>
						{/if}
					</div>
					{#if canManage}
						<button
							type="button"
							class="team__btn team__btn--danger"
							disabled={!canRemoveMember(members, member.id)}
							aria-describedby={locked ? `${prefix}-locked` : undefined}
							on:click={() => askRemove(member)}
							>{copy.remove}<span class="sr-only"> {member.name}</span></button
						>
					{/if}
				</li>
			{/each}
		</ul>
		<p id="{prefix}-locked" class="sr-only">{copy.lastOwner}</p>
	{/if}

	<svelte:element this={heading} id="{prefix}-pending" class="team__title" tabindex="-1">
		{copy.pending} <span class="team__count">({invites.length})</span>
	</svelte:element>
	{#if invites.length === 0}
		<p class="team__none">{copy.noInvites}</p>
	{:else}
		<ul class="team__list" aria-labelledby="{prefix}-pending">
			{#each invites as invite (invite.id)}
				{@const status = inviteStatus(invite, now, inviteExpiryDays)}
				<li class="team__row">
					<div class="team__name">
						<strong>{invite.email}</strong>
						<span class="team__email">
							{roleLabel(roles, invite.role)} ·
							{copy.sent}
							<time
								datetime={isoString(invite.sentAt)}
								title={absoluteTimeText(invite.sentAt, { locale, timeZone })}
								>{relativeTimeText(invite.sentAt, now, { locale })}</time
							>
						</span>
					</div>
					<div>
						{#if status === 'expired'}<Badge tone="warning">{copy.expired}</Badge>{/if}
					</div>
					{#if canManage}
						<div class="team__buttons">
							<button type="button" class="team__btn" on:click={() => resend(invite)}
								>{copy.resend}<span class="sr-only"> {invite.email}</span></button
							>
							<button
								type="button"
								class="team__btn team__btn--danger"
								on:click={() => askRevoke(invite)}
								>{copy.revoke}<span class="sr-only"> {invite.email}</span></button
							>
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}

	<p class="sr-only" role="status" aria-live="polite">{announcement}</p>

	<Dialog bind:open={inviteOpen} title={copy.inviteTitle} description={copy.inviteHint}>
		<div class="team__form">
			<TagInput
				label={copy.emails}
				bind:tags
				max={maxInvites}
				{validate}
				placeholder="name@example.com"
				error={inviteError}
				on:change={() => (inviteError = '')}
			/>
			<Select
				label={copy.role}
				value={inviteRole}
				on:change={(e) => onInviteRole(e)}
				options={roles.filter((r) => r.value !== 'owner')}
			/>
		</div>
		<svelte:fragment slot="actions">
			<button type="button" class="team__btn" on:click={() => (inviteOpen = false)}
				>{copy.cancel}</button
			>
			<button type="button" class="team__primary" on:click={send}>{copy.send}</button>
		</svelte:fragment>
	</Dialog>

	<AlertDialog
		bind:open={removeOpen}
		title={copy.confirmRemove}
		description={removing ? `${removing.name} (${removing.email}). ${copy.confirmRemoveBody}` : ''}
		confirmLabel={copy.remove}
		cancelLabel={copy.cancel}
		tone="danger"
		on:confirm={confirmRemove}
		on:cancel={() => (removing = null)}
	/>
	<AlertDialog
		bind:open={revokeOpen}
		title={copy.confirmRevoke}
		description={revoking ? `${revoking.email}. ${copy.confirmRevokeBody}` : ''}
		confirmLabel={copy.revoke}
		cancelLabel={copy.cancel}
		tone="danger"
		on:confirm={confirmRevoke}
		on:cancel={() => (revoking = null)}
	/>
</section>

<style>
	.team {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
		min-width: 0;
	}

	.team__bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-sm);
	}

	.team__title {
		margin: 0;
		font-size: 1.125rem;
	}

	.team__title:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.team__count {
		color: var(--color-text-secondary);
		font-weight: 400;
	}

	.team__list {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-sm);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.team__row {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-sm);
		align-items: center;
		min-width: 0;
		padding: var(--spacing-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-background);
	}

	.team__who {
		display: flex;
		align-items: center;
		gap: var(--spacing-md);
		min-width: 0;
	}

	.team__name {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 0.125rem;
		min-width: 0;
		overflow-wrap: anywhere;
	}

	.team__email {
		color: var(--color-text-secondary);
		font-size: 0.875rem;
	}

	.team__none {
		margin: 0;
		color: var(--color-text-secondary);
	}

	.team__role select {
		width: 100%;
		min-height: 2.75rem;
	}

	.team__buttons {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-xs);
	}

	.team__form {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
	}

	.team__btn,
	.team__primary {
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

	.team__primary {
		border-color: var(--color-primary-solid);
		background: var(--color-primary-solid);
		color: var(--color-on-solid);
	}

	.team__btn--danger {
		color: var(--color-danger);
	}

	.team__btn:hover:not(:disabled) {
		background: var(--color-surface-hover);
	}

	.team__btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.team__btn:focus-visible,
	.team__primary:focus-visible,
	.team__role select:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	@media (min-width: 40rem) {
		.team__row {
			grid-template-columns: minmax(0, 2fr) minmax(8rem, 1fr) auto;
		}
	}
</style>
