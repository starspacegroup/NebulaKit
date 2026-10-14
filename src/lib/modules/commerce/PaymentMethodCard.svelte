<!--
	PaymentMethodCard — a saved card: brand, masked number, expiry, and what
	you can do with it. Expired and expiring-soon are written out as text.
	Removing asks first. Presentational: it shows a brand and the last four
	digits, never a full number.
-->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import AlertDialog from '$lib/ui/AlertDialog.svelte';
	import Badge from '$lib/ui/Badge.svelte';
	import Button from '$lib/ui/Button.svelte';
	import { CARD_BRAND_LABELS, expiryLabel, expiryState, type CardBrand } from './logic';

	export let method: {
		id: string;
		brand: CardBrand;
		last4: string;
		expMonth: number;
		expYear: number;
		holder?: string;
		isDefault?: boolean;
	};
	export let now: Date | null = null;
	/** Months before expiry that count as "expiring soon". */
	export let soonMonths = 2;
	export let busy = false;
	export let level: 2 | 3 | 4 | 5 = 3;
	export let labels: Partial<typeof defaults> = {};

	const defaults = {
		title: '{brand} ending in {last4}',
		expires: 'Expires {date}',
		expired: 'Expired',
		expiring: 'Expires soon',
		isDefault: 'Default',
		holder: 'Cardholder',
		setDefault: 'Set as default',
		remove: 'Remove',
		confirmTitle: 'Remove this card?',
		confirmBody: '{brand} ending in {last4} will be removed from your account.',
		confirmYes: 'Remove card',
		confirmNo: 'Keep card'
	};

	const dispatch = createEventDispatcher<{ setDefault: { id: string }; remove: { id: string } }>();
	let confirming = false;

	$: t = { ...defaults, ...labels };
	$: brandName = CARD_BRAND_LABELS[method.brand];
	$: name = t.title.replace('{brand}', brandName).replace('{last4}', method.last4);
	$: state = now ? expiryState(method.expMonth, method.expYear, now, soonMonths) : 'valid';
</script>

<article class="pm" class:pm--expired={state === 'expired'} aria-label={name}>
	<div class="pm__main">
		<span class="pm__brand" aria-hidden="true">{brandName}</span>
		<div class="pm__text">
			<svelte:element this={`h${level}`} class="pm__title">{name}</svelte:element>
			<p class="pm__expiry">
				{t.expires.replace('{date}', expiryLabel(method.expMonth, method.expYear))}
				{#if state === 'expired'}<Badge tone="danger">{t.expired}</Badge>
				{:else if state === 'expiring'}<Badge tone="warning">{t.expiring}</Badge>{/if}
				{#if method.isDefault}<Badge tone="info">{t.isDefault}</Badge>{/if}
			</p>
			{#if method.holder}<p class="pm__holder">{t.holder}: {method.holder}</p>{/if}
		</div>
	</div>
	<div class="pm__actions">
		{#if !method.isDefault}
			<Button
				variant="secondary"
				size="sm"
				disabled={busy}
				aria-label="{t.setDefault}: {name}"
				on:click={() => dispatch('setDefault', { id: method.id })}>{t.setDefault}</Button
			>
		{/if}
		<Button
			variant="ghost"
			size="sm"
			disabled={busy}
			aria-label="{t.remove}: {name}"
			on:click={() => (confirming = true)}>{t.remove}</Button
		>
	</div>
	<AlertDialog
		bind:open={confirming}
		title={t.confirmTitle}
		description={t.confirmBody.replace('{brand}', brandName).replace('{last4}', method.last4)}
		confirmLabel={t.confirmYes}
		cancelLabel={t.confirmNo}
		tone="danger"
		on:confirm={() => dispatch('remove', { id: method.id })}
	/>
</article>

<style>
	.pm {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
		min-width: 0;
		padding: var(--spacing-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		color: var(--color-text);
	}

	.pm--expired {
		border-color: var(--color-danger);
	}

	.pm__main {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: var(--spacing-md);
		min-width: 0;
	}

	.pm__brand {
		flex-shrink: 0;
		min-width: 4.5rem;
		padding: var(--spacing-xs) var(--spacing-sm);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-background);
		font-size: 0.75rem;
		font-weight: 700;
		text-align: center;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	/* On a narrow card the details drop under the brand instead of being squeezed beside it. */
	.pm__text {
		flex: 1 1 10rem;
		min-width: 0;
	}

	.pm__title {
		margin: 0;
		font-size: 1rem;
		overflow-wrap: anywhere;
	}

	.pm__expiry :global(.badge) {
		max-width: 100%;
		white-space: normal;
	}

	.pm__expiry,
	.pm__holder {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--spacing-xs) var(--spacing-sm);
		margin: var(--spacing-xs) 0 0;
		color: var(--color-text-secondary);
		font-size: 0.875rem;
	}

	.pm__actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-sm);
	}

	.pm__actions :global(.btn) {
		min-height: 2.75rem;
	}

	@media (min-width: 40rem) {
		.pm {
			grid-template-columns: minmax(0, 1fr) auto;
			align-items: center;
		}
	}
</style>
