<!-- /modules demos: Marketing. -->
<script lang="ts">
	import {
		AnnouncementBar,
		ComparisonTable,
		ContactForm,
		CtaBanner,
		FaqSection,
		FeatureGrid,
		Hero,
		LogoCloud,
		NewsletterSignup,
		PricingTable,
		SiteFooter,
		StatsStrip,
		TeamGrid,
		TestimonialCarousel,
		type MarketingPlan,
		type PlanInterval
	} from '$lib/modules';
	import ModuleItem from '../ModuleItem.svelte';

	let heroLayout: 'centered' | 'split' = 'centered';
	let heroClicks = 0;

	const features = [
		{
			title: 'Fast by default',
			text: 'Server-rendered at the edge, hydrated only where it matters.',
			href: '#feature-grid'
		},
		{
			title: 'Accessible',
			text: 'Every control is labelled and keyboard-operable out of the box.'
		},
		{
			title: 'Themeable',
			text: 'One set of tokens drives light, dark and high contrast.',
			href: '#feature-grid'
		}
	];

	let interval: PlanInterval = 'monthly';
	let picked = '';
	const plans: MarketingPlan[] = [
		{
			id: 'free',
			name: 'Free',
			description: 'For trying things out.',
			monthly: 0,
			annual: 0,
			features: [
				{ text: '1 project', included: true },
				{ text: 'Community support', included: true },
				{ text: 'Custom domain', included: false }
			]
		},
		{
			id: 'pro',
			name: 'Pro',
			description: 'For growing teams.',
			monthly: 24,
			annual: 240,
			highlighted: true,
			badge: 'Most popular',
			cta: 'Start free trial',
			features: [
				{ text: 'Unlimited projects', included: true },
				{ text: 'Priority support', included: true },
				{ text: 'Custom domain', included: true }
			]
		},
		{
			id: 'team',
			name: 'Team',
			description: 'For whole companies.',
			monthly: 79.5,
			annual: 800,
			features: [
				{ text: 'Unlimited projects', included: true },
				{ text: 'Priority support', included: true },
				{ text: 'Single sign-on', included: true }
			]
		}
	];

	const comparePlans = [
		{ id: 'free', name: 'Free' },
		{ id: 'pro', name: 'Pro' },
		{ id: 'team', name: 'Team' }
	];
	const compareRows = [
		{ label: 'Projects', values: ['1', 'Unlimited', 'Unlimited'] },
		{ label: 'Custom domain', values: [false, true, true] },
		{ label: 'Priority support', values: [false, true, true] },
		{ label: 'Single sign-on', values: [false, false, true] },
		{ label: 'Audit log', values: [false, false, true] }
	];

	const quotes = [
		{
			quote: 'We replaced three tools with this and shipped a month early.',
			name: 'Ada Lovelace',
			role: 'CTO, Analytical Co.'
		},
		{
			quote: 'The accessibility work alone saved us an audit.',
			name: 'Grace Hopper',
			role: 'Head of Product, Compiler Inc.'
		},
		{
			quote: 'Setup took an afternoon. Support answered in minutes.',
			name: 'Alan Turing',
			role: 'Founder, Enigma Labs'
		}
	];
	let slide = 0;

	const logos = ['Acme', 'Globex', 'Initech', 'Umbrella', 'Hooli', 'Stark'].map((name) => ({
		name
	}));

	const stats = [
		{ label: 'Customers', value: 12400, suffix: '+' },
		{ label: 'Uptime', value: 99.98, suffix: '%', decimals: 2 },
		{ label: 'Countries', value: 86 },
		{ label: 'Rating', value: 4.9, decimals: 1, suffix: ' / 5' }
	];

	const faqs = [
		{
			question: 'Can I change plans later?',
			answer: 'Yes. Upgrades apply immediately and downgrades at the end of the billing period.'
		},
		{
			question: 'Is there a free plan?',
			answer: 'Yes, the Free plan is free forever for a single project.'
		},
		{
			question: 'How do I cancel?',
			answer: 'From Settings, Billing. There are no cancellation fees.'
		},
		{ question: 'Do you offer refunds?', answer: 'Annual plans can be refunded within 30 days.' }
	];

	let newsStatus: 'idle' | 'submitting' | 'success' | 'error' = 'idle';
	let newsMessage = '';
	let newsFail = false;
	function subscribe() {
		newsStatus = 'submitting';
		setTimeout(() => {
			newsStatus = newsFail ? 'error' : 'success';
			newsMessage = '';
			newsFail = !newsFail;
		}, 600);
	}

	let contactStatus: 'idle' | 'sending' | 'success' | 'error' = 'idle';
	let contactFail = true;
	function send() {
		contactStatus = 'sending';
		setTimeout(() => {
			contactStatus = contactFail ? 'error' : 'success';
			contactFail = !contactFail;
		}, 600);
	}

	let announceOpen = true;
	let dismissals = 0;

	const footerColumns = [
		{
			title: 'Product',
			links: [
				{ label: 'Features', href: '#feature-grid' },
				{ label: 'Pricing', href: '#pricing-table' }
			]
		},
		{
			title: 'Company',
			links: [
				{ label: 'About', href: '#team-grid' },
				{ label: 'Contact', href: '#contact-form' }
			]
		},
		{
			title: 'Resources',
			links: [
				{ label: 'Docs', href: '/documentation' },
				{ label: 'FAQ', href: '#faq-section' }
			]
		}
	];

	const team = [
		{
			name: 'Ada Lovelace',
			role: 'Engineering',
			bio: 'Builds the engine.',
			links: [{ label: 'GitHub', href: '#team-grid' }]
		},
		{ name: 'Grace Hopper', role: 'Product', links: [{ label: 'Website', href: '#team-grid' }] },
		{ name: 'Alan Turing', role: 'Research', bio: 'Asks the hard questions.' }
	];
</script>

<ModuleItem id="hero">
	<div class="stack">
		<label class="pick">
			Layout
			<select bind:value={heroLayout}>
				<option value="centered">Centered</option>
				<option value="split">Split</option>
			</select>
		</label>
		<Hero
			level={2}
			layout={heroLayout}
			eyebrow="New in v2"
			title="Build the product, not the plumbing"
			lede="A starter kit with auth, billing and a component library already wired up."
			primary={{ label: 'Get started' }}
			secondary={{ label: 'See the demo', href: '#feature-grid' }}
			on:primary={() => (heroClicks += 1)}
		>
			<div slot="media" class="media" role="img" aria-label="Placeholder for a product screenshot">
				Screenshot
			</div>
		</Hero>
		<p class="note" role="status">Primary clicked {heroClicks} times.</p>
	</div>
</ModuleItem>

<ModuleItem id="feature-grid">
	<FeatureGrid title="Why teams choose us" level={4} {features}>
		<span slot="icon">★</span>
	</FeatureGrid>
</ModuleItem>

<ModuleItem id="pricing-table">
	<div class="stack">
		<PricingTable
			title="Simple pricing"
			level={4}
			{plans}
			bind:interval
			on:select={(e) => (picked = `${e.detail.planId} (${e.detail.interval})`)}
		/>
		<p class="note" role="status">Chosen: {picked || 'nothing yet'}</p>
	</div>
</ModuleItem>

<ModuleItem id="comparison-table">
	<ComparisonTable
		caption="Compare plans"
		plans={comparePlans}
		rows={compareRows}
		highlight="pro"
	/>
</ModuleItem>

<ModuleItem id="testimonial-carousel">
	<div class="stack">
		<TestimonialCarousel items={quotes} autoplay={6000} bind:index={slide} />
		<p class="note">Showing {slide + 1} of {quotes.length}. Autoplay stops for reduced motion.</p>
	</div>
</ModuleItem>

<ModuleItem id="logo-cloud">
	<LogoCloud level={4} {logos} />
</ModuleItem>

<ModuleItem id="stats-strip">
	<StatsStrip {stats} />
</ModuleItem>

<ModuleItem id="faq-section">
	<FaqSection level={4} items={faqs} />
</ModuleItem>

<ModuleItem id="newsletter-signup">
	<div class="stack">
		<NewsletterSignup
			level={4}
			status={newsStatus}
			message={newsMessage}
			on:subscribe={subscribe}
		/>
		<p class="note">The first valid submit succeeds, the next one fails, and so on.</p>
		{#if newsStatus === 'success' || newsStatus === 'error'}
			<button type="button" class="link" on:click={() => (newsStatus = 'idle')}>Reset demo</button>
		{/if}
	</div>
</ModuleItem>

<ModuleItem id="contact-form">
	<div class="stack">
		<ContactForm
			level={4}
			status={contactStatus}
			on:send={send}
			on:reset={() => (contactStatus = 'idle')}
		/>
		<p class="note">The first valid send fails, the next succeeds.</p>
	</div>
</ModuleItem>

<ModuleItem id="cta-banner">
	<CtaBanner
		level={4}
		title="Ready to build?"
		text="Start free. No credit card needed."
		primary={{ label: 'Create an account', href: '#cta-banner' }}
		secondary={{ label: 'Talk to sales', href: '#contact-form' }}
	/>
</ModuleItem>

<ModuleItem id="site-footer">
	<SiteFooter
		level={4}
		brand="Acme"
		tagline="Tools for builders."
		columns={footerColumns}
		social={[
			{ name: 'GitHub', href: 'https://github.com', icon: 'GH' },
			{ name: 'Mastodon', href: 'https://mastodon.social', icon: 'M' }
		]}
		legal={[
			{ label: 'Privacy', href: '#site-footer' },
			{ label: 'Terms', href: '#site-footer' }
		]}
		copyright="© 2026 Acme, Inc."
	/>
</ModuleItem>

<ModuleItem id="announcement-bar">
	<div class="stack">
		<AnnouncementBar
			bind:open={announceOpen}
			message="Version 2 is out."
			link={{ label: 'What is new', href: '#announcement-bar' }}
			on:dismiss={() => (dismissals += 1)}
		/>
		<p class="note" role="status">Dismissed {dismissals} times. Nothing is stored.</p>
		{#if !announceOpen}
			<button type="button" class="link" on:click={() => (announceOpen = true)}>Show again</button>
		{/if}
	</div>
</ModuleItem>

<ModuleItem id="team-grid">
	<TeamGrid title="Meet the team" level={4} members={team} />
</ModuleItem>

<style>
	.stack {
		display: grid;
		gap: var(--spacing-md);
		min-width: 0;
	}

	.pick {
		display: inline-grid;
		gap: var(--spacing-xs);
		justify-self: start;
	}

	.media {
		display: grid;
		place-items: center;
		min-block-size: 10rem;
		border: 2px dashed var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-background);
		color: var(--color-text-secondary);
	}

	.note {
		margin: 0;
		color: var(--color-text-secondary);
		font-size: 0.875rem;
	}

	.link {
		justify-self: start;
		min-block-size: 2.75rem;
		padding: 0 var(--spacing-sm);
		border: 0;
		background: none;
		color: var(--color-primary);
		font: inherit;
		text-decoration: underline;
		cursor: pointer;
	}
</style>
