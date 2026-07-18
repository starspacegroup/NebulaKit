<script lang="ts">
	import type { ActionData, PageData } from './$types';

	export let data: PageData;
	export let form: ActionData;
</script>

<svelte:head>
	<title>Contact</title>
	<meta name="description" content="Get in touch — send us a message." />
	{#if data.turnstileSiteKey}
		<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
	{/if}
</svelte:head>

<div class="contact-page">
	<div class="contact-panel">
		<h1>Get in touch</h1>
		<p class="subtitle">
			Have a question or feedback? Send us a message and we'll get back to you.
		</p>

		{#if form?.success}
			<div class="banner banner-success" role="status">{form.message}</div>
		{:else if form?.error}
			<div class="banner banner-error" role="alert">{form.error}</div>
		{/if}

		{#if !form?.success}
			<form method="POST" class="contact-form">
				<label class="field">
					<span>Name</span>
					<input type="text" name="name" autocomplete="name" required />
				</label>

				<label class="field">
					<span>Email</span>
					<input type="email" name="email" autocomplete="email" required />
				</label>

				<label class="field">
					<span>Message</span>
					<textarea name="message" rows="6" required></textarea>
				</label>

				{#if data.turnstileSiteKey}
					<div class="cf-turnstile" data-sitekey={data.turnstileSiteKey}></div>
				{/if}

				<button type="submit" class="submit-btn">Send Message</button>
			</form>
		{/if}
	</div>
</div>

<style>
	.contact-page {
		display: flex;
		justify-content: center;
		padding: var(--spacing-2xl) var(--spacing-md);
		background: var(--color-background);
		min-height: calc(100vh - 64px);
	}

	.contact-panel {
		width: min(100%, 40rem);
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: var(--spacing-2xl);
		box-shadow: var(--shadow-md);
	}

	h1 {
		font-size: 2rem;
		font-weight: 700;
		color: var(--color-text);
		margin-bottom: var(--spacing-sm);
	}

	.subtitle {
		color: var(--color-text-secondary);
		margin-bottom: var(--spacing-xl);
	}

	.banner {
		padding: var(--spacing-md);
		border-radius: var(--radius-md);
		margin-bottom: var(--spacing-lg);
		font-size: 0.95rem;
	}

	.banner-success {
		background: color-mix(in srgb, var(--color-success) 12%, transparent);
		color: var(--color-success);
	}

	.banner-error {
		background: color-mix(in srgb, var(--color-error) 12%, transparent);
		color: var(--color-error);
	}

	.contact-form {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-lg);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xs);
	}

	.field span {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--color-text);
	}

	input,
	textarea {
		width: 100%;
		padding: var(--spacing-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-background);
		color: var(--color-text);
		font: inherit;
		transition: border-color var(--transition-fast);
	}

	input:focus,
	textarea:focus {
		outline: none;
		border-color: var(--color-primary);
	}

	textarea {
		resize: vertical;
	}

	.submit-btn {
		align-self: flex-start;
		padding: var(--spacing-md) var(--spacing-xl);
		border: none;
		border-radius: var(--radius-md);
		background: var(--color-primary);
		color: var(--color-background);
		font: inherit;
		font-weight: 600;
		cursor: pointer;
		transition: background var(--transition-fast);
	}

	.submit-btn:hover {
		background: var(--color-primary-hover);
	}
</style>
