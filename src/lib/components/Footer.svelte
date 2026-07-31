<script lang="ts">
	import { site, repoUrl } from '$lib/site.config';

	const currentYear = new Date().getFullYear();
</script>

<footer class="footer">
	<div class="footer-container">
		<div class="footer-content">
			<!-- Brand Column -->
			<div class="footer-brand">
				<a href="/" class="footer-logo">
					<span class="logo-icon">✨</span>
					<span class="logo-text">{site.name}</span>
				</a>
				<p class="footer-tagline">
					{site.tagline}
				</p>
				<div class="footer-badge">
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<path d="M12 2L2 7l10 5 10-5-10-5z" />
						<path d="M2 17l10 5 10-5" />
						<path d="M2 12l10 5 10-5" />
					</svg>
					<span>Powered by Cloudflare</span>
				</div>
			</div>

			<!-- Navigation Links -->
			<nav class="footer-nav" aria-label="Footer navigation">
				<div class="footer-section">
					<h3 class="footer-heading">Navigation</h3>
					<ul class="footer-links">
						<li><a href="/">Home</a></li>
						<li><a href="/chat">Chat</a></li>
						<li><a href="/auth/login">Sign In</a></li>
						<li><a href="/auth/signup">Sign Up</a></li>
					</ul>
				</div>

				<div class="footer-section">
					<h3 class="footer-heading">Resources</h3>
					<ul class="footer-links">
						<li>
							<a href="/documentation">Documentation</a>
						</li>
						<li>
							<a href={repoUrl} target="_blank" rel="noopener noreferrer"> GitHub </a>
						</li>
					</ul>
				</div>

				<div class="footer-section">
					<h3 class="footer-heading">Legal</h3>
					<ul class="footer-links">
						<li><a href="/privacy">Privacy Policy</a></li>
						<li><a href="/terms">Terms of Service</a></li>
					</ul>
				</div>
			</nav>
		</div>

		<!-- Bottom Bar -->
		<div class="footer-bottom">
			<p class="footer-copyright">
				© {currentYear}
				{site.name}. Created by
				<a href={site.authorUrl} target="_blank" rel="noopener noreferrer" class="starspace-link"
					>{site.author}</a
				>.
			</p>
			<div class="footer-social">
				<a
					href={repoUrl}
					target="_blank"
					rel="noopener noreferrer"
					aria-label="GitHub Repository"
					class="social-link"
				>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
						<path
							d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"
						/>
					</svg>
				</a>
			</div>
		</div>
	</div>
</footer>

<style>
	.footer {
		background-color: var(--color-surface);
		border-top: 1px solid var(--color-border);
		padding: var(--spacing-2xl) var(--spacing-md);
	}

	.footer-container {
		max-width: var(--layout-chrome-max-width);
		margin: 0 auto;
	}

	.footer-content {
		display: grid;
		grid-template-columns: 1fr;
		gap: var(--spacing-2xl);
		margin-bottom: var(--spacing-2xl);
	}

	/* Brand Column */
	.footer-brand {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-md);
	}

	.footer-logo {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-sm);
		text-decoration: none;
		color: var(--color-text);
		font-weight: 600;
		font-size: 1.125rem;
	}

	.footer-logo:hover {
		color: var(--color-primary);
	}

	.logo-icon {
		font-size: 1.25rem;
	}

	.footer-tagline {
		color: var(--color-text-secondary);
		font-size: 0.875rem;
		line-height: 1.6;
		max-width: 280px;
	}

	.footer-badge {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-xs);
		padding: var(--spacing-xs) var(--spacing-sm);
		background-color: var(--color-background);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		font-size: 0.75rem;
		color: var(--color-text-secondary);
		width: fit-content;
	}

	.footer-badge svg {
		color: var(--color-primary);
	}

	/* Navigation */
	.footer-nav {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: var(--spacing-xl);
	}

	.footer-section {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-sm);
	}

	.footer-heading {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-text);
		margin-bottom: var(--spacing-xs);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.footer-links {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xs);
	}

	.footer-links a {
		color: var(--color-text-secondary);
		font-size: 0.875rem;
		text-decoration: none;
		transition: color var(--transition-fast);
	}

	.footer-links a:hover {
		color: var(--color-primary);
	}

	/* Bottom Bar */
	.footer-bottom {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-md);
		padding-top: var(--spacing-xl);
		border-top: 1px solid var(--color-border);
	}

	.footer-copyright {
		color: var(--color-text-secondary);
		font-size: 0.813rem;
		text-align: center;
	}

	.starspace-link {
		color: var(--color-primary);
		text-decoration: none;
		font-weight: 500;
		transition: color var(--transition-fast);
	}

	.starspace-link:hover {
		color: var(--color-secondary);
	}

	.footer-social {
		display: flex;
		gap: var(--spacing-md);
	}

	.social-link {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border-radius: var(--radius-md);
		color: var(--color-text-secondary);
		background-color: var(--color-background);
		border: 1px solid var(--color-border);
		transition:
			color var(--transition-fast),
			border-color var(--transition-fast),
			background-color var(--transition-fast);
	}

	.social-link:hover {
		color: var(--color-primary);
		border-color: var(--color-primary);
		background-color: var(--color-surface-hover);
	}

	/* Tablet and up */
	@media (min-width: 768px) {
		.footer {
			padding: var(--spacing-2xl) var(--spacing-xl);
		}

		.footer-content {
			grid-template-columns: 1.5fr 2fr;
			gap: var(--spacing-2xl);
		}

		.footer-bottom {
			flex-direction: row;
			justify-content: space-between;
		}
	}

	/* Desktop */
	@media (min-width: 1024px) {
		.footer-content {
			grid-template-columns: 1.2fr 2fr;
		}

		.footer-nav {
			grid-template-columns: repeat(3, 1fr);
		}
	}
</style>
