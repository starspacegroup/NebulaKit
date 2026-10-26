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
			<a href="#ui-kit">UI Kit</a>
			<a href="#modules">Modules</a>
			<a href="#drag-and-drop">Drag and Drop</a>
			<a href="#ai-workflow">AI Workflow</a>
			<a href="#commands">Commands</a>
			<a href="#cloudflare-bindings">Cloudflare Bindings</a>
			<a href="#database-migrations">Database Migrations</a>
			<a href="#auth-and-setup">Auth and Setup</a>
			<a href="#secrets-at-rest">Secrets at Rest</a>
			<a href="#admin-analytics">Admin Analytics</a>
			<a href="#shop-pages-api">Shop, Pages and the Site API</a>
			<a href="#lighthouse">Lighthouse</a>
			<a href="#scheduled-jobs">Scheduled Jobs</a>
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
				NebulaKit is a SvelteKit starter template for Cloudflare. Create your own repository with
				<strong>Use this template</strong>, then run <code>bun run customize</code> to rename the
				app, the slug, the dev port, and the Cloudflare resource names in one pass —
				<code>CUSTOMIZE.md</code> covers the steps a script cannot do.
			</p>
			<p>
				Start locally with an isolated D1 database, then connect the production Cloudflare resources
				only when you are ready to deploy.
			</p>
			<ol>
				<li>Create your repository from the template and run the customization pass.</li>
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
						<li>
							A columned widget board with pointer, touch, and keyboard dragging — see
							<a href="#drag-and-drop">Drag and Drop</a>.
						</li>
					</ul>
				</div>
				<div class="callout-card">
					<h3>Account and Admin Flow</h3>
					<ul>
						<li>Setup-first authentication flow for owner configuration.</li>
						<li>Login, signup, profile, reset, and admin routes are already scaffolded.</li>
						<li>
							<code>/admin</code> opens on the stats dashboard. <code>/admin/settings</code> holds
							the configuration summary, the <code>/reset</code> route switch, and the OAuth authentication
							keys.
						</li>
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
							First-party, cookie-free analytics at <code>/admin</code> — traffic, audience, and growth,
							with no third-party script.
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
				<li>
					Open the command palette with Ctrl/Cmd + K to move between major routes quickly. On a
					phone, tap the search icon in the navbar or choose "Search &amp; commands" in the menu.
				</li>
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

		<section id="ui-kit" class="docs-section">
			<h2>UI Kit</h2>
			<p>
				Standard elements live in <code>src/lib/ui</code> and import from one place. Every one uses
				the theme's CSS variables only, works in light and dark, and is usable by keyboard. See them
				all running, with the code for each, at <a href="/components">/components</a>.
			</p>
			<pre><code
					>{`import { Button, TextInput, Select, Dialog, Tabs, Table, toast } from '$lib/ui';`}</code
				></pre>
			<ul>
				<li>
					<strong>Actions</strong> — Button (four variants, three sizes, link form, loading state),
					ButtonGroup, Menu, DropdownMenu (checkbox and radio items), Command (a filterable command
					palette, inline or as a <kbd>Ctrl</kbd>+<kbd>K</kbd> dialog), Toggle and ToggleGroup.
				</li>
				<li>
					<strong>Forms</strong> — TextInput, Textarea, Select, Checkbox, RadioGroup, Switch,
					Slider, Combobox, Calendar, DatePicker, InputOTP, InputGroup, NumberInput, TagInput and
					FileDrop, all wired the way Field wires them: a real label, the hint and error in
					<code>aria-describedby</code>.
				</li>
				<li>
					<strong>Feedback</strong> — Alert, toasts, Badge, Progress, Spinner and Skeleton.
				</li>
				<li>
					<strong>Overlays</strong> — Dialog and AlertDialog (native <code>&lt;dialog&gt;</code>),
					Sheet (from any side, so also a drawer), Popover, HoverCard, Tooltip and ContextMenu.
				</li>
				<li>
					<strong>Navigation</strong> — Tabs, Accordion, Breadcrumbs, Pagination, Menubar, NavigationMenu,
					Sidebar and Stepper.
				</li>
				<li>
					<strong>Layout</strong> — Container, Stack, Separator, AspectRatio, ScrollArea, Resizable and
					Collapsible.
				</li>
				<li>
					<strong>Data display</strong> — Card, Item, Table, DataTable (search, sort, paging, selection),
					BarChart, LineChart and DonutChart (plain SVG, each with a hidden data table for screen readers),
					Stat, Carousel, Timeline, Avatar, AvatarGroup, Kbd, CodeBlock, Prose and EmptyState.
				</li>
			</ul>
			<p>
				That is every element shadcn/ui ships, and more. None of it needs a dependency beyond
				Svelte, and none of it is a paid add-on: the kit is MIT-licensed with the rest of the
				project.
			</p>
			<p>
				Toasts need one <code>{'<Toaster />'}</code>, which the root layout already renders. Raise
				one from anywhere with <code>toast.success('Saved')</code>; pass <code>0</code> as the duration
				to keep it until it is dismissed.
			</p>
			<p>
				The catalog is checked: a test fails when a component is added to <code>src/lib/ui</code>,
				or a widget is registered, without an entry in <code>src/lib/ui/catalog.ts</code>. Full
				reference: <code>docs/UI_KIT.md</code>.
			</p>
		</section>

		<section id="modules" class="docs-section">
			<h2>Modules</h2>
			<p>
				Where the UI kit gives you elements, modules give you the blocks every app ends up building.
				They live in <code>src/lib/modules</code>, are built from <code>$lib/ui</code>, and are
				shown running, with the accessibility behaviour each one keeps, at
				<a href="/modules">/modules</a>.
			</p>
			<pre><code
					>{`import { SignInForm, PricingTable, DataGrid, KanbanBoard } from '$lib/modules';`}</code
				></pre>
			<ul>
				<li>
					<strong>Account</strong> &mdash; sign-in, sign-up, password reset, profile, sessions, two-factor.
				</li>
				<li>
					<strong>Settings</strong> &mdash; appearance, notifications, API keys, webhooks, cookie consent,
					privacy.
				</li>
				<li>
					<strong>Marketing</strong> &mdash; hero, pricing, comparison, FAQ, testimonials, footer, contact.
				</li>
				<li>
					<strong>App shell</strong> &mdash; app shell, notification center, global search, wizard, error
					states.
				</li>
				<li>
					<strong>Data &amp; teams</strong> &mdash; data grid, kanban, comments, files, calendar, tree,
					audit log.
				</li>
				<li>
					<strong>Commerce</strong> &mdash; billing, invoices, checkout, cart, reviews, status page, changelog.
				</li>
			</ul>
			<p>
				Each module takes its data and copy as props, emits events, and never fetches. All are
				mobile first from 320px, use CSS variables only, and work by keyboard and screen reader.
			</p>
		</section>

		<section id="drag-and-drop" class="docs-section">
			<h2>Drag and Drop</h2>
			<p>
				<code>&lt;WidgetBoard&gt;</code> takes a layout and a list of columns, and reports a new
				layout through <code>on:change</code>. It stores nothing itself, so where a layout is saved
				stays your decision.
			</p>
			<pre><code
					>{`<WidgetBoard bind:widgets {columns} on:change={(e) => save(e.detail.widgets)} />`}</code
				></pre>
			<p>
				Registering a widget takes three edits and none of them is the board: an entry in
				<code>src/lib/widgets/manifest.ts</code>, a line in
				<code>src/lib/widgets/index.ts</code>, and the component itself. The kit ships six standard
				widgets — stat, clock, checklist, meter, notes and links — all running at
				<a href="/components#widgets">/components</a>; delete the ones your app does not use. The
				two actions underneath the board — <code>use:draggable</code> and
				<code>use:dropzone</code> — work on any markup, so a sortable list or a nav reorder needs no board
				at all.
			</p>
			<h3>Keyboard control</h3>
			<p>
				Every pointer gesture has a keyboard equivalent, announced through a live region. Focus a
				drag handle, then:
			</p>
			<ul>
				<li><strong>Space or Enter</strong> — pick the widget up, and put it down again.</li>
				<li><strong>Arrow up and down</strong> — move it within its column.</li>
				<li><strong>Arrow left and right</strong> — move it to the column either side.</li>
				<li><strong>Escape</strong> — cancel, returning it to where it started.</li>
			</ul>
			<p>
				On a touchscreen, hold a handle briefly before dragging — a swipe stays a swipe, so the page
				still scrolls. Dragging near the top or bottom edge scrolls the page with you.
			</p>
			<h3>The rule that will bite you</h3>
			<p>
				A widget's stored state must be inert. A value that changes on a timer — a price, a clock, a
				connection count — goes out through the widget's <code>live</code> event and comes back in
				through the board's <code>live</code> prop; it must never be written into
				<code>widget.title</code>, which is persisted. Ignoring this is how a dashboard rewrites its
				whole layout every thirty seconds and burns a day's storage quota from one open tab.
			</p>
			<p>
				Full reference, including the reorder contract and the component checklist:
				<code>docs/WIDGET_BOARD.md</code>.
			</p>
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
				library sits in the request path. The browser receives an unsigned opaque session token
				(random, worthless without its server-side record — its SHA-256 digest is the lookup key),
				while the revocable session record, identity, and roles are loaded from D1 on every request.
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

		<section id="secrets-at-rest" class="docs-section">
			<h2>Secrets at Rest</h2>
			<p>
				AI provider keys and OAuth client secrets saved from the admin screens are encrypted
				(AES-256-GCM, bound to their record) before they are written to KV, and the admin UI only
				shows that a key is configured plus its last four characters. Set the
				<code>ENCRYPTION_KEY</code> secret (<code>bun run generate:encryption-key</code>) so the key
				lives outside KV; without it the app generates one and keeps it in KV, which encrypts the
				values but does not defend against someone who can read the whole namespace. To rotate, move
				the old value to <code>ENCRYPTION_KEY_PREVIOUS</code>; values are re-encrypted when read.
				Plaintext keys saved by earlier versions are migrated on first read.
			</p>
		</section>

		<section id="admin-analytics" class="docs-section">
			<h2>Admin Analytics</h2>
			<p>
				<code>/admin</code> is the built-in analytics surface: traffic over a 1, 7, 30, or 90-day window,
				views by route, the most-read CMS items, referrers, countries, an audience breakdown, and user
				and content growth over time. It is first-party — there is no third-party script, no account,
				and no API key to provision.
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
							Apply migrations <code>0007</code> through <code>0009</code>, plus
							<code>0014</code> for the Top content table, with
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
						<li>
							<strong>Top content</strong> appears once a published CMS item is read. It is the only counter
							whose row count grows with your catalogue rather than with a fixed list, so on a large catalogue
							watch it — the retention cron is what keeps it in hand.
						</li>
					</ol>
				</div>
				<div class="callout-card">
					<h3>Granting Access</h3>
					<p>
						The owner always sees the dashboard stats. Any other admin needs the <code
							>can_view_stats</code
						>
						flag, which defaults to off so existing admins do not gain access on upgrade. Without it,
						an admin still lands on <code>/admin</code> but sees no stats:
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
				<div class="callout-card">
					<h3>Reading Stats From a Dashboard</h3>
					<p>
						An external dashboard can read the same numbers as JSON. The owner issues a
						<strong>stats token</strong> under "Dashboard access" on
						<code>/admin/analytics</code>; it is shown once, and only its hash is stored. The
						dashboard then sends it as a bearer token:
					</p>
					<pre><code
							>curl https://your-app/api/stats/summary?window=7 \
  -H "Authorization: Bearer nks_…"</code
						></pre>
					<p>
						The response is read-only and aggregate-only — exactly what <code>/admin</code> shows. Rotate
						replaces the token; Revoke cuts the dashboard off on its next read. A site that has never
						issued one answers 401 to every request.
					</p>
				</div>
				<div class="callout-card">
					<h3>Connecting Google Analytics</h3>
					<p>
						Optional, and off until you turn it on. The owner opens
						<code>/admin/analytics</code>, pastes either the GA4 Measurement ID (<code
							>G-ABCD123456</code
						>) or the whole <code>gtag.js</code> snippet — the ID is read out of it — and saves. A toggle
						pauses the tag without discarding the ID, and Disconnect removes it entirely.
					</p>
					<p>
						The tag loads on public pages only. <code>/admin</code>, <code>/api</code>, and
						<code>/setup</code> are excluded, so your own admin traffic stays out of the numbers, and
						page views are sent on every client-side navigation rather than by gtag's automatic tracking,
						which would count only the first page of a visit.
					</p>
					<p>
						This is additive: the built-in stats keep working, and reports are read in Google's own
						console. Google Analytics sets cookies and collects per-visitor data, which is a
						different privacy posture from the built-in counters — review your privacy policy and
						add a consent banner where your jurisdiction requires one. Only the owner can change the
						connection.
					</p>
				</div>
			</div>
		</section>

		<section id="shop-pages-api" class="docs-section">
			<h2>Shop, Pages and the Site API</h2>
			<p>
				Three packages live in <code>packages/</code>, each versioned on its own:
				<code>@nebulakit/commerce</code> (products, cart pricing, checkout, orders, Stripe,
				Printful),
				<code>@nebulakit/builder</code> (drag-and-drop pages stored as data), and
				<code>@nebulakit/security</code> (API keys). Security updates are forced to every site; the other
				two are opt-in.
			</p>
			<div class="callout-grid">
				<div class="callout-card">
					<h3>Pages</h3>
					<p>
						Build pages at <code>/admin/pages</code>: drag blocks from the palette onto the page or
						into a Section or Column, reorder and nest them, edit each block's fields, hide a block
						on phones, tablets or desktops, preview at each width, and publish. Mouse, touch and
						keyboard all work: every drag has Add, Move up/down, Move in and Move out buttons, plus
						Alt+Arrow keys, and Undo and Redo (Ctrl/⌘+Z) cover every edit. A check list flags images
						without a description, skipped heading levels and vague link text. Published pages are
						served at <code>/p/[slug]</code> and listed in the sitemap. Every save that changes a
						page keeps a revision (the newest 50), listed under History in the editor and at
						<code>/api/v1/pages/[slug]/revisions</code>; restoring one is itself saved, so it can be
						undone. A page is a JSON document (format version 2: a tree of blocks), never code.
					</p>
				</div>
				<div class="callout-card">
					<h3>Storefront</h3>
					<p>
						Shoppers browse <code>/shop</code> and <code>/shop/[slug]</code>, add products to a cart
						kept in their browser, and check out at <code>/cart</code>. Prices, tax and shipping are
						always worked out on the server from the catalog; the cart only remembers what to ask
						for. Physical products ask for a shipping address. With Stripe configured the shopper
						goes on to pay; without it the order waits for a manual payment.
					</p>
				</div>
				<div class="callout-card">
					<h3>Regional pricing</h3>
					<p>
						<code>/admin/settings/pricing</code> lowers prices for shoppers in countries where money
						buys more, using a World Bank price level table shipped with the kit. It is off until
						you turn it on, and it only ever lowers a price. Set how much of the gap to pass on, the
						largest discount, which products it covers (digital only by default) and per-country
						overrides, and preview any country before saving. An order takes the least generous
						country among the one Cloudflare sees and the shipping address, so a VPN alone earns
						nothing. The cart shows the server's quoted total (<code
							>POST /api/v1/checkout/quote</code
						>) and each order records the multiplier and countries used. Settings are also at
						<code>GET/PUT /api/v1/pricing</code>, with scopes
						<code>pricing:read</code> and <code>pricing:write</code>. Apply migration
						<code>0022</code>; refresh the table with <code>bun run update:price-index</code>.
					</p>
				</div>
				<div class="callout-card">
					<h3>API keys</h3>
					<p>
						The owner manages access at <code>/admin/api-keys</code>: create a key with scopes and
						an expiry, see when it was last used, revoke it in one click, and read the call log. A
						key is shown once and stored hashed.
					</p>
				</div>
				<div class="callout-card">
					<h3>The site API</h3>
					<p>
						Everything is reachable under <code>/api/v1</code>, described at
						<code>/api/v1/openapi.json</code>. Send keys as <code>Authorization: Bearer nk_…</code>.
						Checkout (<code>POST /api/v1/checkout</code>) is public and prices every line from the
						catalog.
					</p>
				</div>
			</div>
			<p>
				Shop settings are environment variables, never request fields:
				<code>COMMERCE_TAX_RATE_PERCENT</code>, <code>COMMERCE_PRICES_INCLUDE_TAX</code>,
				<code>COMMERCE_FLAT_SHIPPING_CENTS</code>, <code>STRIPE_SECRET_KEY</code> and
				<code>STRIPE_WEBHOOK_SECRET</code> (webhook URL <code>/api/v1/webhooks/stripe</code>).
				Without a Stripe key, orders wait for a manual payment. <code>ORCHESTRATOR_KEY_SHA256</code>
				connects the Ammoura control room. Apply migrations <code>0016</code>–<code>0018</code> with
				<code>bun run db:migrate:local</code>.
			</p>
			<h3 id="orders-payments-email">Payments, status and email</h3>
			<p>
				The Stripe webhook answers <code>503</code> until <code>STRIPE_WEBHOOK_SECRET</code> is set,
				so Stripe keeps retrying. It handles <code>checkout.session.completed</code> and
				<code>checkout.session.async_payment_succeeded</code> (the order becomes paid),
				<code>checkout.session.async_payment_failed</code> and
				<code>checkout.session.expired</code> (a pending order is cancelled). A payment that is smaller
				than the order total, or in another currency, leaves the order pending for a person to check.
				Replays change nothing a second time.
			</p>
			<p>
				After paying, the shopper returns to <code>/cart?order=…</code>, which asks
				<code>GET /api/v1/orders/[id]/status</code> every 1.5 seconds for 20 seconds. That public endpoint
				returns the status word only, never an email, address or total, and the page says plainly when
				payment is still being confirmed.
			</p>
			<p>
				Email is optional. Set <code>RESEND_API_KEY</code> and <code>EMAIL_FROM</code> (and
				<code>EMAIL_REPLY_TO</code> if you want one), then apply migration <code>0020</code>. A
				receipt is sent when an order becomes paid and a shipping notice when it is marked shipped,
				each at most once per order: the <code>email_log</code> table refuses a second send. Without
				a key nothing is sent and the log records what was skipped. Email colours come from
				<code>emailTheme</code> in <code>src/lib/site.config.ts</code>.
			</p>
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

		<section id="lighthouse" class="docs-section">
			<h2>Lighthouse Monitoring</h2>
			<p>
				<code>/admin/lighthouse</code> shows Lighthouse scores for your own public pages, worst
				first, with the specific audits that failed underneath each one. Press
				<strong>Run now</strong> to audit on demand.
			</p>
			<h3>How it measures without a browser</h3>
			<p>
				Lighthouse drives a real Chrome. A Cloudflare Worker has no browser, and this project
				deploys to Pages, which has no Cron Triggers either. So the scores come from Google's
				PageSpeed Insights API, which runs Lighthouse on Google's infrastructure and returns the
				report over HTTP — the audit is a <code>fetch</code>.
			</p>
			<p>
				The catch is that PSI can only reach a <strong>public URL</strong>. It cannot audit
				localhost or anything before your first deploy, so <code>site.url</code> has to be real. Until
				it is, the admin page says so rather than showing an empty table.
			</p>
			<h3>Scheduling it</h3>
			<p>
				There is no cron in a Pages deployment, so the template ships a small Worker,
				<code>cron-worker/</code>, that calls the endpoint daily (see
				<a href="#scheduled-jobs">Scheduled Jobs</a>). Any scheduler that can POST works too, with
				the same shared secret as the other background jobs:
			</p>
			<pre><code
					>{`curl -X POST https://your-app.example/api/cron/lighthouse \\
  -H "Authorization: Bearer $CRON_SECRET"`}</code
				></pre>
			<p>
				Daily is plenty — PSI's keyless rate limit will not tolerate much more, and these scores do
				not move hourly. <code>PAGESPEED_API_KEY</code> is optional and only raises that limit. Full
				notes in <code>docs/LIGHTHOUSE_MONITORING.md</code>.
			</p>
		</section>

		<section id="scheduled-jobs" class="docs-section">
			<h2>Scheduled Jobs</h2>
			<p>
				Cloudflare Pages cannot run Cron Triggers, so a standalone Worker in
				<code>cron-worker/</code> wakes on a schedule and POSTs to the app's
				<code>/api/cron/*</code> routes with <code>CRON_SECRET</code>, retrying three times with
				exponential backoff. The app claims each job once per scheduled minute, so a retry or
				overlapping delivery never runs it twice, and records every run.
			</p>
			<p>
				<code>/admin/scheduled-jobs</code> lists each job with its last run, status and next
				expected run, and has a <strong>Run now</strong> button for admins.
			</p>
			<pre><code
					>{`cd cron-worker
# set TARGET_URL in wrangler.toml to your site's origin
bunx wrangler deploy
bunx wrangler secret put CRON_SECRET   # same value as on the Pages project`}</code
				></pre>
			<p>
				It needs migration <code>0023_scheduled_job_runs.sql</code>. Adding a job and the details
				are in <code>docs/SCHEDULED_JOBS.md</code>.
			</p>
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
		max-width: var(--layout-page-max-width);
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

	/* The shell fills the screen; body text does not. Only the section's own
	   paragraphs, lists and code blocks are capped — the child combinator leaves
	   text inside callout cards to fill its grid track. */
	.docs-section > p,
	.docs-section > ul,
	.docs-section > ol,
	.docs-section > pre {
		max-width: var(--layout-prose-max-width);
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

	/* Links inside prose carry an underline at rest — colour alone cannot mark a
	   link in a block of text (WCAG 1.4.1). Button-like links sit outside p/li
	   and keep their undecorated look. */
	.docs-section p a,
	.docs-section li a {
		text-decoration: underline;
		text-underline-offset: 0.15em;
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

	/* Past this width an auto-fit 1fr track stretches a two-card section into two
	   1200px cards. Cap the track and align the row with the text beside it. */
	@media (min-width: 1400px) {
		.callout-grid {
			grid-template-columns: repeat(auto-fit, minmax(250px, 480px));
			justify-content: start;
		}
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

	/* Prose link in the footer sentence — underlined at rest (WCAG 1.4.1). */
	.docs-footer p a {
		text-decoration: underline;
		text-underline-offset: 0.15em;
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
		/* Left-aligned rather than centred: on a wide shell the terminal belongs
		   under its heading, not floating mid-page. Below 980px it fills anyway. */
		margin: 0 auto 0 0;
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
