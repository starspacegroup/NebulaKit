<!--
  Callout — reference embed component.

  Reads props supplied from the embed's data-props. Styled entirely with the
  kit's theme tokens so it looks native in any NebulaKit app, in light or dark.
  Renders on the server (no onMount) so it paints with the page.
-->
<script lang="ts">
	export let variant: 'info' | 'success' | 'warning' | 'danger' = 'info';
	export let title = '';
	export let body = '';

	const ICONS: Record<string, string> = {
		info: 'ℹ️',
		success: '✅',
		warning: '⚠️',
		danger: '⛔'
	};

	$: safeVariant = ICONS[variant] ? variant : 'info';
</script>

<aside class="callout callout-{safeVariant}" role="note">
	<span class="callout-icon" aria-hidden="true">{ICONS[safeVariant]}</span>
	<div class="callout-content">
		{#if title}
			<p class="callout-title">{title}</p>
		{/if}
		{#if body}
			<p class="callout-body">{body}</p>
		{/if}
	</div>
</aside>

<style>
	.callout {
		display: flex;
		gap: var(--spacing-sm, 0.5rem);
		align-items: flex-start;
		padding: var(--spacing-md, 1rem);
		margin: var(--spacing-lg, 1.5rem) 0;
		border: 1px solid var(--color-border);
		border-left-width: 4px;
		border-radius: var(--radius-md, 0.5rem);
		background: var(--color-surface);
		color: var(--color-text);
	}

	.callout-info {
		border-left-color: var(--color-primary);
	}
	.callout-success {
		border-left-color: var(--color-success, #16a34a);
	}
	.callout-warning {
		border-left-color: var(--color-warning, #d97706);
	}
	.callout-danger {
		border-left-color: var(--color-danger, #ef4444);
	}

	.callout-icon {
		font-size: 1.125rem;
		line-height: 1.5;
		flex: none;
	}

	.callout-content {
		min-width: 0;
	}

	.callout-title {
		font-weight: 600;
		margin: 0;
	}

	.callout-body {
		margin: 0.25rem 0 0;
		color: var(--color-text-secondary);
	}
</style>
