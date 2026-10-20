<!--
	Renders the account modules the way a page would, with bound state and
	every event forwarded to `onEvent(name, detail)`. State that is bound
	(step, current, ...) is read back from `data-testid="state"`.
-->
<script lang="ts">
	import type { AccountWhich } from './modules-which';
	import AccountSwitcher from '$lib/modules/account/AccountSwitcher.svelte';
	import DangerZone from '$lib/modules/account/DangerZone.svelte';
	import PasswordResetFlow from '$lib/modules/account/PasswordResetFlow.svelte';
	import ProfileForm from '$lib/modules/account/ProfileForm.svelte';
	import SessionsList from '$lib/modules/account/SessionsList.svelte';
	import SignInForm from '$lib/modules/account/SignInForm.svelte';
	import SignUpForm from '$lib/modules/account/SignUpForm.svelte';
	import TwoFactorSetup from '$lib/modules/account/TwoFactorSetup.svelte';
	export let which: AccountWhich;
	export let props: Record<string, unknown> = {};
	export let step: 0 | 1 | 2 | 3 = 0;
	export let current = 'me';
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	export let onEvent: (name: string, detail: any) => void = () => {};

	const accounts = [
		{ id: 'me', name: 'Ada Lovelace', description: 'Personal' },
		{ id: 'acme', name: 'Acme Inc', description: 'Owner' },
		{ id: 'off', name: 'Offline Org', disabled: true },
		{ id: 'beta', name: 'Beta Labs' }
	];
	const h = (name: string) => (e: CustomEvent) => onEvent(name, e.detail);
</script>

{#if which === 'sign-in'}
	<SignInForm {...props} on:submit={h('submit')} on:provider={h('provider')} />
{:else if which === 'sign-up'}
	<SignUpForm {...props} on:submit={h('submit')} on:provider={h('provider')} />
{:else if which === 'reset'}
	<PasswordResetFlow
		bind:step
		{...props}
		on:request={h('request')}
		on:verify={h('verify')}
		on:resend={h('resend')}
		on:reset={h('reset')}
		on:done={h('done')}
	/>
{:else if which === 'profile'}
	<ProfileForm {...props} on:save={h('save')} on:discard={h('discard')} />
{:else if which === 'sessions'}
	<SessionsList {...props} on:revoke={h('revoke')} on:revokeAll={h('revokeAll')} />
{:else if which === 'danger'}
	<DangerZone {...props} on:delete={h('delete')} on:cancel={h('cancel')} />
{:else if which === 'two-factor'}
	<TwoFactorSetup
		{...props}
		on:verify={h('verify')}
		on:copy={h('copy')}
		on:download={h('download')}
		on:complete={h('complete')}
	/>
{:else if which === 'switcher'}
	<AccountSwitcher {accounts} bind:current {...props} on:select={h('select')} on:add={h('add')} />
	<button type="button">Elsewhere</button>
{/if}
<span data-testid="state">{JSON.stringify({ step, current })}</span>
