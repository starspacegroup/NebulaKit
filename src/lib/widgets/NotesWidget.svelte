<!--
	Notes — a scratch pad. The simplest thing that is still a real widget: it
	takes props, keeps its own local state, and never reaches for a store.
-->
<script lang="ts">
	/** Starting text. Persisted by the app, not by the widget. */
	export let text = '';
	export let placeholder = 'Type anything. It stays here.';
</script>

<textarea class="notes" bind:value={text} {placeholder} rows="4" aria-label="Notes"></textarea>

<style>
	.notes {
		display: block;
		width: 100%;
		min-height: 5rem;
		padding: var(--spacing-sm);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background-color: var(--color-background);
		color: var(--color-text);
		font: inherit;
		line-height: 1.5;
		resize: vertical;
	}

	.notes:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 1px;
	}
</style>
