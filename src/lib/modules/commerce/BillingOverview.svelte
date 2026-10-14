<!--
	BillingOverview — the plan you are on, what it costs, when it renews and
	how much of it you have used. Upgrade and cancel are events; cancelling asks
	first in an alert dialog. Presentational: nothing is charged or fetched here.
-->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import AlertDialog from '$lib/ui/AlertDialog.svelte';
	import Alert from '$lib/ui/Alert.svelte';
	import Badge from '$lib/ui/Badge.svelte';
	import Button from '$lib/ui/Button.svelte';
	import { uid } from '$lib/ui/logic';
	import UsageMeters from './UsageMeters.svelte';
	import { daysUntilDate, formatCommerceDate, formatMoney, type UsageMeter } from './logic';

	export let plan: {
		name: string;
		priceCents: number;
		interval: 'month' | 'year';
		currency?: string;
	};
	/** ISO date of the next renewal (or the end date when cancelled). */
	export let renewsAt: string;
	export let status: 'active' | 'trialing' | 'past_due' | 'canceled' = 'active';
	/** Cancellation is scheduled: the plan runs to `renewsAt` and then stops. */
	export let cancelAtPeriodEnd = false;
	export let meters: UsageMeter[] = [];
	export let warnAt = 0.8;
	export let resetsAt: string | undefined = undefined;
	export let now: Date | null = null;
	export let locale = 'en-US';
	export let timeZone = 'UTC';
	export let level: 2 | 3 | 4 = 2;
	export let busy = false;
	export let labels: Partial<typeof defaults> = {};

	const defaults = {
		heading: 'Billing',
		plan: 'Current plan',
		price: 'Price',
		renews: 'Renews on',
		ends: 'Ends on',
		perMonth: '{price} per month',
		perYear: '{price} per year',
		inDays: 'in {days} days',
		today: 'today',
		tomorrow: 'tomorrow',
		active: 'Active',
		trialing: 'Trial',
		past_due: 'Payment overdue',
		canceled: 'Canceled',
		pastDueAlert: 'Your last payment failed. Update your payment method to keep this plan.',
		cancelingAlert: 'Your plan is set to end on {date}. You keep access until then.',
		upgrade: 'Upgrade plan',
		cancel: 'Cancel plan',
		resume: 'Keep my plan',
		confirmTitle: 'Cancel your plan?',
		confirmBody: 'You keep access until {date}. After that your account moves to the free plan.',
		confirmYes: 'Cancel plan',
		confirmNo: 'Keep plan'
	};

	const dispatch = createEventDispatcher<{ upgrade: void; cancel: void; resume: void }>();
	const titleId = uid('billing');
	let confirming = false;

	$: t = { ...defaults, ...labels };
	$: date = formatCommerceDate(renewsAt, locale, timeZone, 'long');
	$: price = formatMoney(plan.priceCents, plan.currency ?? 'USD', locale);
	$: priceText = (plan.interval === 'year' ? t.perYear : t.perMonth).replace('{price}', price);
	$: relative = (() => {
		if (!now) return '';
		const d = daysUntilDate(renewsAt, now);
		return d === 0 ? t.today : d === 1 ? t.tomorrow : t.inDays.replace('{days}', String(d));
	})();
	$: ending = cancelAtPeriodEnd || status === 'canceled';
	let tone: 'success' | 'info' | 'danger' = 'success';
	$: tone = status === 'active' ? 'success' : status === 'trialing' ? 'info' : 'danger';
	$: childLevel = Math.min(level + 1, 5) as 2 | 3 | 4 | 5;
</script>

<section class="billing" aria-labelledby={titleId}>
	<header class="billing__head">
		<svelte:element this={`h${level}`} class="billing__title" id={titleId}
			>{t.heading}</svelte:element
		>
		<Badge {tone}>{t[status]}</Badge>
	</header>

	{#if status === 'past_due'}
		<Alert tone="danger" title={t.pastDueAlert} />
	{/if}
	{#if cancelAtPeriodEnd && status !== 'canceled'}
		<Alert tone="warning">{t.cancelingAlert.replace('{date}', date)}</Alert>
	{/if}

	<dl class="billing__facts">
		<div>
			<dt>{t.plan}</dt>
			<dd class="billing__plan">{plan.name}</dd>
		</div>
		<div>
			<dt>{t.price}</dt>
			<dd>{priceText}</dd>
		</div>
		<div>
			<dt>{ending ? t.ends : t.renews}</dt>
			<dd>
				<time datetime={renewsAt}>{date}</time>{#if relative}<span class="billing__rel">
						({relative})</span
					>{/if}
			</dd>
		</div>
	</dl>

	{#if meters.length}
		<UsageMeters {meters} {warnAt} {resetsAt} {now} {locale} {timeZone} level={childLevel} />
	{/if}

	<div class="billing__actions">
		{#if cancelAtPeriodEnd && status !== 'canceled'}
			<Button loading={busy} on:click={() => dispatch('resume')}>{t.resume}</Button>
		{:else}
			<Button loading={busy} on:click={() => dispatch('upgrade')}>{t.upgrade}</Button>
			{#if status !== 'canceled'}
				<Button variant="secondary" disabled={busy} on:click={() => (confirming = true)}
					>{t.cancel}</Button
				>
			{/if}
		{/if}
	</div>

	<AlertDialog
		bind:open={confirming}
		title={t.confirmTitle}
		description={t.confirmBody.replace('{date}', date)}
		confirmLabel={t.confirmYes}
		cancelLabel={t.confirmNo}
		tone="danger"
		on:confirm={() => dispatch('cancel')}
	/>
</section>

<style>
	.billing {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
		min-width: 0;
		padding: var(--spacing-lg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		color: var(--color-text);
	}

	.billing__head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-sm);
	}

	.billing__title {
		margin: 0;
		font-size: 1.25rem;
	}

	.billing__facts {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
		margin: 0;
	}

	.billing__facts dt {
		color: var(--color-text-secondary);
		font-size: 0.8125rem;
	}

	.billing__facts dd {
		margin: 0;
		font-weight: 600;
	}

	.billing__plan {
		font-size: 1.25rem;
	}

	.billing__rel {
		margin-inline-start: var(--spacing-xs);
		color: var(--color-text-secondary);
		font-weight: 400;
	}

	.billing__actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-sm);
	}

	.billing__actions :global(.btn) {
		min-height: 2.75rem;
	}

	@media (min-width: 40rem) {
		.billing__facts {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}

	/* Digits that change keep their width, so a live count or time never nudges what is beside it. */
	time {
		font-variant-numeric: tabular-nums;
	}
</style>
