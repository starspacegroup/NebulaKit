<!--
	CookieConsent — a banner with equally easy Accept all / Reject all, and a
	preferences dialog with one switch per category (the necessary one is
	locked on). It never blocks the page: the banner is a labelled region, not a
	modal, and takes no focus until you use it. It stores nothing; listen for
	`accept`, `reject` or `save` and keep the choice where the app keeps it.
-->
<script lang="ts">
	import { createEventDispatcher, onMount, tick } from 'svelte';
	import Button from '$lib/ui/Button.svelte';
	import Dialog from '$lib/ui/Dialog.svelte';
	import Switch from '$lib/ui/Switch.svelte';
	import {
		DEFAULT_CATEGORIES,
		acceptAll,
		consentSummary,
		defaultConsent,
		normalizeConsent,
		rejectAll,
		setConsent,
		type ConsentCategory,
		type ConsentState
	} from './logic';

	export let categories: ConsentCategory[] = DEFAULT_CATEGORIES;
	/** The current choices. Bind it to read the result. */
	export let consent: ConsentState = defaultConsent(DEFAULT_CATEGORIES);
	/** Whether the banner is showing. Set it true to ask again. */
	export let visible = true;
	/** "fixed" pins the banner to the bottom of the viewport; "inline" leaves it in the flow. */
	export let placement: 'fixed' | 'inline' = 'fixed';
	/** Link to the cookie / privacy policy. */
	export let policyHref = '';
	/** After a decision made inside the banner, focus goes to this selector, else back to where it was. */
	export let focusAfter = '';
	/** Show a "Cookie settings" button after a decision, so the choice can be changed. */
	export let showReopen = true;
	export let level: 2 | 3 | 4 = 2;
	export let copy: Partial<typeof DEFAULT_COPY> = {};

	const DEFAULT_COPY = {
		title: 'Cookies on this site',
		body: 'We use necessary cookies to make the site work. With your say-so we also use cookies to understand how it is used and to measure our marketing.',
		policy: 'Read the cookie policy',
		accept: 'Accept all',
		reject: 'Reject all',
		preferences: 'Preferences',
		reopen: 'Cookie settings',
		dialogTitle: 'Cookie preferences',
		dialogBody: 'Choose which cookies you allow. You can change this at any time.',
		alwaysOn: 'Always on',
		save: 'Save choices',
		cancel: 'Cancel',
		saved: 'Cookie choices saved.'
	};

	const dispatch = createEventDispatcher<{
		accept: ConsentState;
		reject: ConsentState;
		save: ConsentState;
		change: ConsentState;
	}>();

	let banner: HTMLElement | undefined;
	let reopenWrap: HTMLElement | undefined;
	let dialogOpen = false;
	let draft: ConsentState = {};
	let announcement = '';
	let lastOutside: HTMLElement | null = null;
	let openedFromBanner = false;

	$: t = { ...DEFAULT_COPY, ...copy };
	$: consent = normalizeConsent(consent, categories);

	onMount(() => {
		// Remember the last thing focused outside the banner, so a decision made
		// from the keyboard hands focus back to where the person was.
		const onFocusIn = (event: FocusEvent) => {
			const target = event.target as HTMLElement;
			if (banner && !banner.contains(target) && target !== document.body) lastOutside = target;
		};
		document.addEventListener('focusin', onFocusIn);
		return () => document.removeEventListener('focusin', onFocusIn);
	});

	/** Open the preferences dialog from anywhere, for a "Cookie settings" link in the footer. */
	export function openPreferences() {
		openedFromBanner = inBanner();
		draft = { ...consent };
		dialogOpen = true;
	}

	async function settle(
		name: 'accept' | 'reject' | 'save',
		next: ConsentState,
		wasInBanner: boolean
	) {
		consent = normalizeConsent(next, categories);
		visible = false;
		dialogOpen = false;
		announcement = t.saved;
		dispatch(name, consent);
		dispatch('change', consent);
		await tick();
		const refocus = wasInBanner || openedFromBanner;
		openedFromBanner = false;
		if (refocus) {
			const target =
				(focusAfter ? document.querySelector<HTMLElement>(focusAfter) : null) ??
				(lastOutside && document.contains(lastOutside) ? lastOutside : null) ??
				reopenWrap?.querySelector('button') ??
				null;
			target?.focus();
		}
	}

	function inBanner(): boolean {
		return Boolean(banner && document.activeElement && banner.contains(document.activeElement));
	}

	function toggle(id: string, event: Event) {
		draft = setConsent(draft, categories, id, (event.target as HTMLInputElement).checked);
	}
</script>

{#if visible}
	<section bind:this={banner} class="cookie cookie--{placement}" aria-labelledby="cookie-title">
		<svelte:element this={`h${level}`} id="cookie-title" class="cookie__title"
			>{t.title}</svelte:element
		>
		<p class="cookie__body">
			{t.body}
			{#if policyHref}<a href={policyHref}>{t.policy}</a>{/if}
		</p>
		<div class="cookie__actions">
			<Button
				variant="secondary"
				on:click={() => settle('reject', rejectAll(categories), inBanner())}>{t.reject}</Button
			>
			<Button variant="secondary" on:click={openPreferences}>{t.preferences}</Button>
			<Button on:click={() => settle('accept', acceptAll(categories), inBanner())}
				>{t.accept}</Button
			>
		</div>
	</section>
{:else if showReopen}
	<span class="cookie__reopen" bind:this={reopenWrap}>
		<Button variant="ghost" size="sm" on:click={openPreferences}>{t.reopen}</Button>
	</span>
{/if}

<p class="sr-only" role="status">{announcement}</p>

<Dialog bind:open={dialogOpen} title={t.dialogTitle} description={t.dialogBody}>
	<ul class="cats">
		{#each categories as category (category.id)}
			<li class="cat">
				<Switch
					label={category.label}
					checked={category.necessary ? true : draft[category.id] === true}
					disabled={category.necessary === true}
					on:change={(e) => toggle(category.id, e)}
				/>
				{#if category.necessary}<span class="cat__lock">{t.alwaysOn}</span>{/if}
				{#if category.description}<p class="cat__desc">{category.description}</p>{/if}
			</li>
		{/each}
	</ul>
	<p class="cats__summary">{consentSummary(draft, categories)}</p>
	<svelte:fragment slot="actions">
		<Button variant="secondary" on:click={() => (dialogOpen = false)}>{t.cancel}</Button>
		<Button variant="secondary" on:click={() => settle('reject', rejectAll(categories), inBanner())}
			>{t.reject}</Button
		>
		<Button on:click={() => settle('save', draft, inBanner())}>{t.save}</Button>
	</svelte:fragment>
</Dialog>

<style>
	.cookie {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-sm);
		padding: var(--spacing-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-background);
		color: var(--color-text);
		box-shadow: var(--shadow-lg);
	}

	.cookie--fixed {
		position: fixed;
		inset-inline: var(--spacing-sm);
		inset-block-end: var(--spacing-sm);
		z-index: 40;
		max-inline-size: 40rem;
		margin-inline: auto;
	}

	.cookie > * {
		margin: 0;
	}

	.cookie__title {
		font-size: 1.05rem;
	}

	.cookie__body {
		font-size: 0.9rem;
		color: var(--color-text-secondary);
	}

	.cookie__body a {
		color: var(--color-primary);
		text-decoration: underline;
		text-underline-offset: 0.2em;
	}

	.cookie__actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-sm);
		justify-content: flex-end;
	}

	.cookie__actions > :global(*) {
		flex: 1 1 auto;
	}

	@media (min-width: 40rem) {
		.cookie__actions > :global(*) {
			flex: 0 0 auto;
		}
	}

	.cookie__reopen {
		display: inline-block;
	}

	.cats {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.cat {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-xs);
		padding-block-end: var(--spacing-sm);
		border-block-end: 1px solid var(--color-border);
	}

	.cat__lock {
		color: var(--color-text-secondary);
		font-size: 0.8rem;
		font-weight: 600;
	}

	.cat__desc {
		margin: 0;
		color: var(--color-text-secondary);
		font-size: 0.875rem;
	}

	.cats__summary {
		margin: var(--spacing-md) 0 0;
		color: var(--color-text-secondary);
		font-size: 0.875rem;
	}
</style>
