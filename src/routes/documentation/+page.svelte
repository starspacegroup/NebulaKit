<script lang="ts">
	import SharingMeta from '$lib/components/SharingMeta.svelte';
	import { site } from '$lib/site.config';

	type QuickStartLine =
		| { kind: 'blank' }
		| { kind: 'comment'; text: string }
		| { kind: 'command'; bin: string; args: string };

	const quickStartCommands = `# Install dependencies
bun install

# Start development server
bun run dev

# Apply local D1 migrations
bun run db:migrate:local

# Build for production
bun run build

# Type-check and tests
bun run check
bun run test

# Coverage report
bun run test:coverage

# Deploy to Cloudflare Pages
bun run deploy`;

	function parseQuickStartLines(commands: string): QuickStartLine[] {
		return commands.split('\n').map((line) => {
			const trimmed = line.trim();

			if (!trimmed) {
				return { kind: 'blank' };
			}

			if (trimmed.startsWith('#')) {
				return { kind: 'comment', text: trimmed.slice(1).trim() };
			}

			const [bin = '', ...rest] = trimmed.split(/\s+/);
			return { kind: 'command', bin, args: rest.join(' ') };
		});
	}

	const highlightedQuickStartLines = parseQuickStartLines(quickStartCommands);
</script>

<SharingMeta
	title="Documentation"
	description="NebulaKit documentation: accurate setup, development, testing, and deployment guidance for every user."
/>

<main class="docs-page">
	<div class="docs-container">
		<header class="docs-header">
			<h1>NebulaKit Documentation</h1>
			<p class="docs-intro">
				Single source of truth for setup, development, and deployment. This page is intentionally
				detailed so you can move from first run to production without guesswork.
			</p>
		</header>

		<nav class="docs-nav" aria-label="Documentation navigation">
			<a href="#start-here">Start Here</a>
			<a href="#quick-start">Quick Start</a>
			<a href="#feature-overview">Feature Overview</a>
			<a href="#how-to-use">How To Use</a>
			<a href="#ai-workflow">AI Workflow</a>
			<a href="#commands">Commands</a>
			<a href="#cloudflare-bindings">Cloudflare Bindings</a>
			<a href="#database-migrations">Database Migrations</a>
			<a href="#auth-and-setup">Auth and Setup</a>
			<a href="#admin-analytics">Admin Analytics</a>
			<a href="#agent-readiness">Agent Readiness</a>
			<a href="#testing">Testing</a>
			<a href="#project-structure">Structure</a>
			<a href="#deployment">Deployment</a>
			<a href="#troubleshooting">Troubleshooting</a>
			<a href="#references">References</a>
			<a href="#contributing">Contributing</a>
		</nav>

		<section id="start-here" class="docs-section">
			<h2>Start Here</h2>
			<p>
				NebulaKit is an independent Cloudflare-native platform. Start locally with an isolated D1
				database, then connect the production Cloudflare resources only when you are ready to
				deploy.
			</p>
			<ol>
				<li>Install the frozen Bun dependency graph.</li>
				<li>Apply database migrations locally.</li>
				<li>Run the app and verify the setup, login, CMS, and chat surfaces.</li>
				<li>Configure OAuth and owner access through the setup flow.</li>
				<li>Keep every coverage metric at or above the enforced 95% floor.</li>
				<li>Create project-owned Cloudflare bindings before building or deploying remotely.</li>
			</ol>
		</section>

		<section id="quick-start" class="docs-section">
			<h2>Quick Start</h2>

			<p class="quickstart-recommendation">
				<a href="https://bun.sh" target="_blank" rel="noopener noreferrer">Bun</a> is the recommended
				default for this repository. Run the commands below, then open http://localhost:4277.
			</p>

			<div class="quickstart-shell">
				<div class="quickstart-toolbar">
					<div class="quickstart-tags" aria-label="Quick start status">
						<span class="quickstart-tag quickstart-tag--recommended">Package manager: Bun</span>
					</div>
				</div>

				<div class="quickstart-window" data-manager="bun">
					<div class="quickstart-window-header">
						<div class="window-controls" aria-hidden="true">
							<span class="window-dot"></span>
							<span class="window-dot"></span>
							<span class="window-dot"></span>
						</div>
						<p class="quickstart-window-title">terminal bun</p>
					</div>
					<pre class="quickstart-code"><code
							>{#each highlightedQuickStartLines as line}
								{#if line.kind === 'blank'}
									<span class="quickstart-line quickstart-line--blank"></span>
								{:else if line.kind === 'comment'}
									<span class="quickstart-line quickstart-line--comment"
										><span class="token-comment"># {line.text}</span></span
									>
								{:else}
									<span class="quickstart-line quickstart-line--command"
										><span class="token-prompt">$</span>
									<span class="token-bin">{line.bin}</span>{#if line.args}<span class="token-args"> {line.args}</span
											>{/if}</span
									>
								{/if}
							{/each}</code
						></pre>
				</div>
			</div>
		</section>

		<section id="feature-overview" class="docs-section">
			<h2>What You Get Out of the Box</h2>
			<p>
				NebulaKit integrates its main product surfaces as one Cloudflare-native application:
				identity, content management, AI workflows, administration, analytics, and agent-ready
				publishing.
			</p>
			<div class="callout-grid">
				<div class="callout-card">
					<h3>Core App Shell</h3>
					<ul>
						<li>Keyboard-first navigation with command palette for fast route switching.</li>
						<li>Theme system with persistent light and dark preferences.</li>
						<li>Responsive layout, navigation, footer, and shared metadata components.</li>
					</ul>
				</div>
				<div class="callout-card">
					<h3>Account and Admin Flow</h3>
					<ul>
						<li>Setup-first authentication flow for owner configuration.</li>
						<li>Login, signup, profile, reset, and admin routes are already scaffolded.</li>
						<li>Cloudflare D1 and KV are used for setup state and application data.</li>
					</ul>
				</div>
				<div class="callout-card">
					<h3>Content and AI Surfaces</h3>
					<ul>
						<li>
							Private CMS content types (<code>isPublic: false</code>) return <code>404</code> from
							public list/item routes and stay out of the sitemap; manage them under
							<code>/admin/cms</code>.
						</li>
						<li>
							Chat exposes only enabled entries from its known model allowlist. Unknown or disabled
							models are rejected rather than forwarded to a provider.
						</li>
						<li>
							Voice transcripts and replies persist in the same conversation history as text chat.
						</li>
					</ul>
				</div>
				<div class="callout-card">
					<h3>Contact Abuse Protection</h3>
					<p>
						Turnstile is optional only when both keys are absent. Set
						<code>TURNSTILE_SITE_KEY</code> and <code>TURNSTILE_SECRET_KEY</code> together to enable it;
						partial configuration fails closed so the browser and server cannot disagree.
					</p>
				</div>
				<div class="callout-card">
					<h3>Analytics and Operations</h3>
					<ul>
						<li>
							First-party, cookie-free analytics at <code>/admin/stats</code> — traffic, audience, and
							growth, with no third-party script.
						</li>
						<li>
							A Cloudflare plan-limit meter that projects whether today's traffic will exhaust your
							request allowance.
						</li>
						<li>Per-admin permission so operators can see stats without owner access.</li>
					</ul>
				</div>
			</div>
		</section>

		<section id="how-to-use" class="docs-section">
			<h2>How To Use the App</h2>
			<p>
				Use the app in this order if you want the least confusing first run. That sequence matches
				how the repo is structured and avoids most setup-related false alarms.
			</p>
			<ol>
				<li>
					Open <code>/setup</code> first on a fresh environment and configure owner credentials.
				</li>
				<li>Complete <code>/setup</code> before expecting sign-in or AI features to work.</li>
				<li>
					Sign in through <code>/auth/login</code> or create an account through
					<code>/auth/signup</code>.
				</li>
				<li>Open the command palette with Ctrl/Cmd + K to move between major routes quickly.</li>
				<li>
					Use <code>/chat</code> for AI interactions, <code>/profile</code> for account settings,
					and <code>/admin</code> for operator tasks.
				</li>
				<li>Use the theme toggle to verify light, dark, and system-preference presentation.</li>
			</ol>
			<div class="callout-grid">
				<div class="callout-card">
					<h3>Common First-Run Checks</h3>
					<ul>
						<li>If auth looks broken, re-check setup lock state and provider credentials first.</li>
						<li>
							If chat is missing from navigation, verify AI provider configuration and route access.
						</li>
						<li>
							If admin tools are unavailable, confirm you are signed in as the configured owner.
						</li>
					</ul>
				</div>
				<div class="callout-card">
					<h3>Where To Extend</h3>
					<ul>
						<li>Modify routes under <code>src/routes</code> when changing page behavior.</li>
						<li>Use <code>src/lib/components</code> for reusable UI and shell elements.</li>
						<li>
							Keep business logic in <code>src/lib/services</code> and shared helpers in
							<code>src/lib/utils</code>.
						</li>
					</ul>
				</div>
			</div>
		</section>

		<section id="ai-workflow" class="docs-section">
			<h2>Working With AI in This Repo</h2>
			<p>
				Treat AI as a fast pair programmer, not as a source of truth. It is useful here because the
				repo already includes app structure, tests, and strong conventions, which gives the
				assistant real context to work against.
			</p>
			<div class="callout-grid">
				<div class="callout-card">
					<h3>Good Prompts</h3>
					<ul>
						<li>Point the assistant at a concrete file, route, failing test, or command.</li>
						<li>Ask it to write or update tests first when changing behavior.</li>
						<li>
							Ask for narrow fixes instead of broad rewrites unless you want architectural change.
						</li>
					</ul>
				</div>
				<div class="callout-card">
					<h3>Good Validation Habits</h3>
					<ul>
						<li>
							Have the assistant explain which route, store, or service controls the behavior.
						</li>
						<li>Require executable validation after changes, not only a diff summary.</li>
						<li>Always finish by running check, tests, and coverage.</li>
					</ul>
				</div>
				<div class="callout-card">
					<h3>What AI Is Best At Here</h3>
					<ul>
						<li>
							Tracing a route from UI to service layer and identifying the smallest edit surface.
						</li>
						<li>Adding tests around setup, auth, chat, or command palette behavior.</li>
						<li>
							Summarizing repo conventions such as Cloudflare bindings, migrations, and theme rules.
						</li>
					</ul>
				</div>
			</div>
			<p>
				If you are using an AI coding agent, keep requests concrete: mention the page or failing
				test, state the desired behavior, and ask for the smallest validating change that solves it.
			</p>
		</section>

		<section id="commands" class="docs-section">
			<h2>Core Commands</h2>
			<p>These scripts are defined in package.json and are the canonical local workflow.</p>
			<div class="callout-grid">
				<div class="callout-card">
					<h3>Development</h3>
					<ul>
						<li><code>bun run dev</code> runs on host 0.0.0.0, port 4277.</li>
						<li><code>bun run preview</code> previews the production build on port 4277.</li>
						<li><code>bun run check</code> runs Svelte sync plus svelte-check.</li>
					</ul>
				</div>
				<div class="callout-card">
					<h3>Testing</h3>
					<ul>
						<li><code>bun run test</code> runs Vitest in CI mode.</li>
						<li><code>bun run test:watch</code> runs Vitest in watch mode.</li>
						<li><code>bun run test:e2e</code> runs Playwright tests.</li>
						<li><code>bun run test:all</code> runs unit tests, then E2E tests.</li>
					</ul>
				</div>
				<div class="callout-card">
					<h3>Deploy and Validation</h3>
					<ul>
						<li><code>bun run deploy</code> builds then deploys .svelte-kit/cloudflare.</li>
						<li><code>bun run validate:contrast</code> checks theme contrast.</li>
						<li><code>bun run validate:all</code> runs check + test + contrast validation.</li>
					</ul>
				</div>
			</div>
		</section>

		<section id="cloudflare-bindings" class="docs-section">
			<h2>Cloudflare Bindings</h2>
			<p>NebulaKit is configured for Cloudflare Pages with these bindings in wrangler.toml:</p>
			<ul>
				<li><code>DB</code> as D1 database binding (database name: nebulakit-db).</li>
				<li><code>KV</code> as KV namespace for runtime config and flags.</li>
				<li><code>BUCKET</code> as R2 bucket binding.</li>
				<li>Queue producer binding is documented but commented out by default.</li>
			</ul>
			<p>
				Set app secrets in Cloudflare dashboard or Wrangler secrets for production. Avoid committing
				raw secrets to source control.
			</p>
		</section>

		<section id="database-migrations" class="docs-section">
			<h2>Database Migrations</h2>
			<p>
				Migrations are ordered SQL files under <code>migrations/</code> and tracked by D1. Never edit
				or delete existing migration files once committed to main.
			</p>
			<pre><code
					># Apply pending migrations to local D1
bun run db:migrate:local

# Apply pending migrations to remote D1
bun run db:migrate

# List migration status
bun run db:migrate:list</code
				></pre>
			<p>
				When schema changes are needed, create a new file with the next sequence number (for
				example,
				<code>0012_add_feature_flag.sql</code>) and use ALTER TABLE or new CREATE statements.
			</p>
		</section>

		<section id="auth-and-setup" class="docs-section">
			<h2>Authentication and Setup Flow</h2>
			<p>
				Authentication is built into this app on a setup-first workflow — no third-party auth
				library sits in the request path. The browser receives a signed opaque session token, while
				the revocable session record, identity, and roles are loaded from D1 on every request.
				Authentication fails closed if D1 or <code>SESSION_SECRET</code> is unavailable.
			</p>
			<p>
				You can sign in with email and password, or with GitHub and Discord once those providers are
				configured. The main routes are <code>/setup</code>, <code>/auth/login</code>,
				<code>/auth/signup</code>, and <code>/reset</code>.
			</p>
			<div class="callout-grid">
				<div class="callout-card">
					<h3>1. Configure</h3>
					<p>
						Set <code>SESSION_SECRET</code> and <code>SETUP_SECRET</code>, then open
						<code>/setup</code>
						and submit the bootstrap secret, GitHub OAuth credentials, and admin GitHub username.
					</p>
				</div>
				<div class="callout-card">
					<h3>2. Lock Setup</h3>
					<p>
						After owner/config state exists, only the authenticated owner can change setup or manage
						authentication keys. GitHub and Discord validate unexpired one-time state in D1,
						exchange the provider code, then atomically consume that state before changing accounts
						or sessions. Discord does not bootstrap ownership; it inherits owner status only when
						linked or matched to the configured GitHub owner account.
					</p>
				</div>
				<div class="callout-card">
					<h3>3. Reset When Needed</h3>
					<p>
						<code>/reset</code> is owner-only. It clears setup-related KV keys, revokes every active D1
						session, and clears the browser cookie. The reset route can also be disabled.
					</p>
				</div>
			</div>
		</section>

		<section id="admin-analytics" class="docs-section">
			<h2>Admin Analytics</h2>
			<p>
				<code>/admin/stats</code> is the built-in analytics surface: traffic over a 1, 7, 30, or 90-day
				window, views by route, referrers, countries, an audience breakdown, and user and content growth
				over time. It is first-party — there is no third-party script, no account, and no API key to provision.
			</p>
			<p>
				Everything collected is a daily aggregate counter in D1. There are
				<strong>no cookies, no identifiers, and no IP addresses</strong> anywhere in the feature. The
				User-Agent is read to classify the request and then discarded, so only coarse buckets (operating
				system, browser, device, language, viewport) are ever stored, and country comes from the Cloudflare
				edge rather than from an IP lookup. Because nothing per-visitor is retained, this needs no consent
				banner.
			</p>
			<div class="callout-grid">
				<div class="callout-card">
					<h3>Turning It On</h3>
					<ol>
						<li>
							Apply migrations <code>0007</code> through <code>0009</code> with
							<code>db:migrate:local</code> (or <code>db:migrate</code> for remote).
						</li>
						<li>
							Collection starts on the next request. Traffic and audience panels fill in as visits
							arrive.
						</li>
						<li>
							Country stays <code>(unknown)</code> in local development — it is supplied by the Cloudflare
							edge.
						</li>
					</ol>
				</div>
				<div class="callout-card">
					<h3>Granting Access</h3>
					<p>
						The owner always sees Stats. Any other admin needs the <code>can_view_stats</code> flag, which
						defaults to off so existing admins do not gain access on upgrade:
					</p>
					<pre><code>UPDATE users SET can_view_stats = 1 WHERE email = 'someone@example.com';</code
						></pre>
					<p>
						The permission is re-read from the database on every request, so revoking it takes
						effect without waiting for a sign-out.
					</p>
				</div>
				<div class="callout-card">
					<h3>Retention</h3>
					<p>
						The counter tables grow one row per day per dimension unless pruned. Set
						<code>CRON_SECRET</code> and have any scheduler POST to the retention endpoint; rows older
						than 400 days are removed.
					</p>
					<pre><code
							>curl -X POST https://your-app/api/cron/prune-view-stats \
  -H "Authorization: Bearer $CRON_SECRET"</code
						></pre>
				</div>
				<div class="callout-card">
					<h3>Platform Usage Meter</h3>
					<p>
						The same page tracks <em>billable</em> Function invocations — a larger set than page
						views, since bots, <code>/api/*</code> calls, 404s, and non-GET requests all count against
						your plan. It projects whether today will exhaust the free 100,000-request daily allowance
						before the UTC reset.
					</p>
					<p>
						Treat it as an early warning and a floor, not a bill: the Cloudflare dashboard remains
						authoritative.
					</p>
				</div>
			</div>
		</section>

		<section id="testing" class="docs-section">
			<h2>Testing and Quality Gates</h2>
			<p>
				NebulaKit follows Test-Driven Development. Write failing tests first, then implementation,
				then refactor.
			</p>
			<pre><code
					># Run all tests
bun run test

# Run tests in watch mode
bun run test:watch

# Check coverage
bun run test:coverage

# Run E2E tests
bun run test:e2e

# Run all tests (unit + E2E)
bun run test:all</code
				></pre>
			<p>
				Vitest enforces a 95% floor for lines, statements, functions, and branches. A change is not
				ready when any metric falls below that threshold.
			</p>
		</section>

		<section id="project-structure" class="docs-section">
			<h2>Project Structure</h2>
			<pre><code
					>NebulaKit/
├── .github/              # Copilot and workflow instructions
├── src/
│   ├── lib/
│   │   ├── components/     # Reusable UI components
│   │   ├── services/       # Business logic
│   │   ├── stores/         # Svelte stores
│   │   ├── types/          # Shared type definitions
│   │   └── utils/          # Helpers
│   ├── routes/             # SvelteKit routes
│   │   ├── api/            # API endpoints
│   │   ├── auth/           # Authentication pages
│   │   ├── chat/           # Chat UI
│   │   ├── setup/          # First-time setup flow
│   │   └── documentation/  # This page
│   ├── app.css            # Global styles & theme
│   └── app.html           # HTML shell and install metadata
├── tests/                  # unit/integration/e2e tests
├── migrations/             # Immutable D1 migration files
├── docs/                   # Extended project docs
└── wrangler.toml           # Cloudflare bindings/config</code
				></pre>
		</section>

		<section id="deployment" class="docs-section">
			<h2>Deployment to Cloudflare Pages</h2>
			<ol>
				<li>Push your repository to GitHub.</li>
				<li>
					In Cloudflare dashboard, open
					<a
						href="https://dash.cloudflare.com/?to=/:account/pages/new/provider/github"
						target="_blank"
						rel="noopener noreferrer">Pages</a
					>
					and connect the repository.
				</li>
				<li>Use build command <code>bun run build</code>.</li>
				<li>Use output directory <code>.svelte-kit/cloudflare</code>.</li>
				<li>Add D1, KV, and R2 bindings to the Pages project settings.</li>
				<li>Add required environment variables and secrets.</li>
				<li>Deploy and verify auth, setup flow, and database connectivity.</li>
			</ol>
			<p>
				The local deploy script already uses <code
					>wrangler pages deploy .svelte-kit/cloudflare</code
				>.
			</p>
		</section>

		<section id="troubleshooting" class="docs-section">
			<h2>Troubleshooting</h2>
			<ul>
				<li>
					If setup API reports KV unavailable, create KV namespaces and update wrangler.toml binding
					IDs.
				</li>
				<li>
					If login fails after setup, confirm OAuth callback URL and ensure GitHub credentials are
					valid.
				</li>
				<li>
					If migrations fail, run <code>bun run db:migrate:list</code> and check migration numbering.
				</li>
				<li>
					If command palette entries are missing, verify AI provider status and authentication
					state.
				</li>
			</ul>
		</section>

		<section id="agent-readiness" class="docs-section">
			<h2>Agent Readiness</h2>
			<p>
				This site publishes a machine-readable discovery layer so search crawlers and AI agents can
				find it, read it efficiently, and understand how to interact with it. Everything below is
				live without per-domain URL configuration. Placeholder Cloudflare bindings still make
				<code>/api/health</code> return <code>503</code> until project-owned D1/KV resources are configured.
			</p>
			<ul>
				<li>
					<a href="/robots.txt">/robots.txt</a> — crawl rules, explicit entries for AI crawlers (GPTBot,
					ClaudeBot, PerplexityBot and others), and Content Signals declaring how the content may be used.
				</li>
				<li>
					<a href="/sitemap.xml">/sitemap.xml</a> — every public page plus all published CMS content,
					regenerated on request so newly published items appear immediately.
				</li>
				<li>
					<a href="/.well-known/api-catalog">/.well-known/api-catalog</a> — an RFC 9727 catalog of this
					deployment's APIs.
				</li>
				<li>
					<a href="/.well-known/agent-skills/index.json">/.well-known/agent-skills/index.json</a>
					— short guides teaching an agent how to read content and contact the site, each with a SHA-256
					digest.
				</li>
				<li>
					<a href="/auth.md">/auth.md</a> — how agents authenticate (and what is not offered).
				</li>
				<li>
					<a href="/api/health">/api/health</a> — service health, used as the catalog's status link.
				</li>
			</ul>
			<p>
				The catalog currently anchors these implemented endpoints:
				<code>/api/contact-form-submissions</code>, <code>/api/health</code>,
				<code>/api/cms/types</code>, <code>/api/chat/models</code>, and
				<code>/api/chat/stream</code>. Their catalog notes distinguish public, Turnstile-gated, and
				session-authenticated access.
			</p>

			<h3>Reading pages as Markdown</h3>
			<p>
				Any page can be fetched as Markdown instead of HTML by sending an
				<code>Accept: text/markdown</code> header. Browsers are unaffected — HTML remains the
				default. Responses include an <code>x-markdown-tokens</code> estimate so an agent can budget context
				before reading.
			</p>
			<pre><code>curl -H 'Accept: text/markdown' {site.url}/</code></pre>

			<h3>In-browser tools (WebMCP)</h3>
			<p>
				When opened by a WebMCP-capable agent, this site registers tools for searching content,
				listing pages, reading a page as Markdown, navigating, and switching theme. They are
				read-and-navigate only and restricted to this site's own origin. The page-reading tool
				enforces the public sitemap allowlist with browser credentials omitted, so an authenticated
				visitor cannot expose private/admin pages through WebMCP.
			</p>

			<h3>Content usage policy</h3>
			<p>
				The shipped default is fully permissive — <code>search=yes, ai-input=yes, ai-train=yes</code
				>
				— which matches NebulaKit's public open-source content. Change
				<code>CONTENT_SIGNAL</code> in <code>src/lib/agent-discovery.ts</code> before publishing any proprietary
				content; every robots.txt group picks the change up automatically.
			</p>
			<p>
				DNS-based discovery (DNS-AID) is the one piece that must be added by hand, since DNS records
				live with your provider rather than in this repo. See
				<code>docs/AGENT_READINESS.md</code> for the exact records and the DNSSEC requirement.
			</p>
		</section>

		<section id="references" class="docs-section">
			<h2>References</h2>
			<ul>
				<li>
					<a
						href="https://github.com/starspacegroup/NebulaKit"
						target="_blank"
						rel="noopener noreferrer">GitHub repository</a
					>
				</li>
				<li>
					<a
						href="https://github.com/starspacegroup/NebulaKit/blob/main/README.md"
						target="_blank"
						rel="noopener noreferrer">README</a
					>
				</li>
				<li>
					<a
						href="https://github.com/starspacegroup/NebulaKit/blob/main/CONTRIBUTING.md"
						target="_blank"
						rel="noopener noreferrer">Contributing Guide</a
					>
				</li>
				<li>
					<a
						href="https://github.com/starspacegroup/NebulaKit/blob/main/docs/CLOUDFLARE_SETUP.md"
						target="_blank"
						rel="noopener noreferrer">Cloudflare Setup</a
					>
				</li>
				<li>
					<a
						href="https://github.com/starspacegroup/NebulaKit/blob/main/docs/THEME_SYSTEM.md"
						target="_blank"
						rel="noopener noreferrer">Theme System</a
					>
				</li>
				<li>
					<a
						href="https://developers.cloudflare.com/pages/framework-guides/deploy-a-svelte-kit-site/"
						target="_blank"
						rel="noopener noreferrer">Cloudflare Pages plus SvelteKit Guide</a
					>
				</li>
			</ul>
		</section>

		<section id="contributing" class="docs-section">
			<h2>Contributing</h2>
			<p>
				Use TDD, keep changes small and reviewable, and run tests plus checks before opening a pull
				request.
			</p>
			<ul>
				<li>Write tests before implementation changes.</li>
				<li>Run bun run check, bun run test, and bun run test:coverage.</li>
				<li>Prefer Cloudflare-native services and minimal external dependencies.</li>
				<li>Do not edit past migration files; create a new one instead.</li>
			</ul>
		</section>

		<footer class="docs-footer">
			<p>
				If NebulaKit helps your workflow, consider giving the project a star on <a
					href="https://github.com/starspacegroup/NebulaKit"
					target="_blank"
					rel="noopener noreferrer">GitHub</a
				>!
			</p>
		</footer>
	</div>
</main>

<style>
	.docs-page {
		min-height: 100vh;
		padding: var(--spacing-xl) var(--spacing-md);
		background-color: var(--color-background);
	}

	.docs-container {
		max-width: 900px;
		margin: 0 auto;
	}

	.docs-header {
		text-align: center;
		margin-bottom: var(--spacing-2xl);
		padding-bottom: var(--spacing-xl);
		border-bottom: 1px solid var(--color-border);
	}

	.docs-header h1 {
		font-size: 2.5rem;
		font-weight: 700;
		color: var(--color-text);
		margin-bottom: var(--spacing-md);
	}

	.docs-intro {
		font-size: 1.125rem;
		color: var(--color-text-secondary);
		max-width: 680px;
		margin: 0 auto;
	}

	.docs-nav {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-sm);
		justify-content: center;
		margin-bottom: var(--spacing-2xl);
		padding: var(--spacing-md);
		background-color: var(--color-surface);
		border-radius: var(--radius-lg);
	}

	.docs-nav a {
		padding: var(--spacing-sm) var(--spacing-md);
		color: var(--color-text-secondary);
		text-decoration: none;
		border-radius: var(--radius-md);
		transition: all var(--transition-fast);
	}

	.docs-nav a:hover {
		color: var(--color-primary);
		background-color: var(--color-surface-hover);
	}

	.docs-section {
		margin-bottom: var(--spacing-2xl);
		padding-bottom: var(--spacing-xl);
		border-bottom: 1px solid var(--color-border);
		scroll-margin-top: 5rem;
	}

	.docs-section:last-of-type {
		border-bottom: none;
	}

	.docs-section h2 {
		font-size: 1.75rem;
		font-weight: 600;
		color: var(--color-text);
		margin-bottom: var(--spacing-lg);
	}

	.docs-section h3 {
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--color-text);
		margin-top: var(--spacing-xl);
		margin-bottom: var(--spacing-md);
	}

	.docs-section p {
		color: var(--color-text-secondary);
		line-height: 1.7;
		margin-bottom: var(--spacing-md);
	}

	.docs-section ul,
	.docs-section ol {
		color: var(--color-text-secondary);
		margin-left: var(--spacing-xl);
		margin-bottom: var(--spacing-md);
	}

	.docs-section li {
		margin-bottom: var(--spacing-sm);
		line-height: 1.6;
	}

	.docs-section code {
		font-family: var(--font-mono);
		font-size: 0.875rem;
		padding: 0.125rem 0.375rem;
		background-color: var(--color-surface);
		border-radius: var(--radius-sm);
		color: var(--color-text);
	}

	.docs-section pre {
		background-color: var(--color-surface);
		padding: var(--spacing-md);
		border-radius: var(--radius-md);
		overflow-x: auto;
		margin-bottom: var(--spacing-md);
	}

	.docs-section pre code {
		padding: 0;
		background: none;
	}

	.docs-section a {
		color: var(--color-primary);
		text-decoration: none;
	}

	.docs-section a:hover {
		text-decoration: underline;
	}

	.callout-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: var(--spacing-lg);
		margin-top: var(--spacing-lg);
	}

	.callout-card {
		padding: var(--spacing-lg);
		background-color: var(--color-surface);
		border-radius: var(--radius-lg);
		border: 1px solid var(--color-border);
	}

	.callout-card h3 {
		margin-top: 0;
		margin-bottom: var(--spacing-sm);
		font-size: 1.125rem;
	}

	.callout-card p,
	.callout-card ul {
		margin-bottom: 0;
		font-size: 0.9375rem;
		margin-left: 0;
	}

	.docs-footer {
		text-align: center;
		padding-top: var(--spacing-xl);
		color: var(--color-text-secondary);
	}

	.docs-footer a {
		color: var(--color-primary);
		text-decoration: none;
	}

	.docs-footer a:hover {
		text-decoration: underline;
	}

	.quickstart-recommendation {
		text-align: center;
		font-size: 0.9375rem;
		margin-bottom: var(--spacing-md);
	}

	.quickstart-shell {
		max-width: 980px;
		margin: 0 auto;
		padding: var(--spacing-md);
		border-radius: var(--radius-lg);
		border: 1px solid var(--color-border);
		background: linear-gradient(145deg, var(--color-surface) 0%, var(--color-background) 85%);
		box-shadow: var(--shadow-md);
	}

	.quickstart-toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-sm);
		margin-bottom: var(--spacing-md);
	}

	.quickstart-tags {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-xs);
	}

	.quickstart-tag {
		display: inline-flex;
		align-items: center;
		padding: 0.2rem 0.5rem;
		font-size: 0.8rem;
		font-weight: 600;
		border-radius: 999px;
		border: 1px solid var(--color-border);
		background-color: var(--color-background);
		color: var(--color-text-secondary);
	}

	.quickstart-tag--recommended {
		background-color: var(--color-primary);
		border-color: var(--color-primary);
		color: var(--color-background);
	}

	.quickstart-window {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		overflow: hidden;
		background-color: var(--color-background);
	}

	.quickstart-window-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.6rem 0.8rem;
		border-bottom: 1px solid var(--color-border);
		background-color: var(--color-surface);
	}

	.window-controls {
		display: flex;
		gap: 0.35rem;
	}

	.window-dot {
		width: 0.55rem;
		height: 0.55rem;
		border-radius: 999px;
		background-color: var(--color-border);
	}

	.quickstart-window-title {
		margin: 0;
		color: var(--color-text-secondary);
		font-size: 0.8rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.quickstart-code {
		margin: 0;
		padding: var(--spacing-lg);
		background-color: var(--color-background);
		border-radius: 0;
	}

	.quickstart-code code {
		display: block;
		font-size: 0.95rem;
		line-height: 1.7;
		white-space: normal;
	}

	.quickstart-line {
		display: block;
		white-space: normal;
	}

	.quickstart-line--blank {
		height: 1.1rem;
	}

	.quickstart-line--comment {
		margin-top: 0.15rem;
	}

	.quickstart-line--command {
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
	}

	.token-comment {
		color: var(--color-text-secondary);
	}

	.token-prompt {
		color: var(--color-success);
		margin-right: 0.4rem;
	}

	.token-bin {
		color: var(--color-primary);
		font-weight: 700;
	}

	.token-args {
		color: var(--color-text);
		white-space: pre;
	}

	@media (max-width: 767px) {
		.quickstart-shell {
			padding: var(--spacing-sm);
		}

		.quickstart-toolbar {
			align-items: flex-start;
			flex-direction: column;
		}
	}

	@media (min-width: 768px) {
		.docs-page {
			padding: var(--spacing-2xl);
		}

		.docs-header h1 {
			font-size: 3rem;
		}
	}
</style>
