<!--
	ErrorState — a full-section error: 404, 403, 500, offline or maintenance
	presets, each with an icon, a heading, an explanation and the next step —
	Try again (where retrying makes sense) and Go home. Copy is overridable.
	A request id, when you have one, is shown with a Copy button that confirms
	in a polite live region. `announce` makes the whole block role="alert" for
	an error that appears in place after an action, rather than a page of its
	own. Events: `on:retry`, `on:home`, `on:copy` (`{ requestId }`).
-->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { Button, uid } from '$lib/ui';
	import { canRetryError, resolveErrorCopy, type ErrorKind } from './logic';

	export let kind: ErrorKind = '500';
	export let title = '';
	export let description = '';
	/** 1 to 6: the heading level of the title. */
	export let level: 1 | 2 | 3 | 4 | 5 | 6 = 1;
	export let requestId = '';
	/** Where Go home links to. Without it, Go home is a button that fires `on:home`. */
	export let homeHref: string | undefined = '/';
	/** Show Try again. Defaults to the kinds where retrying can help. */
	export let showRetry: boolean | undefined = undefined;
	/** Try again is working: it shows a spinner and ignores clicks. */
	export let retrying = false;
	export let announce = false;
	export let retryLabel = 'Try again';
	export let homeLabel = 'Go home';
	export let copyLabel = 'Copy';
	export let copiedLabel = 'Copied';
	export let requestIdLabel = 'Request ID';

	const dispatch = createEventDispatcher<{
		retry: void;
		home: void;
		copy: { requestId: string };
	}>();
	const id = uid('error-state');
	let copied = false;

	$: copy = resolveErrorCopy(kind, { title, description });
	$: retry = showRetry ?? canRetryError(kind);

	async function copyId() {
		try {
			await navigator.clipboard.writeText(requestId);
		} catch {
			// No clipboard access: select the text so it can be copied by hand.
			const node = document.getElementById(`${id}-request`);
			const selection = window.getSelection();
			if (node && selection) {
				const range = document.createRange();
				range.selectNodeContents(node);
				selection.removeAllRanges();
				selection.addRange(range);
			}
		}
		copied = true;
		dispatch('copy', { requestId });
		setTimeout(() => (copied = false), 2500);
	}
</script>

<section
	class="error-state error-state--{kind}"
	aria-labelledby="{id}-title"
	role={announce ? 'alert' : undefined}
>
	<div class="error-state__icon" aria-hidden="true">{copy.icon}</div>
	{#if copy.code}<p class="error-state__code">{copy.code}</p>{/if}
	<svelte:element this={`h${level}`} class="error-state__title" id="{id}-title"
		>{copy.title}</svelte:element
	>
	<p class="error-state__description">{copy.description}</p>

	<div class="error-state__actions">
		{#if retry}
			<Button loading={retrying} on:click={() => dispatch('retry')}>{retryLabel}</Button>
		{/if}
		{#if homeHref}
			<Button variant="secondary" href={homeHref} on:click={() => dispatch('home')}
				>{homeLabel}</Button
			>
		{:else}
			<Button variant="secondary" on:click={() => dispatch('home')}>{homeLabel}</Button>
		{/if}
	</div>

	{#if requestId}
		<div class="error-state__request">
			<span class="error-state__request-label">{requestIdLabel}</span>
			<code id="{id}-request">{requestId}</code>
			<Button variant="ghost" size="sm" on:click={copyId}
				>{copyLabel}<span class="error-state__sr">: {requestIdLabel}</span></Button
			>
			<span class="error-state__copied" role="status" aria-live="polite"
				>{copied ? copiedLabel : ''}</span
			>
		</div>
	{/if}
</section>

<style>
	.error-state {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		justify-items: center;
		gap: var(--spacing-sm);
		min-width: 0;
		padding: var(--spacing-xl, var(--spacing-lg)) var(--spacing-md);
		text-align: center;
	}

	.error-state__icon {
		font-size: 3rem;
		line-height: 1;
	}

	.error-state__code {
		margin: 0;
		color: var(--color-text-secondary);
		font-family: var(--font-mono);
		font-size: 0.875rem;
		letter-spacing: 0.08em;
	}

	.error-state__title {
		margin: 0;
		font-size: clamp(1.375rem, 5vw, 2rem);
		overflow-wrap: anywhere;
	}

	.error-state__description {
		max-width: 42ch;
		margin: 0;
		color: var(--color-text-secondary);
	}

	.error-state__actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--spacing-sm);
		margin-top: var(--spacing-sm);
	}

	.error-state__actions :global(.btn),
	.error-state__request :global(.btn) {
		min-height: 44px;
	}

	.error-state__request {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: var(--spacing-xs) var(--spacing-sm);
		max-width: 100%;
		margin-top: var(--spacing-md);
		padding: var(--spacing-xs) var(--spacing-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		font-size: 0.875rem;
	}

	.error-state__request-label {
		color: var(--color-text-secondary);
	}

	code {
		font-family: var(--font-mono);
		overflow-wrap: anywhere;
	}

	.error-state__copied {
		min-width: 4.5rem;
		color: var(--color-success);
		font-weight: 600;
	}

	.error-state__sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
</style>
