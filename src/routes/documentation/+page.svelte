<script lang="ts">
	import SharingMeta from '$lib/components/SharingMeta.svelte';
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
				If this repo is being used as a template, first complete the customization workflow in
				<code>docs/INITIAL_CUSTOMIZATION.md</code>. The current repository status file is still set
				to
				<code>pending</code>, which means template branding cleanup has not been finished yet.
			</p>
			<ol>
				<li>Create your repository from the template.</li>
				<li>Install dependencies and run the app locally.</li>
				<li>Apply database migrations locally.</li>
				<li>Configure OAuth and owner access through the setup flow.</li>
				<li>Run tests and coverage before shipping changes.</li>
			</ol>
		</section>

		<section id="quick-start" class="docs-section">
			<h2>Quick Start</h2>

			<div class="template-button-container">
				<a
					href="https://github.com/new?template_name=NebulaKit&template_owner=starspacegroup"
					class="template-button"
					target="_blank"
					rel="noopener noreferrer"
				>
					<svg viewBox="0 0 16 16" width="20" height="20" fill="currentColor">
						<path
							d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
						/>
					</svg>
					Use this template on GitHub
				</a>
			</div>

			<p class="template-hint">
				Then clone your repository, run the commands below, and open http://localhost:4277.
			</p>

			<pre><code
					># Install dependencies
npm install

# Start development server
npm run dev

# Apply local D1 migrations
npm run db:migrate:local

# Build for production
npm run build

# Type-check and tests
npm run check
npm run test

# Coverage report
npm run test:coverage

# Deploy to Cloudflare Pages
npm run deploy</code
				></pre>
		</section>

		<section id="feature-overview" class="docs-section">
			<h2>What You Get Out of the Box</h2>
			<p>
				This starter already ships with the main product surfaces wired together. The fastest way to
				understand the repo is to think of it as a Cloudflare-first app shell with auth, theming,
				content management, and AI entry points already in place.
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
						<li>CMS-style content routes and admin tooling are included for structured content.</li>
						<li>Chat route becomes your primary AI surface once a provider is configured.</li>
						<li>Command palette can expose AI-related navigation when providers are available.</li>
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
				<li>
					Use the theme toggle to verify light and dark presentation while you customize branding.
				</li>
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
						<li><code>npm run dev</code> runs on host 0.0.0.0, port 4277.</li>
						<li><code>npm run preview</code> previews the production build on port 4277.</li>
						<li><code>npm run check</code> runs Svelte sync plus svelte-check.</li>
					</ul>
				</div>
				<div class="callout-card">
					<h3>Testing</h3>
					<ul>
						<li><code>npm run test</code> runs Vitest in CI mode.</li>
						<li><code>npm run test:watch</code> runs Vitest in watch mode.</li>
						<li><code>npm run test:e2e</code> runs Playwright tests.</li>
						<li><code>npm run test:all</code> runs unit tests, then E2E tests.</li>
					</ul>
				</div>
				<div class="callout-card">
					<h3>Deploy and Validation</h3>
					<ul>
						<li><code>npm run deploy</code> builds then deploys .svelte-kit/cloudflare.</li>
						<li><code>npm run validate:contrast</code> checks theme contrast.</li>
						<li><code>npm run validate:all</code> runs check + test + contrast validation.</li>
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
npm run db:migrate:local

# Apply pending migrations to remote D1
npm run db:migrate

# List migration status
npm run db:migrate:list</code
				></pre>
			<p>
				When schema changes are needed, create a new file with the next sequence number (for
				example,
				<code>0006_add_feature_flag.sql</code>) and use ALTER TABLE or new CREATE statements.
			</p>
		</section>

		<section id="auth-and-setup" class="docs-section">
			<h2>Authentication and Setup Flow</h2>
			<p>
				Auth uses @auth/sveltekit with a setup-first workflow. The main routes are
				<code>/setup</code>, <code>/auth/login</code>, and <code>/reset</code>.
			</p>
			<div class="callout-grid">
				<div class="callout-card">
					<h3>1. Configure</h3>
					<p>
						Open <code>/setup</code> and submit GitHub OAuth credentials plus admin GitHub username.
					</p>
				</div>
				<div class="callout-card">
					<h3>2. Lock Setup</h3>
					<p>
						After the admin logs in the first time, setup is locked to prevent accidental
						reconfiguration.
					</p>
				</div>
				<div class="callout-card">
					<h3>3. Reset When Needed</h3>
					<p>
						<code>/reset</code> clears setup-related KV keys and session cookie. Admins can disable reset
						route access.
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
npm run test

# Run tests in watch mode
npm run test:watch

# Check coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e

# Run all tests (unit + E2E)
npm run test:all</code
				></pre>
			<p>
				Coverage guidance in repository docs is mixed: several files reference 90 percent, while AI
				assistant workflow instructions enforce 95 percent as a stricter floor. For new work, target
				95 percent or higher to satisfy both interpretations safely.
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
│   └── app.html           # HTML template
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
				<li>Use build command <code>npm run build</code>.</li>
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
					If migrations fail, run <code>npm run db:migrate:list</code> and check migration numbering.
				</li>
				<li>
					If command palette entries are missing, verify AI provider status and authentication
					state.
				</li>
			</ul>
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
						href="https://github.com/starspacegroup/NebulaKit/blob/main/docs/INITIAL_CUSTOMIZATION.md"
						target="_blank"
						rel="noopener noreferrer">Initial Customization</a
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
				<li>Run npm run check, npm run test, and npm run test:coverage.</li>
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

	.template-button-container {
		display: flex;
		justify-content: center;
		margin-bottom: var(--spacing-md);
	}

	.template-button {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-sm);
		padding: var(--spacing-sm) var(--spacing-lg);
		background-color: var(--color-primary);
		color: var(--color-background) !important;
		border-radius: var(--radius-md);
		font-size: 1rem;
		font-weight: 600;
		text-decoration: none;
		transition:
			background-color var(--transition-fast),
			transform var(--transition-fast);
	}

	.template-button:hover {
		background-color: var(--color-primary-hover);
		transform: translateY(-1px);
	}

	.template-button:active {
		transform: translateY(0);
	}

	.template-hint {
		text-align: center;
		color: var(--color-text-secondary);
		font-size: 0.875rem;
		margin-bottom: var(--spacing-lg);
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
