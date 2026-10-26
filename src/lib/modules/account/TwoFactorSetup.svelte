<!--
	TwoFactorSetup — set up an authenticator app in three parts: scan a QR code
	(the `qr` slot; a placeholder shows until you fill it) or copy the secret,
	enter the 6-digit code to prove it works, then keep the recovery codes
	(copy or download them, and tick that they are saved before finishing).
	You generate the secret and codes and check the code; this module shows
	them. Set `verified` once your server accepts the code to reveal the codes.
	Events: `verify` with { code }, `copy` with { what, text }, `download` with
	{ filename, content }, `complete`.
-->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { Alert, Button, Checkbox, InputOTP, uid } from '$lib/ui';
	import {
		formatRecoveryCode,
		formatSecret,
		recoveryCodesFile,
		recoveryCodesText,
		recoveryFilename,
		validateCode,
		type AccountMessages
	} from './logic';

	export let secret = '';
	export let recoveryCodes: string[] = [];
	export let appName = 'Your app';
	export let title = 'Set up two-factor authentication';
	export let level: 2 | 3 | 4 = 2;
	export let codeLength = 6;
	export let verifying = false;
	export let verified = false;
	export let error = '';
	export let messages: Partial<AccountMessages> = {};

	export let scanTitle = 'Scan the QR code';
	export let scanText = 'Open your authenticator app and scan this code.';
	export let qrPlaceholder = 'QR code appears here';
	export let secretTitle = 'Or enter the key by hand';
	export let secretLabel = 'Setup key';
	export let copyKeyLabel = 'Copy key';
	export let verifyTitle = 'Enter the code';
	export let verifyText = 'Type the {length}-digit code your app shows.';
	export let codeLabel = 'Authentication code';
	export let verifyLabel = 'Verify and turn on';
	export let verifyingLabel = 'Verifying';
	export let verifiedText = 'Two-factor authentication is on.';
	export let recoveryTitle = 'Save your recovery codes';
	export let recoveryText =
		'If you lose your device, each of these codes signs you in once. Keep them somewhere safe.';
	export let recoveryLockedText = 'Your recovery codes appear after you verify the code.';
	export let copyCodesLabel = 'Copy codes';
	export let downloadLabel = 'Download codes';
	export let savedLabel = 'I have saved my recovery codes';
	export let finishLabel = 'Finish';
	export let copiedText = 'Copied to the clipboard.';
	export let copyFailedText = 'Could not copy. Select the text and copy it by hand.';
	export let downloadedText = 'Download started.';

	const dispatch = createEventDispatcher<{
		verify: { code: string };
		copy: { what: 'secret' | 'recovery'; text: string };
		download: { filename: string; content: string };
		complete: void;
	}>();

	const id = uid('two-factor');
	let code = '';
	let codeError = '';
	let saved = false;
	let status = '';

	$: sub = Math.min(level + 1, 6);
	$: shownSecret = formatSecret(secret);
	$: codes = recoveryCodes.map(formatRecoveryCode);

	async function copy(what: 'secret' | 'recovery', text: string) {
		try {
			await navigator.clipboard.writeText(text);
			status = copiedText;
		} catch {
			status = copyFailedText;
		}
		dispatch('copy', { what, text });
	}

	function download() {
		const content = recoveryCodesFile(recoveryCodes);
		const filename = recoveryFilename(appName);
		if (typeof URL.createObjectURL === 'function') {
			const url = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
			const link = document.createElement('a');
			link.href = url;
			link.download = filename;
			link.click();
			URL.revokeObjectURL(url);
		}
		status = downloadedText;
		dispatch('download', { filename, content });
	}

	function verify() {
		if (verifying) return;
		codeError = validateCode(code, codeLength, messages);
		if (codeError) return;
		dispatch('verify', { code });
	}
</script>

<section class="tfa" aria-labelledby="{id}-title">
	<svelte:element this={`h${level}`} id="{id}-title" class="tfa__title">{title}</svelte:element>

	<ol class="tfa__steps">
		<li>
			<svelte:element this={`h${sub}`}>{scanTitle}</svelte:element>
			<p class="muted">{scanText}</p>
			<div class="qr">
				<slot name="qr"><div class="qr__placeholder">{qrPlaceholder}</div></slot>
			</div>
			<svelte:element this={`h${Math.min(sub + 1, 6)}`} class="small">{secretTitle}</svelte:element>
			<div class="secret" role="group" aria-labelledby="{id}-secret-label">
				<p class="secret__label" id="{id}-secret-label">{secretLabel}</p>
				<code class="secret__value">{shownSecret}</code>
				<Button variant="secondary" on:click={() => copy('secret', secret)}>{copyKeyLabel}</Button>
			</div>
		</li>

		<li>
			<svelte:element this={`h${sub}`}>{verifyTitle}</svelte:element>
			{#if verified}
				<Alert tone="success">{verifiedText}</Alert>
			{:else}
				<form novalidate aria-busy={verifying} on:submit|preventDefault={verify}>
					<p class="muted">{verifyText.replace('{length}', String(codeLength))}</p>
					<InputOTP
						label={codeLabel}
						length={codeLength}
						bind:value={code}
						error={codeError || error}
					/>
					<Button type="submit" loading={verifying}
						>{verifying ? verifyingLabel : verifyLabel}</Button
					>
				</form>
			{/if}
		</li>

		<li>
			<svelte:element this={`h${sub}`}>{recoveryTitle}</svelte:element>
			{#if verified}
				<p class="muted">{recoveryText}</p>
				<ul class="codes" aria-label={recoveryTitle}>
					{#each codes as item (item)}<li><code>{item}</code></li>{/each}
				</ul>
				<div class="row">
					<Button
						variant="secondary"
						on:click={() => copy('recovery', recoveryCodesText(recoveryCodes))}
					>
						{copyCodesLabel}
					</Button>
					<Button variant="secondary" on:click={download}>{downloadLabel}</Button>
				</div>
				<Checkbox label={savedLabel} bind:checked={saved} />
				<div>
					<Button disabled={!saved} on:click={() => dispatch('complete')}>{finishLabel}</Button>
				</div>
			{:else}
				<p class="muted">{recoveryLockedText}</p>
			{/if}
		</li>
	</ol>

	<p class="status" role="status">{status}</p>
</section>

<style>
	.tfa {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
		inline-size: 100%;
		max-inline-size: 36rem;
		min-width: 0;
		padding: var(--spacing-lg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-background);
		color: var(--color-text);
	}

	.tfa__title {
		margin: 0;
		font-size: 1.5rem;
	}

	.tfa__steps {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-lg);
		margin: 0;
		padding-inline-start: var(--spacing-lg);
	}

	.tfa__steps > li {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-sm);
		min-width: 0;
		padding-inline-start: var(--spacing-xs);
	}

	.tfa__steps :global(h3),
	.tfa__steps :global(h4),
	.tfa__steps :global(h5),
	.tfa__steps :global(h6) {
		margin: 0;
		font-size: 1.0625rem;
	}

	.tfa__steps :global(.small) {
		font-size: 0.9rem;
		color: var(--color-text-secondary);
	}

	.muted {
		margin: 0;
		color: var(--color-text-secondary);
	}

	.qr {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		justify-items: start;
	}

	.qr__placeholder {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		place-items: center;
		inline-size: min(100%, 12rem);
		aspect-ratio: 1;
		padding: var(--spacing-sm);
		border: 2px dashed var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-text-secondary);
		font-size: 0.875rem;
		text-align: center;
	}

	.secret {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--spacing-sm);
	}

	.secret__label {
		margin: 0;
		font-size: 0.875rem;
		color: var(--color-text-secondary);
	}

	.secret__value {
		flex: 1 1 12rem;
		min-width: 0;
		padding: var(--spacing-sm) var(--spacing-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		font-family: var(--font-mono);
		overflow-wrap: anywhere;
		user-select: all;
	}

	.codes {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
		gap: var(--spacing-sm);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.codes li {
		padding: var(--spacing-sm);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-surface);
		text-align: center;
	}

	.codes code {
		font-family: var(--font-mono);
		user-select: all;
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-sm);
	}

	form {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-sm);
		justify-items: start;
	}

	.status {
		margin: 0;
		min-block-size: 1.25rem;
		color: var(--color-text-secondary);
		font-size: 0.875rem;
	}
</style>
