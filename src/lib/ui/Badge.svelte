<!-- Badge — a short status label. Text colour is the theme's own, so every tone reads in both themes. -->
<script lang="ts">
	export let tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger' = 'neutral';
</script>

<span class="badge badge--{tone}"><slot /></span>

<style>
	.badge {
		--tone: var(--color-text-secondary);
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-xs);
		padding: 0.125rem 0.5rem;
		border: 1px solid color-mix(in srgb, var(--tone) 45%, transparent);
		border-radius: 999px;
		background: color-mix(in srgb, var(--tone) 14%, var(--color-background));
		color: var(--color-text);
		font-size: 0.75rem;
		font-weight: 600;
		line-height: 1.5;
		white-space: nowrap;
	}

	.badge::before {
		content: '';
		width: 0.5em;
		height: 0.5em;
		border-radius: 50%;
		background: var(--tone);
	}

	.badge--info {
		--tone: var(--color-primary);
	}

	.badge--success {
		--tone: var(--color-success);
	}

	.badge--warning {
		--tone: var(--color-warning);
	}

	.badge--danger {
		--tone: var(--color-danger);
	}
</style>
