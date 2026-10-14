<!--
	PasswordResetFlow — three steps: ask for a reset email, enter the code that
	arrived (InputOTP), choose a new password; then a done screen. A Stepper
	shows where you are, focus moves to the new step's heading each time, and
	"Resend code" counts down before it can be used again.
	Your server does the work: listen for `request`, `verify`, `resend` and
	`reset`, and set `error` when something fails. By default the flow advances
	on its own after it emits; set `autoAdvance={false}` and bind `step` to
	move it yourself once the server has answered.
	`now` is a function so a countdown can be tested without waiting.
-->
<script lang="ts">
	import { createEventDispatcher, onDestroy, tick } from 'svelte';
	import { Alert, Button, Checkbox, InputOTP, Stepper, TextInput, uid } from '$lib/ui';
	import FormErrorSummary from './FormErrorSummary.svelte';
	import PasswordStrength from './PasswordStrength.svelte';
	import {
		formatCountdown,
		maskEmail,
		nextResetStep,
		secondsRemaining,
		validateCode,
		validateEmail,
		validatePassword,
		validatePasswordMatch,
		type AccountMessages,
		type FieldErrors,
		type ResetStep
	} from './logic';

	export let title = 'Reset your password';
	export let level: 1 | 2 | 3 | 4 = 2;
	export let step: ResetStep = 0;
	export let email = '';
	export let code = '';
	export let codeLength = 6;
	export let codeMode: 'numeric' | 'alphanumeric' = 'numeric';
	export let loading = false;
	export let error = '';
	export let autoAdvance = true;
	export let resendSeconds = 30;
	export let now: () => number = () => Date.now();
	export let messages: Partial<AccountMessages> = {};

	export let stepLabels = ['Email', 'Code', 'New password'];
	export let stepperLabel = 'Password reset progress';
	export let emailLabel = 'Email';
	export let emailHint = 'We will send a code to this address.';
	export let sendLabel = 'Send reset code';
	export let codeLabel = 'Reset code';
	export let codeIntro = 'We sent a code to {email}. It can take a minute to arrive.';
	export let verifyLabel = 'Verify code';
	export let resendLabel = 'Resend code';
	export let resendWaitLabel = 'Resend code in {time}';
	export let resentText = 'A new code was sent.';
	export let resendReadyText = 'You can ask for a new code now.';
	export let backLabel = 'Use a different email';
	export let passwordLabel = 'New password';
	export let confirmLabel = 'Confirm new password';
	export let showPasswordLabel = 'Show passwords';
	export let changeLabel = 'Change password';
	export let doneTitle = 'Password changed';
	export let doneText = 'You can now sign in with your new password.';
	export let doneLabel = 'Back to sign in';
	export let summaryTitle = 'Please fix the following';

	const dispatch = createEventDispatcher<{
		request: { email: string };
		verify: { email: string; code: string };
		resend: { email: string };
		reset: { email: string; code: string; password: string };
		done: void;
	}>();

	const id = uid('reset');
	let password = '';
	let confirm = '';
	let showPasswords = false;
	let errors: FieldErrors = {};
	let summary: FormErrorSummary;
	let heading: HTMLElement;
	let status = '';

	// The resend countdown.
	let resendAt = 0;
	let remaining = 0;
	let timer: ReturnType<typeof setInterval> | undefined;

	$: steps = stepLabels.map((label) => ({ label }));
	$: fieldsFor = [
		{ name: 'email', label: emailLabel, id: `${id}-email` },
		{ name: 'code', label: codeLabel, id: `${id}-code` },
		{ name: 'password', label: passwordLabel, id: `${id}-password` },
		{ name: 'confirm', label: confirmLabel, id: `${id}-confirm` }
	];
	$: headings = [title, codeLabel, passwordLabel, doneTitle];
	$: summaryLevel = (level + 2) as 2 | 3 | 4 | 5 | 6;

	let previous = step;
	let mounted = false;
	$: moved(step);

	function moved(next: ResetStep) {
		if (next === previous && mounted) return;
		const changed = next !== previous;
		previous = next;
		mounted = true;
		errors = {};
		if (next === 1) startCountdown();
		else stopCountdown();
		if (changed) tick().then(() => heading?.focus());
	}

	function startCountdown() {
		stopCountdown();
		resendAt = now() + resendSeconds * 1000;
		remaining = secondsRemaining(resendAt, now());
		timer = setInterval(() => {
			remaining = secondsRemaining(resendAt, now());
			if (remaining === 0) {
				stopCountdown();
				status = resendReadyText;
			}
		}, 1000);
	}

	function stopCountdown() {
		if (timer !== undefined) clearInterval(timer);
		timer = undefined;
	}

	onDestroy(stopCountdown);

	async function fail(next: FieldErrors) {
		errors = next;
		await tick();
		summary?.focus();
	}

	async function request() {
		if (loading) return;
		const problem = validateEmail(email, messages);
		if (problem) return fail({ email: problem });
		errors = {};
		dispatch('request', { email: email.trim() });
		if (autoAdvance) step = nextResetStep(step, 'sent');
	}

	async function verify() {
		if (loading) return;
		const problem = validateCode(code, codeLength, messages);
		if (problem) return fail({ code: problem });
		errors = {};
		dispatch('verify', { email: email.trim(), code });
		if (autoAdvance) step = nextResetStep(step, 'verified');
	}

	function resend() {
		if (remaining > 0 || loading) return;
		dispatch('resend', { email: email.trim() });
		status = resentText;
		startCountdown();
		heading?.focus();
	}

	function back() {
		code = '';
		step = nextResetStep(step, 'back');
	}

	async function change() {
		if (loading) return;
		const next: FieldErrors = {};
		const weak = validatePassword(password, { messages });
		if (weak) next.password = weak;
		const mismatch = validatePasswordMatch(password, confirm, messages);
		if (mismatch) next.confirm = mismatch;
		if (Object.keys(next).length > 0) return fail(next);
		errors = {};
		dispatch('reset', { email: email.trim(), code, password });
		if (autoAdvance) step = nextResetStep(step, 'changed');
	}
</script>

<section class="reset" aria-labelledby="{id}-title">
	<header>
		<svelte:element this={`h${level}`} id="{id}-title" class="reset__title">{title}</svelte:element>
		<Stepper {steps} current={step} label={stepperLabel} />
	</header>

	<svelte:element this={`h${level + 1}`} class="reset__step" tabindex="-1" bind:this={heading}>
		{headings[step]}
	</svelte:element>

	{#if error}<Alert tone="danger">{error}</Alert>{/if}
	<FormErrorSummary
		bind:this={summary}
		{errors}
		fields={fieldsFor}
		title={summaryTitle}
		level={summaryLevel}
	/>

	{#if step === 0}
		<form novalidate aria-busy={loading} on:submit|preventDefault={request}>
			<TextInput
				id="{id}-email"
				label={emailLabel}
				type="email"
				name="email"
				autocomplete="email"
				hint={emailHint}
				required
				bind:value={email}
				error={errors.email ?? ''}
			/>
			<Button type="submit" block {loading}>{sendLabel}</Button>
		</form>
	{:else if step === 1}
		<form novalidate aria-busy={loading} on:submit|preventDefault={verify}>
			<p class="muted">{codeIntro.replace('{email}', maskEmail(email))}</p>
			<InputOTP
				label={codeLabel}
				length={codeLength}
				mode={codeMode}
				bind:value={code}
				error={errors.code ?? ''}
			/>
			<Button type="submit" block {loading}>{verifyLabel}</Button>
			<div class="row">
				<Button variant="secondary" disabled={remaining > 0 || loading} on:click={resend}>
					<span
						class="resend"
						data-size={resendWaitLabel.replace('{time}', formatCountdown(resendSeconds))}
					>
						{remaining > 0
							? resendWaitLabel.replace('{time}', formatCountdown(remaining))
							: resendLabel}
					</span>
				</Button>
				<Button variant="ghost" on:click={back}>{backLabel}</Button>
			</div>
		</form>
	{:else if step === 2}
		<form novalidate aria-busy={loading} on:submit|preventDefault={change}>
			<TextInput
				id="{id}-password"
				label={passwordLabel}
				type={showPasswords ? 'text' : 'password'}
				name="password"
				autocomplete="new-password"
				required
				aria-describedby="{errors.password ? `${id}-password-error ` : ''}{id}-strength"
				bind:value={password}
				error={errors.password ?? ''}
			/>
			<PasswordStrength id="{id}-strength" {password} />
			<TextInput
				id="{id}-confirm"
				label={confirmLabel}
				type={showPasswords ? 'text' : 'password'}
				name="confirm"
				autocomplete="new-password"
				required
				bind:value={confirm}
				error={errors.confirm ?? ''}
			/>
			<Checkbox label={showPasswordLabel} bind:checked={showPasswords} />
			<Button type="submit" block {loading}>{changeLabel}</Button>
		</form>
	{:else}
		<Alert tone="success" title={doneTitle}>{doneText}</Alert>
		<Button block on:click={() => dispatch('done')}>{doneLabel}</Button>
	{/if}

	<p class="sr-only" role="status">{status}</p>
</section>

<style>
	/* The button is as wide as its longest label, so the countdown never resizes it. */
	.resend {
		display: inline-grid;
		justify-items: center;
		font-variant-numeric: tabular-nums;
	}

	.resend::after {
		content: attr(data-size);
		grid-area: 1 / 1;
		height: 0;
		overflow: hidden;
		visibility: hidden;
	}

	.reset {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
		inline-size: 100%;
		max-inline-size: 30rem;
		min-width: 0;
		padding: var(--spacing-lg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-background);
		color: var(--color-text);
	}

	header {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
		min-width: 0;
	}

	.reset__title {
		margin: 0;
		font-size: 1.5rem;
	}

	.reset__step {
		margin: 0;
		font-size: 1.125rem;
	}

	.reset__step:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 4px;
	}

	form {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
		min-width: 0;
	}

	.muted {
		margin: 0;
		color: var(--color-text-secondary);
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-sm);
	}
</style>
