<!--
	Separator — a line between groups of content, horizontal or vertical.
	Decorative by default (role="none", skipped by screen readers); with
	`decorative={false}` it is a real separator with its orientation. A
	`label` sits centred on a horizontal line ("or", "Older").
-->
<script lang="ts">
	export let orientation: 'horizontal' | 'vertical' = 'horizontal';
	export let decorative = true;
	export let label = '';
</script>

{#if label && orientation === 'horizontal'}
	<div
		class="separator separator--labelled"
		role={decorative ? 'none' : 'separator'}
		aria-orientation={decorative ? undefined : orientation}
		aria-label={decorative ? undefined : label}
	>
		<span class="separator__label">{label}</span>
	</div>
{:else}
	<div
		class="separator separator--{orientation}"
		role={decorative ? 'none' : 'separator'}
		aria-orientation={decorative ? undefined : orientation}
	></div>
{/if}

<style>
	.separator--horizontal {
		width: 100%;
		height: 1px;
		margin: var(--spacing-md) 0;
		background: var(--color-border);
	}

	.separator--vertical {
		align-self: stretch;
		width: 1px;
		min-height: 1em;
		margin: 0 var(--spacing-sm);
		background: var(--color-border);
	}

	.separator--labelled {
		display: flex;
		align-items: center;
		gap: var(--spacing-md);
		width: 100%;
		margin: var(--spacing-md) 0;
		color: var(--color-text-secondary);
		font-size: 0.8125rem;
	}

	.separator--labelled::before,
	.separator--labelled::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--color-border);
	}

	.separator__label {
		white-space: nowrap;
	}
</style>
