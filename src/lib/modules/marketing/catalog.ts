import type { ModuleEntry } from '../types';

export const marketingModules: ModuleEntry[] = [
	{
		id: 'hero',
		name: 'Hero',
		group: 'Marketing',
		summary:
			'A headline, lede and up to two calls to action with a media slot, centered or split beside the media.',
		a11y: 'The headline is a heading at a configurable level and labels its section. CTAs with an href are links, otherwise buttons. Split layout stacks below 48rem so nothing scrolls sideways at 320px. Buttons are at least 44px tall.',
		code: 'import { Hero } from \'$lib/modules\';\n\n<Hero title="Ship faster" lede="A starter kit." layout="split" primary={{ label: \'Get started\', href: \'/signup\' }}>\n\t<img slot="media" src="/shot.png" alt="The dashboard" />\n</Hero>'
	},
	{
		id: 'feature-grid',
		name: 'FeatureGrid',
		group: 'Marketing',
		summary: 'Feature cards with an optional icon and link, one, two or three columns by width.',
		a11y: 'A list of cards under a configurable heading level. Icons are decorative (aria-hidden). Link text is extended with the feature title so "Learn more" is never ambiguous out of context.',
		code: "import { FeatureGrid } from '$lib/modules';\n\n<FeatureGrid title=\"Why us\" columns={3} features={[{ title: 'Fast', text: 'Edge rendered.', href: '/fast' }]}>\n\t<span slot=\"icon\">*</span>\n</FeatureGrid>"
	},
	{
		id: 'pricing-table',
		name: 'PricingTable',
		group: 'Marketing',
		summary:
			'Plans with a monthly or annual switch, savings text, a highlighted plan and feature checklists, priced with Intl.',
		a11y: 'The billing switch is a labelled radio group, so arrow keys work natively. Every feature says Included or Not included in text for screen readers. The highlight is a border plus a badge, not colour alone. Plans stack on a phone. Fires select and intervalchange.',
		code: 'import { PricingTable } from \'$lib/modules\';\n\n<PricingTable plans={plans} bind:interval currency="EUR" locale="de-DE" on:select={(e) => choose(e.detail.planId)} />'
	},
	{
		id: 'comparison-table',
		name: 'ComparisonTable',
		group: 'Marketing',
		summary: 'Plans across, features down, as a real table that scrolls inside its own region.',
		a11y: 'A true table with a caption, column and row headers. The scroll region is labelled and focusable so the keyboard can scroll it; the first column is sticky. Ticks and dashes carry Included / Not included text.',
		code: 'import { ComparisonTable } from \'$lib/modules\';\n\n<ComparisonTable caption="Plan comparison" plans={plans} rows={rows} highlight="pro" />'
	},
	{
		id: 'testimonial-carousel',
		name: 'TestimonialCarousel',
		group: 'Marketing',
		summary:
			'Customer quotes one at a time with previous, next, pause and slide buttons, and optional autoplay.',
		a11y: 'Follows the carousel pattern: aria-roledescription, a labelled group per slide. The live region is off while rotating and polite otherwise. Autoplay is opt-in, never runs under reduced motion, and stops on hover, focus or the Pause button.',
		code: "import { TestimonialCarousel } from '$lib/modules';\n\n<TestimonialCarousel items={quotes} autoplay={6000} on:change={(e) => track(e.detail.index)} />"
	},
	{
		id: 'logo-cloud',
		name: 'LogoCloud',
		group: 'Marketing',
		summary: 'A wrapping grid of customer logos. No marquee, nothing moves.',
		a11y: 'Every logo image has the company name as alt text; logos without an image fall back to text. Linked logos are real links. The heading can be visually hidden but stays in the outline.',
		code: "import { LogoCloud } from '$lib/modules';\n\n<LogoCloud logos={[{ name: 'Acme', src: '/acme.svg', href: 'https://acme.test' }]} />"
	},
	{
		id: 'stats-strip',
		name: 'StatsStrip',
		group: 'Marketing',
		summary: 'Big numbers with labels that count up when scrolled into view.',
		a11y: 'A description list. Counting is skipped under reduced motion. The moving number is aria-hidden and the final value is always available as text, so nothing is read half-counted.',
		code: "import { StatsStrip } from '$lib/modules';\n\n<StatsStrip stats={[{ label: 'Customers', value: 12000, suffix: '+' }]} />"
	},
	{
		id: 'faq-section',
		name: 'FaqSection',
		group: 'Marketing',
		summary: 'An accordion of questions with a search box that filters them.',
		a11y: 'Each question is a heading holding a button with aria-expanded and aria-controls. A polite live region reports the match count or that nothing matches, and a visible empty message appears as well. Search matches ignore case and accents.',
		code: "import { FaqSection } from '$lib/modules';\n\n<FaqSection items={faqs} single bind:query on:toggle={(e) => log(e.detail)} />"
	},
	{
		id: 'newsletter-signup',
		name: 'NewsletterSignup',
		group: 'Marketing',
		summary: 'Email, consent and a honeypot, with idle, submitting, success and error states.',
		a11y: 'Invalid input shows errors tied to the field with aria-invalid and aria-describedby, and focus moves to the first. Outcomes are announced by a status live region and focus moves to it on success. The honeypot is hidden from people and assistive technology.',
		code: "import { NewsletterSignup } from '$lib/modules';\n\n<NewsletterSignup status={status} message={note} on:subscribe={(e) => save(e.detail.email)} />"
	},
	{
		id: 'contact-form',
		name: 'ContactForm',
		group: 'Marketing',
		summary:
			'Name, email, topic, message with a live counter, a validation summary and a success state.',
		a11y: 'A failed submit shows an alert summary with links to each field and moves focus to it; each field is tied to its error. The message has a polite character counter. Success replaces the form with a confirmation that takes focus.',
		code: "import { ContactForm } from '$lib/modules';\n\n<ContactForm status={status} on:send={(e) => post(e.detail)} on:reset={() => (status = 'idle')} />"
	},
	{
		id: 'cta-banner',
		name: 'CtaBanner',
		group: 'Marketing',
		summary: 'A closing message with one or two actions.',
		a11y: 'A labelled section with a configurable heading level. Actions are links when given an href, buttons otherwise, and are at least 44px tall.',
		code: "import { CtaBanner } from '$lib/modules';\n\n<CtaBanner title=\"Ready?\" text=\"Start free.\" primary={{ label: 'Sign up', href: '/signup' }} />"
	},
	{
		id: 'site-footer',
		name: 'SiteFooter',
		group: 'Marketing',
		summary: 'Link columns, social links and a legal row that stack on a phone.',
		a11y: 'Each link column, the social group and the legal row is its own labelled nav landmark. Social links are named by network and announce that they open a new tab. Links are at least 44px tall.',
		code: "import { SiteFooter } from '$lib/modules';\n\n<SiteFooter brand=\"Acme\" columns={cols} social={[{ name: 'GitHub', href: 'https://github.com/acme' }]} legal={legal} copyright=\"2026 Acme\" />"
	},
	{
		id: 'announcement-bar',
		name: 'AnnouncementBar',
		group: 'Marketing',
		summary: 'A slim dismissible notice that remembers through a callback, not storage.',
		a11y: 'A labelled aside, not an alert, so it never interrupts. The dismiss button has a name and a 44px target. Dismissing fires dismiss; the app decides whether to remember it and passes open={false} later.',
		code: "import { AnnouncementBar } from '$lib/modules';\n\n<AnnouncementBar message=\"v2 is out.\" link={{ label: 'Read more', href: '/v2' }} on:dismiss={() => remember()} />"
	},
	{
		id: 'team-grid',
		name: 'TeamGrid',
		group: 'Marketing',
		summary: 'People with a picture or initials, role, short bio and links.',
		a11y: 'A list of cards with a heading per person at a configurable level. Avatars fall back to initials and are named. Link names include the person ("Ada on GitHub").',
		code: "import { TeamGrid } from '$lib/modules';\n\n<TeamGrid title=\"The team\" members={[{ name: 'Ada Lovelace', role: 'Engineer', links: [{ label: 'GitHub', href: '#' }] }]} />"
	}
];
