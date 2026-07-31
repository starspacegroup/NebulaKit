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
		expect(screen.getByText(/chat route becomes your primary ai surface/i)).toBeInTheDocument();
		expect(
			screen.getByText(/before expecting sign-in or ai features to work/i)
		).toBeInTheDocument();
	});

	it('recommends bun quick start and provides a switchable npm view', () => {
		render(Page);
		const quickStartSection = screen
			.getByRole('heading', { name: /Quick Start/i })
			.closest('section');

		expect(quickStartSection).toBeTruthy();

		const scoped = within(quickStartSection as HTMLElement);

		expect(scoped.getByText(/is the recommended default for this repo/i)).toBeInTheDocument();
		expect(scoped.getByRole('button', { name: /bun/i })).toBeInTheDocument();
		expect(scoped.getByRole('button', { name: /npm/i })).toBeInTheDocument();
		expect(scoped.getByRole('link', { name: /^bun$/i })).toHaveAttribute('href', 'https://bun.sh');
		expect(scoped.getByText(/install dependencies/i)).toBeInTheDocument();
		expect(scoped.getAllByText(/^bun$/i).length).toBeGreaterThan(0);
		expect(scoped.getByText(/^install$/i)).toBeInTheDocument();
		expect(scoped.getByText(/^run dev$/i)).toBeInTheDocument();
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
			expect(screen.getByRole('heading', { name: /In-browser tools/i })).toBeInTheDocument();
			expect(screen.getByText(/read-and-navigate only/i)).toBeInTheDocument();
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
