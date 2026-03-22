<script lang="ts">
	import SharingMeta from '$lib/components/SharingMeta.svelte';
	// No runtime state needed
</script>

<SharingMeta
	title="Documentation"
	description="NebulaKit documentation - Learn how to build with the cosmic-grade SvelteKit starter powered by Cloudflare"
/>

<main class="docs-page">
	<div class="docs-container">
		<header class="docs-header">
			<h1>✨ NebulaKit Documentation</h1>
			<p class="docs-intro">
				A cosmic-grade SvelteKit starter template powered by Cloudflare's full stack.
				Production-ready with Cloudflare Workers integration (D1, KV, R2, Queues, Turnstile), a
				complete theme system, command palette, LLM chat UI, full authentication, and polished
				drag-and-drop.
			</p>
		</header>

		<nav class="docs-nav" aria-label="Documentation navigation">
			<a href="#features">Features</a>
			<a href="#quick-start">Quick Start</a>
			<a href="#testing">Testing</a>
			<a href="#project-structure">Structure</a>
			<a href="#theming">Theming</a>
			<a href="#authentication">Auth</a>
			<a href="#cloudflare">Cloudflare</a>
			<a href="#deployment">Deployment</a>
			<a href="#zero-config">Zero-Config (Optional)</a>
			<a href="#contributing">Contributing</a>
		</nav>

		<section id="features" class="docs-section">
			<h2>🌟 Features</h2>
			<div class="feature-grid">
				<div class="feature-card">
					<h3>🚀 Cloudflare Full Stack</h3>
					<p>D1 database, KV storage, R2 buckets, Queues, and Turnstile built-in.</p>
				</div>
				<div class="feature-card">
					<h3>🎨 Theme System</h3>
					<p>Light/dark modes with extensible CSS variables and WCAG AA compliance.</p>
				</div>
				<div class="feature-card">
					<h3>⌨️ Command Palette</h3>
					<p>Keyboard-first navigation with Cmd/Ctrl + K.</p>
				</div>
				<div class="feature-card">
					<h3>💬 LLM Chat UI</h3>
					<p>Ready-to-use chat interface for AI integration with multiple providers.</p>
				</div>
				<div class="feature-card">
					<h3>🔐 Full Authentication</h3>
					<p>Email/password + SSO (Google, GitHub) with account linking.</p>
				</div>
				<div class="feature-card">
					<h3>📱 Mobile-First</h3>
					<p>Responsive layouts optimized for all devices.</p>
				</div>
				<div class="feature-card">
					<h3>🎯 Drag & Drop</h3>
					<p>Polished DnD with cross-column and mobile support.</p>
				</div>
				<div class="feature-card">
					<h3>⚡ TypeScript</h3>
					<p>Full type safety with Cloudflare Workers types.</p>
				</div>
				<div class="feature-card">
					<h3>🎨 UI Components</h3>
					<p>Beautiful, accessible components out of the box.</p>
				</div>
			</div>
		</section>

		<section id="quick-start" class="docs-section">
			<h2>🚀 Quick Start</h2>

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
					Use this template
				</a>
			</div>

			<p class="template-hint">
				Click the button above to create your own repository from the NebulaKit template on GitHub.
			</p>

			<pre><code
					># Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Deploy to Cloudflare Pages
npm run deploy</code
				></pre>
			<p>
				Visit <code>http://localhost:4277</code> to see your app!
			</p>
		</section>

		<section id="testing" class="docs-section">
			<h2>🧪 Testing (TDD Required!)</h2>
			<p>
				NebulaKit follows <strong>Test-Driven Development</strong> with 90%+ code coverage requirements.
			</p>
			<pre><code
					># Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Check coverage (must be ≥90%)
npm run test:coverage

# Run E2E tests
npm run test:e2e

# Run all tests (unit + E2E)
npm run test:all</code
				></pre>
			<p>
				<strong>Important:</strong> All features and bug fixes require tests written FIRST.
			</p>
		</section>

		<section id="project-structure" class="docs-section">
			<h2>🏗️ Project Structure</h2>
			<pre><code
					>NebulaKit/
├── src/
│   ├── lib/
│   │   ├── components/     # Reusable UI components
│   │   ├── stores/         # Svelte stores (theme, etc.)
│   │   ├── server/         # Server-side utilities
│   │   └── utils/          # Helper functions
│   ├── routes/             # SvelteKit routes
│   │   ├── auth/          # Authentication pages
│   │   ├── chat/          # LLM chat interface
│   │   └── documentation/ # Project documentation
│   ├── app.css            # Global styles & theme
│   └── app.html           # HTML template
├── static/                 # Static assets
└── wrangler.toml          # Cloudflare configuration</code
				></pre>
		</section>

		<section id="theming" class="docs-section">
			<h2>🎨 Theming</h2>
			<p>NebulaKit includes a comprehensive theme system with:</p>
			<ul>
				<li><strong>WCAG AA compliant</strong> colors (4.5:1 contrast minimum)</li>
				<li>Light and dark modes with automatic system detection</li>
				<li>CSS custom properties for all design tokens</li>
				<li>Accessibility-first design approach</li>
				<li>Automated contrast validation</li>
			</ul>
			<pre><code
					>/* All colors use CSS variables - never hardcode! */
.button &#123;
  background-color: var(--color-primary);
  color: var(--color-background);
  border-radius: var(--radius-md);
  padding: var(--spacing-sm) var(--spacing-md);
&#125;</code
				></pre>
			<h3>Validate Theme Contrast</h3>
			<pre><code>npm run validate:contrast</code></pre>
		</section>

		<section id="authentication" class="docs-section">
			<h2>🔐 Authentication</h2>
			<p>Built-in auth pages with support for:</p>
			<ul>
				<li>Email/password authentication</li>
				<li>OAuth providers (Google, GitHub)</li>
				<li>Session management</li>
				<li>Account linking</li>
			</ul>
			<p>
				Easily extend with <a href="https://authjs.dev/" target="_blank" rel="noopener noreferrer"
					>@auth/sveltekit</a
				> for more providers.
			</p>
		</section>

		<section id="cloudflare" class="docs-section">
			<h2>☁️ Cloudflare Integration</h2>

			<h3>D1 Database</h3>
			<pre><code
					>const result = await platform.env.DB
  .prepare('SELECT * FROM users WHERE email = ?')
  .bind(email)
  .first();</code
				></pre>

			<h3>KV Storage</h3>
			<pre><code
					>await platform.env.KV.put('key', 'value');
const value = await platform.env.KV.get('key');</code
				></pre>

			<h3>R2 Storage</h3>
			<pre><code
					>await platform.env.BUCKET.put('file.jpg', fileData);
const file = await platform.env.BUCKET.get('file.jpg');</code
				></pre>

			<h3>Queues</h3>
			<pre><code>await platform.env.QUEUE.send(&#123; data: 'message' &#125;);</code></pre>
		</section>

		<section id="deployment" class="docs-section">
			<h2>🚀 Deployment</h2>
			<p>
				NebulaKit is designed to be deployed via <strong>Cloudflare Pages</strong> connected to your
				GitHub repository for automatic deployments.
			</p>

			<h3>Step 1: Fork or Clone the Repository</h3>
			<p>
				Fork <a
					href="https://github.com/starspacegroup/NebulaKit"
					target="_blank"
					rel="noopener noreferrer">NebulaKit on GitHub</a
				> to your own account, or create a new repository from the template.
			</p>

			<h3>Step 2: Create a Pages Application</h3>
			<ol>
				<li>
					Log in to the <a
						href="https://dash.cloudflare.com/"
						target="_blank"
						rel="noopener noreferrer">Cloudflare Dashboard</a
					>
				</li>
				<li>Navigate to <strong>Workers & Pages</strong> in the sidebar</li>
				<li>
					Click <strong>Create</strong> → <strong>Pages</strong> → <strong>Connect to Git</strong>
				</li>
				<li>Authorize Cloudflare to access your GitHub account</li>
				<li>Select your NebulaKit repository</li>
			</ol>

			<h3>Step 3: Configure Build Settings</h3>
			<ul>
				<li><strong>Framework preset:</strong> SvelteKit</li>
				<li><strong>Build command:</strong> <code>npm run build</code></li>
				<li><strong>Build output directory:</strong> <code>.svelte-kit/cloudflare</code></li>
			</ul>

			<h3>Step 4: Set Up D1 Database</h3>
			<ol>
				<li>
					In the Cloudflare Dashboard, go to <strong>Workers & Pages</strong> → <strong>D1</strong>
				</li>
				<li>
					Click <strong>Create database</strong> and name it (e.g., <code>nebulakit-db</code>)
				</li>
				<li>Run the schema migration from the <code>migrations/schema.sql</code> file</li>
				<li>
					In your Pages project settings, go to <strong>Settings</strong> →
					<strong>Functions</strong> → <strong>D1 database bindings</strong>
				</li>
				<li>Add a binding with variable name <code>DB</code> pointing to your database</li>
			</ol>

			<h3>Step 5: Configure Environment Variables</h3>
			<p>
				In your Pages project, go to <strong>Settings</strong> →
				<strong>Environment variables</strong> and add:
			</p>
			<ul>
				<li><code>AUTH_SECRET</code> - A random secret for session encryption</li>
				<li><code>AUTH_TRUST_HOST</code> - Set to <code>true</code></li>
				<li><code>GITHUB_ID</code> / <code>GITHUB_SECRET</code> - For GitHub OAuth (optional)</li>
				<li><code>GOOGLE_ID</code> / <code>GOOGLE_SECRET</code> - For Google OAuth (optional)</li>
				<li><code>OPENAI_API_KEY</code> - For AI chat features (optional)</li>
			</ul>

			<h3>Step 6: Deploy</h3>
			<p>
				Click <strong>Save and Deploy</strong>. Cloudflare will build and deploy your app. Future
				pushes to your main branch will trigger automatic deployments, and pull requests will get
				preview deployments.
			</p>

			<h3>Custom Domain (Optional)</h3>
			<p>
				In your Pages project, go to <strong>Custom domains</strong> to add your own domain. Cloudflare
				will automatically provision SSL certificates.
			</p>
		</section>

		<section id="tech-stack" class="docs-section">
			<h2>🛠️ Tech Stack</h2>
			<ul>
				<li>
					<a href="https://kit.svelte.dev/" target="_blank" rel="noopener noreferrer">SvelteKit</a> -
					Web framework
				</li>
				<li>
					<a href="https://workers.cloudflare.com/" target="_blank" rel="noopener noreferrer"
						>Cloudflare Workers</a
					> - Edge runtime
				</li>
				<li>
					<a href="https://www.typescriptlang.org/" target="_blank" rel="noopener noreferrer"
						>TypeScript</a
					> - Type safety
				</li>
				<li>
					<a href="https://vitejs.dev/" target="_blank" rel="noopener noreferrer">Vite</a> - Build tool
				</li>
				<li>
					<a href="https://vitest.dev/" target="_blank" rel="noopener noreferrer">Vitest</a> - Unit testing
				</li>
				<li>
					<a href="https://playwright.dev/" target="_blank" rel="noopener noreferrer">Playwright</a>
					- E2E testing
				</li>
			</ul>
		</section>

		<section id="zero-config" class="docs-section">
			<h2>🔧 Zero-Config Setup (Optional)</h2>
			<div class="recommended-box">
				<strong>💡 Recommended:</strong> For production deployments, we recommend using
				<strong>secure environment variables</strong> in Cloudflare Pages (see Deployment section
				above). The zero-config setup below is an <em>alternative approach</em> for scenarios where you
				want to configure credentials via a web UI instead.
			</div>

			<p>
				NebulaKit can also work <strong>without any pre-configured environment variables</strong>.
				All configuration is done through a web-based setup flow and stored in Cloudflare KV.
			</p>

			<h3>When to Use Zero-Config</h3>
			<ul>
				<li>👥 Non-technical users deploying their own instance</li>
				<li>🧪 Quick prototyping and demos</li>
				<li>🔄 Scenarios requiring runtime credential changes without redeployment</li>
				<li>🎓 Learning and educational environments</li>
			</ul>

			<h3>The Setup Flow</h3>
			<div class="setup-flow">
				<div class="flow-step">
					<span class="step-number">1</span>
					<div class="step-content">
						<strong>Fresh Deploy</strong>
						<p>Deploy your app without any secrets or environment variables.</p>
					</div>
				</div>
				<div class="flow-arrow">→</div>
				<div class="flow-step">
					<span class="step-number">2</span>
					<div class="step-content">
						<strong>/setup Page</strong>
						<p>Navigate to <code>/setup</code> and enter your GitHub OAuth credentials.</p>
					</div>
				</div>
				<div class="flow-arrow">→</div>
				<div class="flow-step">
					<span class="step-number">3</span>
					<div class="step-content">
						<strong>Admin Login</strong>
						<p>Log in as the admin user. This permanently locks the setup page.</p>
					</div>
				</div>
			</div>

			<h3>The /reset Page</h3>
			<p>
				If you need to change OAuth credentials or the admin user, visit <code>/reset</code> to clear
				all setup configuration. This will:
			</p>
			<ul>
				<li>✅ Clear OAuth credentials</li>
				<li>✅ Clear admin owner settings</li>
				<li>✅ Unlock the setup page</li>
				<li>❌ NOT delete user accounts or app data</li>
			</ul>
			<div class="warning-box">
				<strong>⚠️ Security:</strong> After initial setup, disable the <code>/reset</code> route from
				the Admin Panel to prevent unauthorized resets.
			</div>
		</section>

		<section id="contributing" class="docs-section">
			<h2>🤝 Contributing</h2>
			<p>We welcome contributions! Key requirements:</p>
			<ul>
				<li>✅ Test-Driven Development (TDD) - write tests first</li>
				<li>✅ 90%+ code coverage on all changes</li>
				<li>✅ Cloudflare-first architecture</li>
				<li>✅ Minimal external dependencies</li>
				<li>✅ All tests passing before PR</li>
			</ul>
		</section>

		<section id="resources" class="docs-section">
			<h2>📚 Additional Resources</h2>
			<ul>
				<li>
					<a
						href="https://github.com/starspacegroup/NebulaKit"
						target="_blank"
						rel="noopener noreferrer">GitHub Repository</a
					>
				</li>
				<li>
					<a
						href="https://developers.cloudflare.com/workers/"
						target="_blank"
						rel="noopener noreferrer">Cloudflare Workers Docs</a
					>
				</li>
				<li>
					<a href="https://developers.cloudflare.com/d1/" target="_blank" rel="noopener noreferrer"
						>Cloudflare D1 Docs</a
					>
				</li>
				<li>
					<a href="https://kit.svelte.dev/docs" target="_blank" rel="noopener noreferrer"
						>SvelteKit Docs</a
					>
				</li>
				<li>
					<a href="https://vitest.dev/" target="_blank" rel="noopener noreferrer">Vitest Docs</a>
				</li>
				<li>
					<a href="https://playwright.dev/" target="_blank" rel="noopener noreferrer"
						>Playwright Docs</a
					>
				</li>
			</ul>
		</section>

		<footer class="docs-footer">
			<p>
				⭐ If you find NebulaKit useful, please consider giving it a star on <a
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
		max-width: 600px;
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
		color: var(--color-secondary);
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

	.feature-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: var(--spacing-lg);
		margin-top: var(--spacing-lg);
	}

	.feature-card {
		padding: var(--spacing-lg);
		background-color: var(--color-surface);
		border-radius: var(--radius-lg);
		border: 1px solid var(--color-border);
	}

	.feature-card h3 {
		margin-top: 0;
		margin-bottom: var(--spacing-sm);
		font-size: 1.125rem;
	}

	.feature-card p {
		margin-bottom: 0;
		font-size: 0.9375rem;
	}

	/* Zero-Config Setup Section */
	.setup-flow {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: var(--spacing-md);
		margin: var(--spacing-xl) 0;
	}

	.flow-step {
		display: flex;
		align-items: flex-start;
		gap: var(--spacing-md);
		padding: var(--spacing-lg);
		background-color: var(--color-surface);
		border-radius: var(--radius-lg);
		border: 1px solid var(--color-border);
		max-width: 220px;
	}

	.step-number {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		background-color: var(--color-primary);
		color: var(--color-background);
		border-radius: 50%;
		font-weight: bold;
		flex-shrink: 0;
	}

	.step-content strong {
		display: block;
		margin-bottom: var(--spacing-xs);
	}

	.step-content p {
		margin: 0;
		font-size: 0.875rem;
		color: var(--color-text-secondary);
	}

	.flow-arrow {
		font-size: 1.5rem;
		color: var(--color-text-secondary);
	}

	.warning-box {
		padding: var(--spacing-md);
		background-color: var(--color-surface);
		border: 1px solid var(--color-warning, #f59e0b);
		border-radius: var(--radius-md);
		margin-top: var(--spacing-md);
	}

	.recommended-box {
		padding: var(--spacing-md);
		background-color: var(--color-surface);
		border: 1px solid var(--color-primary);
		border-radius: var(--radius-md);
		margin-bottom: var(--spacing-lg);
	}

	.recommended-box em {
		color: var(--color-text-secondary);
	}

	@media (max-width: 768px) {
		.setup-flow {
			flex-direction: column;
		}

		.flow-arrow {
			transform: rotate(90deg);
		}

		.flow-step {
			max-width: 100%;
		}
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
		background-color: #238636;
		color: #ffffff !important;
		border-radius: var(--radius-md);
		font-size: 1rem;
		font-weight: 600;
		text-decoration: none;
		transition:
			background-color var(--transition-fast),
			transform var(--transition-fast);
	}

	.template-button:hover {
		background-color: #2ea043;
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
