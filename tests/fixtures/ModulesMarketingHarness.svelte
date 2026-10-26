<!--
	Renders a marketing module with its events reported through `onEvent` and
	its bindable state echoed in `data-testid="state"`.
-->
<script lang="ts">
	import type { MarketingWhich } from './modules-which';
	import AnnouncementBar from '$lib/modules/marketing/AnnouncementBar.svelte';
	import ContactForm from '$lib/modules/marketing/ContactForm.svelte';
	import CtaBanner from '$lib/modules/marketing/CtaBanner.svelte';
	import FaqSection from '$lib/modules/marketing/FaqSection.svelte';
	import Hero from '$lib/modules/marketing/Hero.svelte';
	import NewsletterSignup from '$lib/modules/marketing/NewsletterSignup.svelte';
	import PricingTable from '$lib/modules/marketing/PricingTable.svelte';
	import TestimonialCarousel from '$lib/modules/marketing/TestimonialCarousel.svelte';
	export let which: MarketingWhich;
	export let props: Record<string, unknown> = {};
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	export let onEvent: (name: string, detail: any) => void = () => {};

	// Bound state starts from `props` so tests can set it, and is kept out of the spread.
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const {
		interval: i0,
		index: x0,
		open: o0,
		query: q0,
		isOpen: s0,
		status: st0,
		...rest
	} = props as any;
	let interval = i0 ?? 'monthly';
	let index = x0 ?? 0;
	let open: string[] = o0 ?? [];
	let query = q0 ?? '';
	let isOpen = s0 ?? true;
	let status = st0 ?? 'idle';
	let note = '';

	const report = (name: string) => (e: CustomEvent) => onEvent(name, e.detail);
</script>

{#if which === 'hero'}
	<Hero title="Hello" {...rest} on:primary={report('primary')} on:secondary={report('secondary')}>
		<span slot="media">media</span>
	</Hero>
{:else if which === 'cta'}
	<CtaBanner
		title="Join"
		{...rest}
		on:primary={report('primary')}
		on:secondary={report('secondary')}
	/>
{:else if which === 'pricing'}
	<PricingTable
		bind:interval
		{...rest}
		on:select={report('select')}
		on:intervalchange={report('intervalchange')}
	/>
{:else if which === 'carousel'}
	<TestimonialCarousel bind:index {...rest} on:change={report('change')} />
{:else if which === 'faq'}
	<FaqSection bind:open bind:query {...rest} on:toggle={report('toggle')} />
{:else if which === 'newsletter'}
	<NewsletterSignup {...rest} {status} message={note} on:subscribe={report('subscribe')} />
	<button type="button" on:click={() => (status = 'error')}>Set error</button>
	<button type="button" on:click={() => ((status = 'error'), (note = 'Server down'))}
		>Set error with message</button
	>
	<button type="button" on:click={() => ((status = 'success'), (note = 'Welcome!'))}
		>Set success</button
	>
{:else if which === 'contact'}
	<ContactForm bind:status {...rest} on:send={report('send')} on:reset={report('reset')} />
	<button type="button" on:click={() => (status = 'success')}>Succeed</button>
	<button type="button" on:click={() => (status = 'error')}>Fail</button>
{:else if which === 'announcement'}
	<AnnouncementBar message="News" bind:open={isOpen} {...rest} on:dismiss={report('dismiss')} />
{/if}
<span data-testid="state">{JSON.stringify({ interval, index, open, query, isOpen, status })}</span>
