import { fireEvent, render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Harness from '../../../../tests/fixtures/ModulesMarketingHarness.svelte';
import { ComparisonTable, FeatureGrid, LogoCloud, SiteFooter, StatsStrip, TeamGrid } from './index';
import '../test-env';

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

// prettier-ignore
type HarnessKind = 'hero' | 'cta' | 'pricing' | 'carousel' | 'faq' | 'newsletter' | 'contact' | 'announcement';

function harness(which: HarnessKind, props: Record<string, unknown> = {}) {
	const events: [string, unknown][] = [];
	const utils = render(Harness, {
		props: { which, props, onEvent: (n: string, d: unknown) => events.push([n, d]) }
	});
	const state = () => JSON.parse(screen.getByTestId('state').textContent ?? '{}');
	return { ...utils, events, state };
}

describe('Hero', () => {
	it('labels its section with the headline at the chosen level', () => {
		harness('hero', { level: 2, lede: 'Lede', eyebrow: 'New', layout: 'split' });
		const region = screen.getByRole('region', { name: 'Hello' });
		expect(within(region).getByRole('heading', { level: 2, name: 'Hello' })).toBeInTheDocument();
		expect(screen.getByText('Lede')).toBeInTheDocument();
		expect(screen.getByText('New')).toBeInTheDocument();
		expect(screen.getByText('media')).toBeInTheDocument();
		expect(region).toHaveClass('hero--split');
	});

	it('is an h1 by default and omits empty parts', () => {
		harness('hero');
		expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
		expect(screen.queryByRole('button')).toBeNull();
		expect(screen.queryByRole('link')).toBeNull();
	});

	it('renders links for CTAs with an href', () => {
		const { events } = harness('hero', {
			primary: { label: 'Go', href: '/go' },
			secondary: { label: 'More', href: '/more' }
		});
		expect(screen.getByRole('link', { name: 'Go' })).toHaveAttribute('href', '/go');
		expect(screen.getByRole('link', { name: 'More' })).toHaveAttribute('href', '/more');
		expect(events).toEqual([]);
	});

	it('fires events for CTAs without an href', async () => {
		const { events } = harness('hero', {
			primary: { label: 'Go' },
			secondary: { label: 'More' }
		});
		await userEvent.click(screen.getByRole('button', { name: 'Go' }));
		await userEvent.click(screen.getByRole('button', { name: 'More' }));
		expect(events.map((e) => e[0])).toEqual(['primary', 'secondary']);
	});
});

describe('CtaBanner', () => {
	it('names its section and fires events', async () => {
		const { events } = harness('cta', {
			text: 'Free.',
			primary: { label: 'Join now' },
			secondary: { label: 'Talk' }
		});
		expect(screen.getByRole('region', { name: 'Join' })).toBeInTheDocument();
		expect(screen.getByText('Free.')).toBeInTheDocument();
		await userEvent.click(screen.getByRole('button', { name: 'Join now' }));
		await userEvent.click(screen.getByRole('button', { name: 'Talk' }));
		expect(events.map((e) => e[0])).toEqual(['primary', 'secondary']);
	});

	it('uses links for hrefs and nothing when no actions', () => {
		harness('cta', {
			primary: { label: 'A', href: '/a' },
			secondary: { label: 'B', href: '/b' }
		});
		expect(screen.getAllByRole('link')).toHaveLength(2);
	});

	it('renders with no actions', () => {
		harness('cta');
		expect(screen.queryByRole('link')).toBeNull();
	});
});

describe('FeatureGrid', () => {
	const features = [
		{ title: 'Fast', text: 'Quick.', href: '/fast' },
		{ id: 'b', title: 'Safe', text: 'Secure.', href: '/safe', linkLabel: 'Read' },
		{ title: 'Plain', text: 'No link.' }
	];

	it('lists features with headings and links named by feature', () => {
		render(FeatureGrid, { props: { features, title: 'Why', level: 2 } });
		expect(screen.getByRole('heading', { level: 2, name: 'Why' })).toBeInTheDocument();
		expect(screen.getAllByRole('listitem')).toHaveLength(3);
		expect(screen.getByRole('heading', { level: 3, name: 'Fast' })).toBeInTheDocument();
		expect(screen.getByRole('link', { name: /Learn more.*Fast/ })).toHaveAttribute('href', '/fast');
		expect(screen.getByRole('link', { name: /Read.*Safe/ })).toBeInTheDocument();
	});

	it('works without a title, and sets the column class', () => {
		const { container } = render(FeatureGrid, { props: { features, columns: 2 } });
		expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
		expect(container.querySelector('.features__grid--2')).not.toBeNull();
	});
});

const plans = [
	{
		id: 'free',
		name: 'Free',
		monthly: 0,
		annual: 0,
		features: [{ text: 'One project', included: true }]
	},
	{
		id: 'pro',
		name: 'Pro',
		description: 'Teams',
		monthly: 20,
		annual: 192,
		highlighted: true,
		badge: 'Popular',
		cta: 'Try Pro',
		href: '/pro',
		features: [
			{ text: 'Domains', included: true },
			{ text: 'SSO', included: false }
		]
	},
	{ id: 'odd', name: 'Odd', monthly: 15.5, annual: 200, features: [] }
];

describe('PricingTable', () => {
	it('shows monthly prices first, with a labelled switch', () => {
		harness('pricing', { plans, title: 'Plans' });
		expect(screen.getByRole('group', { name: 'Billing period' })).toBeInTheDocument();
		expect(screen.getByRole('radio', { name: 'Monthly' })).toBeChecked();
		expect(screen.getByText('$20')).toBeInTheDocument();
		expect(screen.getByText('$15.50')).toBeInTheDocument();
		expect(screen.getByText('Free', { selector: '.plan__amount' })).toBeInTheDocument();
		expect(screen.getAllByText('Billed monthly')).toHaveLength(2);
		expect(screen.getByText('Save up to 20% with annual billing')).toBeInTheDocument();
		expect(screen.getByRole('heading', { level: 2, name: 'Plans' })).toBeInTheDocument();
		expect(screen.getByRole('heading', { level: 3, name: 'Pro' })).toBeInTheDocument();
	});

	it('switches to annual with savings and reports it', async () => {
		const { events, state } = harness('pricing', { plans });
		await userEvent.click(screen.getByRole('radio', { name: 'Annual' }));
		expect(state().interval).toBe('annual');
		expect(events).toContainEqual(['intervalchange', { interval: 'annual' }]);
		expect(screen.getByText('$16')).toBeInTheDocument();
		expect(screen.getByText('Billed $192 per year')).toBeInTheDocument();
		expect(screen.getByText('Save 20%')).toBeInTheDocument();
	});

	it('does not claim a saving when annual costs more', async () => {
		harness('pricing', {
			plans: [{ id: 'x', name: 'X', monthly: 10, annual: 130, features: [] }],
			interval: 'annual'
		});
		await userEvent.click(screen.getByRole('radio', { name: 'Annual' }));
		expect(screen.queryByText(/^Save \d/)).toBeNull();
		expect(screen.queryByText(/Save up to/)).toBeNull();
	});

	it('gives each feature text a screen-reader status', () => {
		harness('pricing', { plans });
		const li = screen.getByText('SSO').closest('li') as HTMLElement;
		expect(li.textContent).toContain('Not included:');
		const yes = screen.getByText('Domains').closest('li') as HTMLElement;
		expect(yes.textContent).toContain('Included:');
	});

	it('marks the highlighted plan and shows its badge', () => {
		const { container } = harness('pricing', { plans });
		expect(screen.getByText('Popular')).toBeInTheDocument();
		expect(container.querySelectorAll('.plan--highlight')).toHaveLength(1);
	});

	it('renders the CTA as a link with the plan name for assistive tech, and fires select', async () => {
		const { events } = harness('pricing', { plans });
		const link = screen.getByRole('link', { name: /Try Pro/ });
		expect(link).toHaveAttribute('href', '/pro');
		expect(link.textContent).toContain('Pro');
		link.addEventListener('click', (e) => e.preventDefault());
		await userEvent.click(link);
		expect(events).toContainEqual(['select', { planId: 'pro', interval: 'monthly' }]);
		await userEvent.click(screen.getByRole('button', { name: 'Choose Free' }));
		expect(events).toContainEqual(['select', { planId: 'free', interval: 'monthly' }]);
	});

	it('formats in the given currency and locale', () => {
		harness('pricing', { plans: [plans[1]], currency: 'EUR', locale: 'de-DE' });
		expect(screen.getByText(/20\s€/)).toBeInTheDocument();
	});

	it('takes translated labels', () => {
		harness('pricing', {
			plans: [plans[1]],
			labels: {
				billing: 'Facturation',
				monthly: 'Mensuel',
				annual: 'Annuel',
				perMonth: '/ mois',
				free: 'Gratuit',
				billedMonthly: 'Mensuel',
				billedAnnually: (t: string) => t,
				save: () => '',
				saveUpTo: () => '',
				included: 'Oui :',
				excluded: 'Non :',
				choose: (n: string) => n
			}
		});
		expect(screen.getByRole('group', { name: 'Facturation' })).toBeInTheDocument();
		expect(screen.getByText('/ mois')).toBeInTheDocument();
	});
});

describe('ComparisonTable', () => {
	const props = {
		caption: 'Compare',
		plans: [
			{ id: 'a', name: 'Starter' },
			{ id: 'b', name: 'Pro' }
		],
		rows: [
			{ label: 'Seats', values: ['1', 'Unlimited'] },
			{ id: 'sso', label: 'SSO', values: [false, true] },
			{ label: 'Short', values: [true] }
		],
		highlight: 'b'
	};

	it('is a real table in a labelled, focusable region', () => {
		render(ComparisonTable, { props });
		const region = screen.getByRole('region', { name: 'Compare' });
		expect(region).toHaveAttribute('tabindex', '0');
		const table = within(region).getByRole('table', { name: 'Compare' });
		expect(
			within(table)
				.getAllByRole('columnheader')
				.map((h) => h.textContent)
		).toEqual(['Feature', 'Starter', 'Pro']);
		expect(within(table).getByRole('rowheader', { name: 'SSO' })).toBeInTheDocument();
		expect(within(table).getByText('Unlimited')).toBeInTheDocument();
	});

	it('says included and not included in text, including for missing cells', () => {
		render(ComparisonTable, { props });
		const row = screen.getByRole('row', { name: /SSO/ });
		expect(row.textContent).toContain('Not included');
		expect(row.textContent).toContain('Included');
		expect(screen.getByRole('row', { name: /Short/ }).textContent).toContain('Not included');
	});

	it('uses a custom region label and highlights a column', () => {
		const { container } = render(ComparisonTable, {
			props: { ...props, regionLabel: 'Scroll me' }
		});
		expect(screen.getByRole('region', { name: 'Scroll me' })).toBeInTheDocument();
		expect(container.querySelectorAll('th.hl').length).toBe(1);
	});
});

describe('TestimonialCarousel', () => {
	const items = [
		{ quote: 'One', name: 'Ann Lee', role: 'CEO' },
		{ quote: 'Two', name: 'Bob Ray' },
		{ quote: 'Three', name: 'Cy Fox', avatar: '/cy.png' }
	];

	it('is a labelled carousel showing one slide', () => {
		harness('carousel', { items });
		const carousel = screen.getByRole('region', { name: 'Customer testimonials' });
		expect(carousel).toHaveAttribute('aria-roledescription', 'carousel');
		expect(document.querySelectorAll('[aria-roledescription="slide"]')).toHaveLength(3);
		expect(screen.getByText('One')).toBeVisible();
		expect(screen.getByText('Two')).not.toBeVisible();
		expect(screen.getByText('CEO')).toBeInTheDocument();
	});

	it('steps with next and previous, wrapping, and reports changes', async () => {
		const { events, state } = harness('carousel', { items });
		await userEvent.click(screen.getByRole('button', { name: 'Next testimonial' }));
		expect(state().index).toBe(1);
		expect(screen.getByText('Two')).toBeVisible();
		await userEvent.click(screen.getByRole('button', { name: 'Previous testimonial' }));
		await userEvent.click(screen.getByRole('button', { name: 'Previous testimonial' }));
		expect(state().index).toBe(2);
		expect(events.at(-1)).toEqual(['change', { index: 2 }]);
	});

	it('jumps with the dots and marks the current one', async () => {
		const { state } = harness('carousel', { items });
		const dot = screen.getByRole('button', { name: 'Show testimonial 3' });
		await userEvent.click(dot);
		expect(state().index).toBe(2);
		expect(dot).toHaveAttribute('aria-current', 'true');
		expect(screen.getByRole('button', { name: 'Show testimonial 1' })).not.toHaveAttribute(
			'aria-current'
		);
	});

	it('has no controls for a single slide', () => {
		harness('carousel', { items: [items[0]] });
		expect(screen.queryByRole('button')).toBeNull();
	});

	it('does not autoplay by default and has no pause button', () => {
		harness('carousel', { items });
		expect(screen.queryByRole('button', { name: /rotation/ })).toBeNull();
		expect(document.querySelector('.slides')).toHaveAttribute('aria-live', 'polite');
	});

	it('autoplays with the live region off, and pauses on request', async () => {
		vi.useFakeTimers();
		const { state } = harness('carousel', { items, autoplay: 1000, reducedMotion: false });
		await tick();
		expect(document.querySelector('.slides')).toHaveAttribute('aria-live', 'off');
		await vi.advanceTimersByTimeAsync(1000);
		expect(state().index).toBe(1);
		const pause = screen.getByRole('button', { name: 'Pause rotation' });
		await fireEvent.click(pause);
		expect(pause).toHaveAttribute('aria-pressed', 'true');
		expect(screen.getByRole('button', { name: 'Start rotation' })).toBe(pause);
		expect(document.querySelector('.slides')).toHaveAttribute('aria-live', 'polite');
		await vi.advanceTimersByTimeAsync(3000);
		expect(state().index).toBe(1);
		await fireEvent.click(pause);
		await vi.advanceTimersByTimeAsync(1000);
		expect(state().index).toBe(2);
	});

	it('stops while the pointer or focus is inside', async () => {
		vi.useFakeTimers();
		const { state } = harness('carousel', { items, autoplay: 1000, reducedMotion: false });
		const region = screen.getByRole('region', { name: 'Customer testimonials' });
		await fireEvent.mouseEnter(region);
		await vi.advanceTimersByTimeAsync(2500);
		expect(state().index).toBe(0);
		await fireEvent.mouseLeave(region);
		await vi.advanceTimersByTimeAsync(1000);
		expect(state().index).toBe(1);
		const next = screen.getByRole('button', { name: 'Next testimonial' });
		await fireEvent.focusIn(next);
		await vi.advanceTimersByTimeAsync(2500);
		expect(state().index).toBe(1);
		await fireEvent.focusOut(next, { relatedTarget: document.body });
		await vi.advanceTimersByTimeAsync(1000);
		expect(state().index).toBe(2);
		await fireEvent.focusIn(next);
		await fireEvent.focusOut(next, {
			relatedTarget: screen.getByRole('button', { name: 'Show testimonial 1' })
		});
		await vi.advanceTimersByTimeAsync(2500);
		expect(state().index).toBe(2);
	});

	it('never autoplays under reduced motion', async () => {
		vi.useFakeTimers();
		const { state } = harness('carousel', { items, autoplay: 1000, reducedMotion: true });
		await vi.advanceTimersByTimeAsync(5000);
		expect(state().index).toBe(0);
		expect(screen.queryByRole('button', { name: /rotation/ })).toBeNull();
	});

	it('follows the visitor setting and its changes when not forced', async () => {
		let listener: () => void = () => {};
		const mq = {
			matches: true,
			addEventListener: (_: string, fn: () => void) => (listener = fn),
			removeEventListener: vi.fn()
		};
		vi.stubGlobal('matchMedia', () => mq);
		window.matchMedia = () => mq as unknown as MediaQueryList;
		const { unmount } = harness('carousel', { items, autoplay: 1000 });
		await tick();
		expect(screen.queryByRole('button', { name: /rotation/ })).toBeNull();
		mq.matches = false;
		listener();
		await tick();
		expect(screen.getByRole('button', { name: 'Pause rotation' })).toBeInTheDocument();
		unmount();
		expect(mq.removeEventListener).toHaveBeenCalled();
	});
});

describe('LogoCloud', () => {
	it('gives every image its company name as alt, and falls back to text', () => {
		render(LogoCloud, {
			props: {
				logos: [
					{ name: 'Acme', src: '/acme.svg', width: 80, height: 24 },
					{ name: 'Globex', src: '/g.svg', href: '/globex' },
					{ name: 'Initech', href: '/init' },
					{ name: 'Hooli' }
				]
			}
		});
		expect(
			screen.getByRole('heading', { level: 2, name: 'Trusted by teams at' })
		).toBeInTheDocument();
		expect(screen.getByRole('img', { name: 'Acme' })).toHaveAttribute('src', '/acme.svg');
		expect(screen.getByRole('link', { name: 'Globex' })).toHaveAttribute('href', '/globex');
		expect(screen.getByRole('link', { name: 'Initech' })).toBeInTheDocument();
		expect(screen.getByText('Hooli')).toBeInTheDocument();
		expect(screen.getAllByRole('listitem')).toHaveLength(4);
	});

	it('can hide the title visually and change its level', () => {
		render(LogoCloud, { props: { logos: [], hideTitle: true, level: 3, title: 'Partners' } });
		const h = screen.getByRole('heading', { level: 3, name: 'Partners' });
		expect(h).toHaveClass('sr-only');
	});
});

describe('StatsStrip', () => {
	const stats = [
		{ label: 'Customers', value: 12000, suffix: '+' },
		{ label: 'Uptime', value: 99.9, decimals: 1, suffix: '%' },
		{ label: 'Money', value: 5, prefix: '$', compact: true }
	];

	it('shows final values at once under reduced motion', () => {
		render(StatsStrip, { props: { stats, reducedMotion: true } });
		expect(screen.getByRole('region', { name: 'Key figures' })).toBeInTheDocument();
		expect(screen.getByText('12,000+')).toBeInTheDocument();
		expect(screen.getByText('99.9%')).toBeInTheDocument();
		expect(screen.getByText('$5')).toBeInTheDocument();
		const terms = screen.getAllByRole('term').map((t) => t.textContent);
		expect(terms).toEqual(['Customers', 'Uptime', 'Money']);
		expect(screen.getAllByRole('definition')).toHaveLength(3);
	});

	it('shows final values when the browser cannot observe visibility only if reduced', () => {
		vi.stubGlobal('IntersectionObserver', undefined);
		const frames: FrameRequestCallback[] = [];
		vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
		vi.stubGlobal('cancelAnimationFrame', () => {});
		vi.spyOn(performance, 'now').mockReturnValue(0);
		const { unmount } = render(StatsStrip, {
			props: { stats, reducedMotion: false, duration: 1000 }
		});
		expect(frames.length).toBe(1);
		unmount();
	});

	it('counts up when scrolled into view, hiding the moving number from assistive tech', async () => {
		let observe: (entries: { isIntersecting: boolean }[]) => void = () => {};
		const disconnect = vi.fn();
		class IO {
			constructor(cb: typeof observe) {
				observe = cb;
			}
			observe() {}
			disconnect = disconnect;
		}
		vi.stubGlobal('IntersectionObserver', IO);
		const frames: FrameRequestCallback[] = [];
		vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
		vi.stubGlobal('cancelAnimationFrame', vi.fn());
		vi.spyOn(performance, 'now').mockReturnValue(1000);
		const { container } = render(StatsStrip, {
			props: { stats: [stats[0]], reducedMotion: false, duration: 1000 }
		});
		await tick();
		const value = () => container.querySelector('dd span[aria-hidden]')?.textContent;
		expect(value()).toBe('0+');
		expect(container.querySelector('dd .sr-only')?.textContent).toBe('12,000+');
		observe([{ isIntersecting: false }]);
		expect(frames.length).toBe(0);
		observe([{ isIntersecting: true }]);
		observe([{ isIntersecting: true }]);
		expect(frames.length).toBe(1);
		frames[0](1500);
		await tick();
		expect(value()).toBe('10,500+');
		frames[1](2000);
		await tick();
		expect(container.querySelector('dd span[aria-hidden]')).toBeNull();
		expect(screen.getByText('12,000+')).toBeInTheDocument();
		expect(disconnect).toHaveBeenCalled();
	});
});

describe('FaqSection', () => {
	const items = [
		{ question: 'Can I cancel?', answer: 'Anytime.' },
		{ id: 'refund', question: 'Refunds?', answer: 'Within thirty days.' },
		{ question: 'Is there a free plan?', answer: 'Yes.' }
	];

	it('renders collapsed questions as buttons with aria-expanded and aria-controls', () => {
		harness('faq', { items, level: 2 });
		expect(
			screen.getByRole('heading', { level: 2, name: 'Frequently asked questions' })
		).toBeInTheDocument();
		const button = screen.getByRole('button', { name: /Can I cancel/ });
		expect(button).toHaveAttribute('aria-expanded', 'false');
		const panel = document.getElementById(button.getAttribute('aria-controls') as string);
		expect(panel).not.toBeVisible();
		expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(3);
	});

	it('opens and closes with the keyboard and reports toggles', async () => {
		const { events, state } = harness('faq', { items });
		const button = screen.getByRole('button', { name: /Refunds/ });
		button.focus();
		await userEvent.keyboard('{Enter}');
		expect(button).toHaveAttribute('aria-expanded', 'true');
		expect(screen.getByText('Within thirty days.')).toBeVisible();
		expect(state().open).toEqual(['refund']);
		expect(events.at(-1)).toEqual(['toggle', { id: 'refund', open: true }]);
		await userEvent.keyboard(' ');
		expect(button).toHaveAttribute('aria-expanded', 'false');
		expect(events.at(-1)).toEqual(['toggle', { id: 'refund', open: false }]);
	});

	it('keeps one open in single mode', async () => {
		harness('faq', { items, single: true });
		const a = screen.getByRole('button', { name: /Can I cancel/ });
		const b = screen.getByRole('button', { name: /Refunds/ });
		await userEvent.click(a);
		await userEvent.click(b);
		expect(a).toHaveAttribute('aria-expanded', 'false');
		expect(b).toHaveAttribute('aria-expanded', 'true');
	});

	it('filters by search and announces the count', async () => {
		harness('faq', { items });
		await userEvent.type(screen.getByRole('searchbox', { name: 'Search questions' }), 'free');
		expect(screen.getAllByRole('button', { name: /plan|cancel|Refunds/ })).toHaveLength(1);
		expect(screen.getByRole('status')).toHaveTextContent('1 question matches.');
	});

	it('shows and announces a no-results message', async () => {
		harness('faq', { items });
		await userEvent.type(screen.getByRole('searchbox'), 'zzz');
		expect(screen.queryAllByRole('button')).toHaveLength(0);
		expect(screen.getByRole('status')).toHaveTextContent('No questions match "zzz".');
		expect(
			screen.getByText('No questions match "zzz".', { selector: 'p.faq__none' })
		).toBeInTheDocument();
	});

	it('can drop the search box', () => {
		harness('faq', { items, searchable: false });
		expect(screen.queryByRole('searchbox')).toBeNull();
	});
});

describe('NewsletterSignup', () => {
	it('shows errors tied to fields and focuses the email', async () => {
		const { events } = harness('newsletter');
		await userEvent.click(screen.getByRole('button', { name: 'Subscribe' }));
		const email = screen.getByRole('textbox', { name: /Email address/ });
		expect(email).toHaveAttribute('aria-invalid', 'true');
		expect(email).toHaveAccessibleDescription('This field is required.');
		expect(email).toHaveFocus();
		expect(screen.getByRole('group', { name: /agree/ })).toHaveAccessibleDescription(
			'Please agree to continue.'
		);
		expect(events).toEqual([]);
	});

	it('focuses the checkbox when only consent is missing', async () => {
		harness('newsletter');
		await userEvent.type(screen.getByRole('textbox', { name: /Email/ }), 'a@b.co');
		await userEvent.click(screen.getByRole('button', { name: 'Subscribe' }));
		expect(screen.getByRole('checkbox')).toHaveFocus();
	});

	it('rejects a malformed email', async () => {
		harness('newsletter', { requireConsent: false });
		await userEvent.type(screen.getByRole('textbox', { name: /Email/ }), 'nope');
		await userEvent.click(screen.getByRole('button', { name: 'Subscribe' }));
		expect(screen.getByRole('textbox', { name: /Email/ })).toHaveAccessibleDescription(
			'Enter a valid email address.'
		);
		expect(screen.queryByRole('checkbox')).toBeNull();
	});

	it('fires subscribe with a trimmed email on a valid submit', async () => {
		const { events } = harness('newsletter');
		await userEvent.type(screen.getByRole('textbox', { name: /Email/ }), ' a@b.co ');
		await userEvent.click(screen.getByRole('checkbox'));
		await userEvent.click(screen.getByRole('button', { name: 'Subscribe' }));
		expect(events).toEqual([['subscribe', { email: 'a@b.co', consent: true }]]);
	});

	it('fakes success for bots without firing anything', async () => {
		const { events, container } = harness('newsletter');
		await userEvent.type(screen.getByRole('textbox', { name: /Email/ }), 'a@b.co');
		await userEvent.click(screen.getByRole('checkbox'));
		const trap = container.querySelector('input[name="website"]') as HTMLInputElement;
		expect(trap.closest('[aria-hidden="true"]')).not.toBeNull();
		expect(trap).toHaveAttribute('tabindex', '-1');
		await fireEvent.input(trap, { target: { value: 'spam' } });
		await userEvent.click(screen.getByRole('button', { name: 'Subscribe' }));
		expect(events).toEqual([]);
		expect(screen.getByRole('status')).toHaveTextContent('Thanks. Check your inbox to confirm.');
		expect(screen.queryByRole('button', { name: 'Subscribe' })).toBeNull();
	});

	it('announces success and error states from the app', async () => {
		harness('newsletter');
		expect(screen.getByRole('status')).toBeEmptyDOMElement();
		await userEvent.click(screen.getByRole('button', { name: 'Set error' }));
		expect(screen.getByRole('status')).toHaveTextContent('Something went wrong');
		await userEvent.click(screen.getByRole('button', { name: 'Set error with message' }));
		expect(screen.getByRole('status')).toHaveTextContent('Server down');
		await userEvent.click(screen.getByRole('button', { name: 'Set success' }));
		expect(screen.getByRole('status')).toHaveTextContent('Welcome!');
		await tick();
		expect(screen.getByRole('status')).toHaveFocus();
	});

	it('falls back to the default success text', () => {
		harness('newsletter', { status: 'success' });
		expect(screen.getByRole('status')).toHaveTextContent('Thanks. Check your inbox');
	});

	it('shows a busy submit button while submitting', () => {
		harness('newsletter', { status: 'submitting' });
		expect(screen.getByRole('button', { name: 'Subscribe' })).toHaveAttribute('aria-busy', 'true');
		expect(screen.getByRole('textbox', { name: /Email/ })).toBeDisabled();
	});
});

describe('ContactForm', () => {
	async function fill(over: Record<string, string> = {}) {
		const v = { name: 'Ada', email: 'ada@x.io', message: 'Hello there, friend.', ...over };
		if (v.name) await userEvent.type(screen.getByRole('textbox', { name: /Your name/ }), v.name);
		if (v.email) await userEvent.type(screen.getByRole('textbox', { name: /Email/ }), v.email);
		await userEvent.selectOptions(
			screen.getByRole('combobox', { name: /Topic/ }),
			over.topic ?? 'sales'
		);
		if (v.message)
			await userEvent.type(screen.getByRole('textbox', { name: /Message/ }), v.message);
	}

	it('has autocomplete on its fields and a live counter', async () => {
		harness('contact', { maxMessage: 50 });
		expect(screen.getByRole('textbox', { name: /Your name/ })).toHaveAttribute(
			'autocomplete',
			'name'
		);
		expect(screen.getByRole('textbox', { name: /Email/ })).toHaveAttribute('autocomplete', 'email');
		expect(screen.getByText('0 / 50')).toBeInTheDocument();
		await userEvent.type(screen.getByRole('textbox', { name: /Message/ }), 'abc');
		expect(screen.getByText('3 / 50')).toBeInTheDocument();
	});

	it('summarises errors in an alert, focuses it, and links to fields', async () => {
		const { events } = harness('contact');
		await userEvent.click(screen.getByRole('button', { name: 'Send message' }));
		const alert = screen.getByRole('alert');
		expect(alert).toHaveFocus();
		expect(alert).toHaveTextContent('Fix 4 problems to continue:');
		expect(within(alert).getAllByRole('link')).toHaveLength(4);
		expect(screen.getByRole('textbox', { name: /Your name/ })).toHaveAttribute(
			'aria-invalid',
			'true'
		);
		expect(events).toEqual([]);
		await userEvent.click(within(alert).getAllByRole('link')[1]);
		expect(screen.getByRole('textbox', { name: /Email/ })).toHaveFocus();
	});

	it('uses the singular summary and clears errors as they are fixed', async () => {
		harness('contact');
		await fill({ name: '' });
		await userEvent.click(screen.getByRole('button', { name: 'Send message' }));
		expect(screen.getByRole('alert')).toHaveTextContent('Fix 1 problem to continue:');
		await userEvent.type(screen.getByRole('textbox', { name: /Your name/ }), 'Ada');
		expect(screen.queryByRole('alert')).toBeNull();
	});

	it('sends the values when valid', async () => {
		const { events } = harness('contact');
		await fill();
		await userEvent.click(screen.getByRole('button', { name: 'Send message' }));
		expect(events).toEqual([
			['send', { name: 'Ada', email: 'ada@x.io', topic: 'sales', message: 'Hello there, friend.' }]
		]);
	});

	it('shows a server error as an alert, busy state while sending', async () => {
		harness('contact', { status: 'error', errorMessage: 'Mail is down' });
		expect(screen.getByRole('alert')).toHaveTextContent('Mail is down');
		await userEvent.click(screen.getByRole('button', { name: 'Fail' }));
		expect(screen.getByRole('alert')).toHaveTextContent('Mail is down');
	});

	it('falls back to the default error text and shows busy while sending', () => {
		harness('contact', { status: 'error' });
		expect(screen.getByRole('alert')).toHaveTextContent('could not be sent');
	});

	it('shows busy when sending', () => {
		harness('contact', { status: 'sending' });
		expect(screen.getByRole('button', { name: 'Send message' })).toHaveAttribute(
			'aria-busy',
			'true'
		);
	});

	it('swaps to a focused success state that can reset', async () => {
		const { events } = harness('contact');
		await userEvent.click(screen.getByRole('button', { name: 'Succeed' }));
		await tick();
		const status = screen.getByRole('status');
		expect(status).toHaveTextContent('Message sent');
		expect(status).toHaveFocus();
		expect(screen.queryByRole('textbox')).toBeNull();
		await userEvent.click(screen.getByRole('button', { name: 'Send another message' }));
		expect(events.at(-1)).toEqual(['reset', null]);
	});
});

describe('SiteFooter', () => {
	const props = {
		brand: 'Acme',
		tagline: 'Tools.',
		columns: [
			{ title: 'Product', links: [{ label: 'Pricing', href: '/pricing' }] },
			{ title: 'Company', links: [{ label: 'About', href: '/about' }] }
		],
		social: [
			{ name: 'GitHub', href: 'https://github.com/acme', icon: 'GH' },
			{ name: 'Mastodon', href: 'https://m.social/acme' }
		],
		legal: [{ label: 'Privacy', href: '/privacy' }],
		copyright: '2026 Acme'
	};

	it('gives each column its own nav landmark', () => {
		render(SiteFooter, { props });
		expect(screen.getByRole('contentinfo')).toBeInTheDocument();
		const product = screen.getByRole('navigation', { name: 'Product' });
		expect(within(product).getByRole('link', { name: 'Pricing' })).toHaveAttribute(
			'href',
			'/pricing'
		);
		expect(screen.getByRole('navigation', { name: 'Company' })).toBeInTheDocument();
		expect(screen.getByRole('navigation', { name: 'Social media' })).toBeInTheDocument();
		expect(screen.getByRole('navigation', { name: 'Legal' })).toBeInTheDocument();
		expect(screen.getByRole('heading', { level: 2, name: 'Product' })).toBeInTheDocument();
		expect(screen.getByText('Acme')).toBeInTheDocument();
		expect(screen.getByText('Tools.')).toBeInTheDocument();
		expect(screen.getByText('2026 Acme')).toBeInTheDocument();
	});

	it('names social links and warns about new tabs', () => {
		render(SiteFooter, { props });
		const gh = screen.getByRole('link', { name: /GitHub/ });
		expect(gh).toHaveAttribute('target', '_blank');
		expect(gh).toHaveAttribute('rel', 'noopener noreferrer');
		expect(gh).toHaveAccessibleName('GitHub (opens in a new tab)');
		expect(screen.getByRole('link', { name: /Mastodon/ })).toBeInTheDocument();
	});

	it('leaves out empty sections', () => {
		render(SiteFooter, { props: {} });
		expect(screen.queryAllByRole('navigation')).toHaveLength(0);
		expect(screen.getByRole('contentinfo')).toBeInTheDocument();
	});

	it('shows only a brand when there is no tagline, and only a tagline otherwise', () => {
		const { unmount } = render(SiteFooter, { props: { brand: 'Solo' } });
		expect(screen.getByText('Solo')).toBeInTheDocument();
		unmount();
		render(SiteFooter, { props: { tagline: 'Just words' } });
		expect(screen.getByText('Just words')).toBeInTheDocument();
	});
});

describe('AnnouncementBar', () => {
	it('is a labelled aside with a link', () => {
		harness('announcement', { link: { label: 'Read', href: '/news' } });
		const bar = screen.getByRole('complementary', { name: 'Announcement' });
		expect(within(bar).getByRole('link', { name: 'Read' })).toHaveAttribute('href', '/news');
	});

	it('dismisses through a callback and stores nothing', async () => {
		const setItem = vi.spyOn(Storage.prototype, 'setItem');
		const { events, state } = harness('announcement');
		await userEvent.click(screen.getByRole('button', { name: 'Dismiss announcement' }));
		expect(screen.queryByRole('complementary')).toBeNull();
		expect(state().isOpen).toBe(false);
		expect(events).toEqual([['dismiss', null]]);
		expect(setItem).not.toHaveBeenCalled();
		setItem.mockRestore();
	});

	it('can be permanent or start closed', () => {
		const { unmount } = harness('announcement', { dismissible: false });
		expect(screen.queryByRole('button')).toBeNull();
		unmount();
		harness('announcement', { isOpen: false });
		expect(screen.queryByRole('complementary')).toBeNull();
	});
});

describe('TeamGrid', () => {
	const members = [
		{
			name: 'Ada Lovelace',
			role: 'Engineer',
			bio: 'Builds.',
			links: [{ label: 'GitHub', href: '/ada' }]
		},
		{ name: 'Alan Turing', role: 'Research', avatar: '/alan.png', links: [] },
		{ name: 'Grace Hopper', role: 'Product' }
	];

	it('lists people with headings, roles and descriptive links', () => {
		render(TeamGrid, { props: { members, title: 'Team', level: 2 } });
		expect(screen.getByRole('heading', { level: 2, name: 'Team' })).toBeInTheDocument();
		expect(screen.getByRole('heading', { level: 3, name: 'Ada Lovelace' })).toBeInTheDocument();
		expect(screen.getByText('Engineer')).toBeInTheDocument();
		expect(screen.getByText('Builds.')).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Ada Lovelace on GitHub' })).toHaveAttribute(
			'href',
			'/ada'
		);
		expect(screen.getAllByRole('link')).toHaveLength(1);
	});

	it('works without a title and with a custom link name', () => {
		render(TeamGrid, {
			props: { members, columns: 4, linkName: (l: string, p: string) => `${l} de ${p}` }
		});
		expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
		expect(screen.getByRole('link', { name: 'GitHub de Ada Lovelace' })).toBeInTheDocument();
	});
});
