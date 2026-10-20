<!-- /modules demos: Account. Fake local data only; nothing here touches the network. -->
<script lang="ts">
	import {
		AccountSwitcher,
		DangerZone,
		FormErrorSummary,
		PasswordResetFlow,
		PasswordStrength,
		ProfileForm,
		SessionsList,
		SignInForm,
		SignUpForm,
		TwoFactorSetup,
		type AccountSession,
		type FieldErrors,
		type ResetStep
	} from '$lib/modules/account';
	import { Alert } from '$lib/ui';
	import ModuleItem from '../ModuleItem.svelte';

	const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
	const NOW = Date.UTC(2026, 5, 15, 12, 0, 0);

	// Sign in
	let signInBusy = false;
	let signInError = '';
	let signInMessage = '';
	async function signIn(detail: { email: string; password: string }) {
		signInBusy = true;
		signInError = '';
		signInMessage = '';
		await wait(800);
		signInBusy = false;
		if (detail.password === 'wrong-password') signInError = 'Wrong email or password.';
		else signInMessage = `Signed in as ${detail.email} (demo only).`;
	}

	// Sign up
	let signUpBusy = false;
	let signUpErrors: FieldErrors = {};
	let signUpMessage = '';
	async function signUp(detail: { name: string; email: string }) {
		signUpBusy = true;
		signUpErrors = {};
		signUpMessage = '';
		await wait(800);
		signUpBusy = false;
		if (detail.email === 'taken@example.com')
			signUpErrors = { email: 'That email is already registered.' };
		else signUpMessage = `Welcome, ${detail.name} (demo only).`;
	}

	// Strength + summary
	let demoPassword = '';
	let demoErrors: FieldErrors = {
		email: 'Enter your email address.',
		password: 'Use at least 8 characters.'
	};

	// Reset
	let resetStep: ResetStep = 0;
	let resetBusy = false;
	let resetError = '';
	async function checkCode(detail: { code: string }) {
		resetError = '';
		if (detail.code === '000000') resetError = 'That code is wrong or has expired. Try 123456.';
	}

	// Profile
	let profile = { name: 'Ada Lovelace', email: 'ada@example.com', bio: 'Wrote the first program.' };
	let profileBusy = false;
	let profileSaved = false;
	async function saveProfile(detail: { values: { name: string; email: string; bio: string } }) {
		profileBusy = true;
		profileSaved = false;
		await wait(700);
		profile = { ...detail.values };
		profileBusy = false;
		profileSaved = true;
	}

	// Sessions
	let sessions: AccountSession[] = [
		{
			id: 's1',
			device: 'Firefox on Linux',
			location: 'Phoenix, US',
			lastActive: NOW - 20_000,
			current: true
		},
		{
			id: 's2',
			device: 'Safari on iPhone',
			location: 'Portland, US',
			lastActive: NOW - 3 * 3600_000
		},
		{
			id: 's3',
			device: 'Chrome on Windows',
			location: 'Boston, US',
			lastActive: NOW - 26 * 3600_000
		},
		{
			id: 's4',
			device: 'Edge on Windows',
			location: 'Lewiston, US',
			lastActive: NOW - 20 * 86400_000
		}
	];
	let revoking: string[] = [];
	async function revoke(ids: string[]) {
		revoking = ids;
		await wait(600);
		sessions = sessions.filter((s) => !ids.includes(s.id));
		revoking = [];
	}

	// Danger zone
	let deleted = false;

	// Two-factor
	let tfaVerified = false;
	let tfaError = '';
	let tfaDone = false;
	const recoveryCodes = [
		'k3m9d-x2p7q',
		'a8z4n-w6t5r',
		'h7c2v-b9s3y',
		'e5g8j-m4u6f',
		'q2w9x-d7k3n',
		'r6t4y-p8l5z'
	];
	function tfaVerify(detail: { code: string }) {
		tfaError = '';
		if (detail.code === '123456') tfaVerified = true;
		else tfaError = 'That code did not work. Try 123456.';
	}

	// Switcher
	const accounts = [
		{ id: 'me', name: 'Ada Lovelace', description: 'Personal' },
		{ id: 'acme', name: 'Acme Inc', description: 'Owner' },
		{ id: 'beta', name: 'Beta Labs', description: 'Member' },
		{ id: 'old', name: 'Old Org', description: 'Suspended', disabled: true }
	];
	let currentAccount = 'me';
</script>

<ModuleItem id="sign-in-form">
	<SignInForm
		providers={[
			{ id: 'github', label: 'Continue with GitHub' },
			{ id: 'google', label: 'Continue with Google' }
		]}
		loading={signInBusy}
		error={signInError}
		forgotHref="#password-reset-flow"
		signUpHref="#sign-up-form"
		on:submit={(e) => signIn(e.detail)}
		on:provider={(e) => (signInMessage = `Would start ${e.detail.id} sign-in (demo only).`)}
	/>
	{#if signInMessage}<Alert tone="success">{signInMessage}</Alert>{/if}
	<p class="hint">Try the password <code>wrong-password</code> to see the error state.</p>
</ModuleItem>

<ModuleItem id="sign-up-form">
	<SignUpForm
		loading={signUpBusy}
		errors={signUpErrors}
		signInHref="#sign-in-form"
		on:submit={(e) => signUp(e.detail)}
	>
		<span slot="terms"
			>I agree to the <a href="#sign-up-form">terms</a> and
			<a href="#sign-up-form">privacy policy</a></span
		>
	</SignUpForm>
	{#if signUpMessage}<Alert tone="success">{signUpMessage}</Alert>{/if}
	<p class="hint">Use <code>taken@example.com</code> to see a server field error.</p>
</ModuleItem>

<ModuleItem id="password-strength">
	<label class="field">
		Try a password
		<input
			type="text"
			bind:value={demoPassword}
			autocomplete="off"
			aria-describedby="demo-strength"
		/>
	</label>
	<PasswordStrength id="demo-strength" password={demoPassword} />
</ModuleItem>

<ModuleItem id="form-error-summary">
	<FormErrorSummary
		errors={demoErrors}
		fields={[
			{ name: 'email', label: 'Email', id: 'demo-summary-email' },
			{ name: 'password', label: 'Password', id: 'demo-summary-password' }
		]}
	/>
	<div class="fields">
		<label class="field">Email <input id="demo-summary-email" type="email" /></label>
		<label class="field">Password <input id="demo-summary-password" type="password" /></label>
	</div>
	<button type="button" class="plain" on:click={() => (demoErrors = {})}>Clear the errors</button>
</ModuleItem>

<ModuleItem id="password-reset-flow">
	<PasswordResetFlow
		bind:step={resetStep}
		loading={resetBusy}
		error={resetError}
		resendSeconds={20}
		on:request={() => (resetError = '')}
		on:verify={(e) => checkCode(e.detail)}
		on:done={() => (resetStep = 0)}
	/>
	<p class="hint">
		Any email works. In a real app you would hold the step until the server answers (<code
			>autoAdvance=false</code
		>).
	</p>
</ModuleItem>

<ModuleItem id="profile-form">
	<ProfileForm
		initial={profile}
		saving={profileBusy}
		saved={profileSaved}
		on:save={(e) => saveProfile(e.detail)}
		on:discard={() => (profileSaved = false)}
	/>
</ModuleItem>

<ModuleItem id="sessions-list">
	<SessionsList
		{sessions}
		now={NOW}
		{revoking}
		on:revoke={(e) => revoke([e.detail.id])}
		on:revokeAll={(e) => revoke(e.detail.ids)}
	/>
</ModuleItem>

<ModuleItem id="danger-zone">
	{#if deleted}
		<Alert tone="success" title="Account deleted (demo)">Nothing was deleted. This is a demo.</Alert
		>
		<button type="button" class="plain" on:click={() => (deleted = false)}>Reset the demo</button>
	{:else}
		<DangerZone confirmPhrase="DELETE" on:delete={() => (deleted = true)} />
	{/if}
</ModuleItem>

<ModuleItem id="two-factor-setup">
	<TwoFactorSetup
		secret="JBSWY3DPEHPK3PXP"
		{recoveryCodes}
		appName="NebulaKit"
		verified={tfaVerified}
		error={tfaError}
		on:verify={(e) => tfaVerify(e.detail)}
		on:complete={() => (tfaDone = true)}
	/>
	{#if tfaDone}<Alert tone="success">Setup complete (demo only).</Alert>{/if}
</ModuleItem>

<ModuleItem id="account-switcher">
	<AccountSwitcher {accounts} bind:current={currentAccount} addLabel="Add account" />
	<p class="hint">
		Current account: <strong>{accounts.find((a) => a.id === currentAccount)?.name}</strong>
	</p>
</ModuleItem>

<style>
	.hint {
		margin: var(--spacing-sm) 0 0;
		color: var(--color-text-secondary);
		font-size: 0.875rem;
	}

	.field {
		display: grid;
		gap: var(--spacing-xs);
		font-size: 0.9rem;
		font-weight: 600;
	}

	.field input {
		min-block-size: 44px;
		padding-inline: var(--spacing-sm);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-background);
		color: var(--color-text);
		font: inherit;
		font-weight: 400;
	}

	.fields {
		display: grid;
		gap: var(--spacing-sm);
		margin-block: var(--spacing-md);
	}

	.plain {
		min-block-size: 44px;
		padding-inline: var(--spacing-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-background);
		color: var(--color-text);
		font: inherit;
		cursor: pointer;
	}
</style>
