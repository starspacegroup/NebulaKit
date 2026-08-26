import { render, screen, within } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Page from '../../src/routes/documentation/+page.svelte';

describe('Documentation Page', () => {
	it('renders the primary documentation heading and intro', () => {
		render(Page);
		expect(screen.getByRole('heading', { name: /NebulaKit documentation/i })).toBeInTheDocument();
		expect(
			screen.getByText(/single source of truth for setup, development, and deployment/i)
		).toBeInTheDocument();
	});

	it('includes beginner-friendly start sections', () => {
		render(Page);
		expect(screen.getByRole('heading', { name: /Start Here/i })).toBeInTheDocument();
		expect(
			screen.getByRole('heading', { name: /What You Get Out of the Box/i })
		).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: /How To Use the App/i })).toBeInTheDocument();
		expect(
			screen.getByRole('heading', { name: /Working With AI in This Repo/i })
		).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: /Quick Start/i })).toBeInTheDocument();
		expect(
			screen.getByRole('heading', { name: /Deployment to Cloudflare Pages/i })
		).toBeInTheDocument();
	});

	it('documents core product features and operator workflows', () => {
		render(Page);

		expect(screen.getByText(/keyboard-first navigation with command palette/i)).toBeInTheDocument();
		expect(screen.getByText(/open the command palette with ctrl\/cmd \+ k/i)).toBeInTheDocument();
		expect(screen.getByText(/chat exposes only enabled entries/i)).toBeInTheDocument();
		expect(
			screen.getByText(/before expecting sign-in or ai features to work/i)
		).toBeInTheDocument();
	});

	it('uses Bun as the sole package manager in quick start', () => {
		render(Page);
		const quickStartSection = screen
			.getByRole('heading', { name: /Quick Start/i })
			.closest('section');

		expect(quickStartSection).toBeTruthy();

		const scoped = within(quickStartSection as HTMLElement);

		expect(scoped.getByText(/is the recommended default for this repo/i)).toBeInTheDocument();
		expect(scoped.getByRole('link', { name: /^bun$/i })).toHaveAttribute('href', 'https://bun.sh');
		expect(scoped.getByText(/install dependencies/i)).toBeInTheDocument();
		expect(scoped.getAllByText(/^bun$/i).length).toBeGreaterThan(0);
		expect(scoped.getByText(/^install$/i)).toBeInTheDocument();
		expect(scoped.getByText(/^run dev$/i)).toBeInTheDocument();
		expect(quickStartSection?.textContent).not.toMatch(/\bnpm\b/i);
	});

	it('explains how to use ai assistance safely in this repository', () => {
		render(Page);

		expect(
			screen.getByText(/treat ai as a fast pair programmer, not as a source of truth/i)
		).toBeInTheDocument();
		expect(
			screen.getByText(/point the assistant at a concrete file, route, failing test, or command/i)
		).toBeInTheDocument();
		expect(screen.getByText(/ask it to write or update tests first/i)).toBeInTheDocument();
		expect(
			screen.getByText(/always finish by running check, tests, and coverage/i)
		).toBeInTheDocument();
	});

	it('documents the admin analytics surface and its privacy stance', () => {
		render(Page);

		const statsSection = screen
			.getByRole('heading', { name: /Admin Analytics/i })
			.closest('section');
		expect(statsSection).toBeTruthy();

		const scoped = within(statsSection as HTMLElement);

		expect(scoped.getAllByText(/\/admin\/stats/i).length).toBeGreaterThan(0);
		// The privacy posture is the reason this ships instead of a GA tag, so it
		// has to be stated on the page users actually read.
		expect(
			scoped.getByText(/no cookies, no identifiers, and no IP addresses/i)
		).toBeInTheDocument();
		expect(scoped.getAllByText(/can_view_stats/i).length).toBeGreaterThan(0);
		expect(scoped.getAllByText(/CRON_SECRET/i).length).toBeGreaterThan(0);
		// content_view_daily is the only counter that grows with the catalogue, so
		// an operator has to be told before they turn it on, not after.
		expect(scoped.getAllByText(/Top content/i).length).toBeGreaterThan(0);
		expect(
			scoped.getByText(/grows with your catalogue rather than with a fixed list/i)
		).toBeInTheDocument();
	});

	it('lists analytics among the out-of-the-box capabilities', () => {
		render(Page);

		// The bullet wraps the route in <code>, so match on the element's whole
		// text rather than a single text node.
		expect(
			screen.getByText((_content, element) => {
				if (element?.tagName !== 'LI') return false;
				return /first-party, cookie-free analytics at\s*\/admin\/stats/i.test(
					element.textContent ?? ''
				);
			})
		).toBeInTheDocument();
	});

	it('documents migration workflow with immutable migration guidance', () => {
		render(Page);
		expect(screen.getByRole('heading', { name: /Database Migrations/i })).toBeInTheDocument();
		expect(screen.getByText(/never edit or delete existing migration files/i)).toBeInTheDocument();
		expect(screen.getAllByText(/db:migrate:local/i).length).toBeGreaterThan(0);
	});

	it('contains links to key project docs and repository', () => {
		render(Page);

		expect(screen.getByRole('link', { name: /README/i })).toHaveAttribute(
			'href',
			'https://github.com/starspacegroup/NebulaKit/blob/main/README.md'
		);
		expect(screen.getByRole('link', { name: /Contributing Guide/i })).toHaveAttribute(
			'href',
			'https://github.com/starspacegroup/NebulaKit/blob/main/CONTRIBUTING.md'
		);
		expect(screen.getByRole('link', { name: /GitHub repository/i })).toHaveAttribute(
			'href',
			'https://github.com/starspacegroup/NebulaKit'
		);
	});

	it('renders a main landmark and section navigation', () => {
		render(Page);
		expect(document.querySelector('main')).toBeInTheDocument();
		expect(
			screen.getByRole('navigation', { name: /documentation navigation/i })
		).toBeInTheDocument();
	});

	// The widget board shipped without a word about it here, and the nav had no way
	// to reach it. Every anchor in the nav must land on a real section, or the page
	// promises content it does not have.
	describe('drag and drop section', () => {
		it('documents the board, its keyboard control, and the inert-state rule', () => {
			render(Page);
			const section = screen
				.getByRole('heading', { name: /^drag and drop$/i })
				.closest('section') as HTMLElement;

			expect(section).toBeTruthy();
			expect(section.id).toBe('drag-and-drop');
			expect(section.textContent).toMatch(/WidgetBoard/);
			expect(section.textContent).toMatch(/use:draggable/);
			expect(section.textContent).toMatch(/arrow up and down/i);
			expect(section.textContent).toMatch(/must never be written into/i);
		});

		it('points every navigation anchor at a section that exists', () => {
			render(Page);
			const nav = screen.getByRole('navigation', { name: /documentation navigation/i });
			const anchors = Array.from(nav.querySelectorAll('a[href^="#"]'));

			expect(anchors.length).toBeGreaterThan(0);
			for (const anchor of anchors) {
				const id = anchor.getAttribute('href')!.slice(1);
				expect(document.getElementById(id), `#${id} has no section`).toBeTruthy();
			}
		});
	});

	// AGENTS.md §7 — this page shipped a claim that auth runs on @auth/sveltekit.
	// It never did: sessions are issued by this app (src/lib/utils/session.ts) and
	// the OAuth callbacks are hand-written under src/routes/api/auth/. The package
	// was an unused dependency, so the docs pointed operators at a library that was
	// not in the request path. Pin the accurate description down.
	describe('authentication section', () => {
		it('describes the built-in session auth rather than naming an auth library', () => {
			render(Page);

			const section = screen
				.getByRole('heading', { name: /Authentication and Setup Flow/i })
				.closest('section') as HTMLElement;
			expect(section).toBeTruthy();

			expect(section.textContent).not.toMatch(/@auth\/sveltekit|Auth\.js/i);
			expect(within(section).getByText(/built into this app/i)).toBeInTheDocument();
		});

		it('lists the sign-in methods the app actually implements', () => {
			render(Page);

			const section = screen
				.getByRole('heading', { name: /Authentication and Setup Flow/i })
				.closest('section') as HTMLElement;
			const scoped = within(section);

			expect(scoped.getByText(/email and password/i)).toBeInTheDocument();
			expect(scoped.getAllByText(/GitHub and Discord/i).length).toBeGreaterThan(0);
			expect(scoped.getByText('/auth/signup')).toBeInTheDocument();
		});

		it('documents opaque sessions and protected setup operations', () => {
			render(Page);
			const section = screen
				.getByRole('heading', { name: /Authentication and Setup Flow/i })
				.closest('section') as HTMLElement;

			expect(section.textContent).toMatch(/unsigned opaque session token/i);
			expect(section.textContent).toMatch(/SESSION_SECRET/);
			expect(section.textContent).toMatch(/SETUP_SECRET/);
			expect(section.textContent).toMatch(/unexpired one-time state in D1/i);
			expect(section.textContent).toMatch(/atomically consume that state/i);
			expect(section.textContent).toMatch(/Discord does not bootstrap ownership/i);
			expect(section.textContent).toMatch(/owner-only/i);
			expect(section.textContent).toMatch(/revokes every active D1\s+session/i);
		});
	});

	describe('content, AI, and abuse-control contracts', () => {
		it('documents private CMS behavior and configured model enforcement', () => {
			render(Page);
			const section = screen
				.getByRole('heading', { name: /What You Get Out of the Box/i })
				.closest('section') as HTMLElement;

			expect(section.textContent).toMatch(/private CMS content types[\s\S]*404/i);
			expect(section.textContent).toMatch(/enabled[\s\S]*known model allowlist/i);
			expect(section.textContent).toMatch(/unknown or disabled\s+models are rejected/i);
		});

		it('documents paired Turnstile configuration and voice history persistence', () => {
			render(Page);
			const section = screen
				.getByRole('heading', { name: /What You Get Out of the Box/i })
				.closest('section') as HTMLElement;

			expect(section.textContent).toMatch(/TURNSTILE_SITE_KEY/);
			expect(section.textContent).toMatch(/TURNSTILE_SECRET_KEY/);
			expect(section.textContent).toMatch(/partial configuration fails closed/i);
			expect(section.textContent).toMatch(/voice transcripts[\s\S]*same conversation history/i);
		});
	});

	// AGENTS.md §8 — the agent-discovery surfaces are user-visible features, so
	// /documentation has to describe them and keep describing them.
	describe('agent readiness section', () => {
		it('documents the section and links every published discovery surface', () => {
			render(Page);

			expect(screen.getByRole('heading', { name: /Agent Readiness/i })).toBeInTheDocument();

			const surfaces: Array<[RegExp, string]> = [
				[/\/robots\.txt/, '/robots.txt'],
				[/\/sitemap\.xml/, '/sitemap.xml'],
				[/api-catalog/, '/.well-known/api-catalog'],
				[/agent-skills/, '/.well-known/agent-skills/index.json'],
				[/auth\.md/, '/auth.md'],
				[/api\/health/, '/api/health']
			];

			for (const [name, href] of surfaces) {
				expect(screen.getByRole('link', { name })).toHaveAttribute('href', href);
			}
		});

		it('explains markdown negotiation', () => {
			render(Page);
			expect(
				screen.getByRole('heading', { name: /Reading pages as Markdown/i })
			).toBeInTheDocument();
			expect(screen.getAllByText(/Accept: text\/markdown/i).length).toBeGreaterThan(0);
			expect(screen.getAllByText(/x-markdown-tokens/i).length).toBeGreaterThan(0);
		});

		it('explains the WebMCP tools and their limits', () => {
			render(Page);
			const section = screen
				.getByRole('heading', { name: /Agent Readiness/i })
				.closest('section') as HTMLElement;
			expect(
				within(section).getByRole('heading', { name: /In-browser tools/i })
			).toBeInTheDocument();
			expect(within(section).getByText(/read-and-navigate only/i)).toBeInTheDocument();
			expect(section.textContent).toMatch(/public sitemap allowlist/i);
			expect(section.textContent).toMatch(/browser credentials omitted/i);
		});

		it('lists the endpoints published by the API catalog', () => {
			render(Page);
			const section = screen
				.getByRole('heading', { name: /Agent Readiness/i })
				.closest('section') as HTMLElement;

			for (const endpoint of [
				'/api/contact-form-submissions',
				'/api/health',
				'/api/cms/types',
				'/api/chat/models',
				'/api/chat/stream'
			]) {
				expect(section.textContent).toContain(endpoint);
			}
		});

		it('warns that the shipped content policy allows AI training', () => {
			// A downstream site with proprietary content must be told to change this
			// before launch; burying it would be a defect.
			render(Page);
			expect(screen.getByRole('heading', { name: /Content usage policy/i })).toBeInTheDocument();
			expect(screen.getAllByText(/ai-train=yes/i).length).toBeGreaterThan(0);
			expect(screen.getAllByText(/CONTENT_SIGNAL/i).length).toBeGreaterThan(0);
		});

		it('flags DNS-AID as the step that must be done by hand', () => {
			render(Page);
			expect(screen.getByText(/DNS-based discovery \(DNS-AID\)/i)).toBeInTheDocument();
		});

		it('distinguishes URL discovery from binding-dependent health', () => {
			render(Page);
			const section = screen
				.getByRole('heading', { name: /Agent Readiness/i })
				.closest('section') as HTMLElement;

			expect(
				within(section).getByText(/without per-domain URL configuration/i)
			).toBeInTheDocument();
			expect(section.textContent).toMatch(/placeholder Cloudflare bindings[\s\S]*503/i);
		});

		it('is reachable from the section navigation', () => {
			render(Page);
			const nav = screen.getByRole('navigation', { name: /documentation navigation/i });
			expect(within(nav).getByRole('link', { name: /Agent Readiness/i })).toHaveAttribute(
				'href',
				'#agent-readiness'
			);
		});
	});
});
