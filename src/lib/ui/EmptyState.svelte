<!-- EmptyState — what an empty list or a first visit shows, and what to do next. -->
<script lang="ts">
	export let title: string;
	export let description = '';
	/** A single character or emoji shown large above the title. */
	export let icon = '';
</script>

<div class="empty">
	{#if icon}<div class="empty__icon" aria-hidden="true">{icon}</div>{/if}
	<p class="empty__title">{title}</p>
	{#if description}<p class="empty__description">{description}</p>{/if}
	{#if $$slots.default}<div class="empty__actions"><slot /></div>{/if}
</div>

<style>
	.empty {
		display: grid;
		justify-items: center;
		gap: var(--spacing-sm);
		padding: var(--spacing-2xl) var(--spacing-lg);
		border: 1px dashed var(--color-border);
		border-radius: var(--radius-lg);
		text-align: center;
	}

	.empty__icon {
		font-size: 2.25rem;
		line-height: 1;
	}

	.empty__title {
		margin: 0;
		font-size: 1.125rem;
		font-weight: 700;
		color: var(--color-text);
	}

	.empty__description {
		max-width: 36ch;
		margin: 0;
		color: var(--color-text-secondary);
	}

	.empty__actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--spacing-sm);
		margin-top: var(--spacing-sm);
	}
</style>
