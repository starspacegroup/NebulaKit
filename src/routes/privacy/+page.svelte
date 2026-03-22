<script lang="ts">
	import SharingMeta from '$lib/components/SharingMeta.svelte';
	const currentYear = new Date().getFullYear();
	const lastUpdated = 'January 1, 2026';
</script>

<SharingMeta
	title="Privacy Policy"
	description="Privacy Policy for NebulaKit"
/>

<main class="legal-page">
	<div class="legal-container">
		<header class="legal-header">
			<h1>Privacy Policy</h1>
			<p class="legal-updated">Last updated: {lastUpdated}</p>
		</header>

		<section class="legal-section">
			<h2>Introduction</h2>
			<p>
				This Privacy Policy explains how NebulaKit ("we", "us", or "our") collects, uses, and
				protects your information when you use our service. We are committed to protecting your
				privacy and handling your data responsibly.
			</p>
		</section>

		<section class="legal-section">
			<h2>Information We Collect</h2>
			<p>We may collect the following types of information:</p>

			<h3>Account Information</h3>
			<p>
				When you create an account, we collect your email address and, if you use OAuth
				authentication, basic profile information from your OAuth provider (such as your name and
				profile picture).
			</p>

			<h3>Usage Information</h3>
			<p>
				We collect information about how you use the Service, including pages visited, features
				used, and interactions with the chat interface.
			</p>

			<h3>Chat Data</h3>
			<p>
				When you use the AI chat feature, we store your conversation history to provide context for
				future interactions and improve your experience.
			</p>

			<h3>Technical Information</h3>
			<p>
				We automatically collect certain technical information, including your IP address, browser
				type, and device information, for security and analytics purposes.
			</p>
		</section>

		<section class="legal-section">
			<h2>How We Use Your Information</h2>
			<p>We use the information we collect to:</p>
			<ul>
				<li>Provide, maintain, and improve the Service</li>
				<li>Authenticate users and secure accounts</li>
				<li>Process and respond to your chat interactions</li>
				<li>Send important notifications about the Service</li>
				<li>Detect and prevent fraud or abuse</li>
				<li>Analyze usage patterns to improve user experience</li>
			</ul>
		</section>

		<section class="legal-section">
			<h2>Data Storage and Security</h2>
			<p>
				Your data is stored securely using Cloudflare's infrastructure, including Cloudflare D1 for
				database storage. We implement appropriate technical and organizational measures to protect
				your information against unauthorized access, alteration, disclosure, or destruction.
			</p>
			<p>
				While we strive to protect your data, no method of transmission over the Internet or
				electronic storage is 100% secure. We cannot guarantee absolute security.
			</p>
		</section>

		<section class="legal-section">
			<h2>Data Sharing</h2>
			<p>
				We do not sell your personal information. We may share your information in the following
				circumstances:
			</p>
			<ul>
				<li>
					<strong>AI Providers:</strong> Chat messages may be sent to AI service providers (such as OpenAI,
					Anthropic, or Cloudflare Workers AI) to generate responses
				</li>
				<li>
					<strong>OAuth Providers:</strong> Authentication data is exchanged with OAuth providers during
					login
				</li>
				<li>
					<strong>Legal Requirements:</strong> We may disclose information if required by law or to protect
					our rights
				</li>
			</ul>
		</section>

		<section class="legal-section">
			<h2>Cookies and Tracking</h2>
			<p>
				We use cookies and similar technologies to maintain your session and preferences. These are
				essential for the Service to function properly.
			</p>
			<p>We use:</p>
			<ul>
				<li><strong>Session cookies:</strong> To keep you logged in during your visit</li>
				<li>
					<strong>Preference cookies:</strong> To remember your settings (such as theme preference)
				</li>
			</ul>
			<p>We do not use third-party tracking cookies or advertising cookies.</p>
		</section>

		<section class="legal-section">
			<h2>Your Rights</h2>
			<p>Depending on your jurisdiction, you may have the following rights:</p>
			<ul>
				<li><strong>Access:</strong> Request a copy of your personal data</li>
				<li><strong>Correction:</strong> Request correction of inaccurate data</li>
				<li><strong>Deletion:</strong> Request deletion of your personal data</li>
				<li><strong>Export:</strong> Request a portable copy of your data</li>
				<li><strong>Objection:</strong> Object to certain processing of your data</li>
			</ul>
			<p>
				To exercise these rights, please contact us through our GitHub repository or use the account
				management features in your profile settings.
			</p>
		</section>

		<section class="legal-section">
			<h2>Data Retention</h2>
			<p>
				We retain your data for as long as your account is active or as needed to provide the
				Service. You can delete your account at any time through your profile settings. Upon account
				deletion, we will delete or anonymize your personal data within a reasonable timeframe,
				except where retention is required by law.
			</p>
		</section>

		<section class="legal-section">
			<h2>Children's Privacy</h2>
			<p>
				The Service is not intended for children under 13 years of age. We do not knowingly collect
				personal information from children under 13. If we become aware that we have collected such
				information, we will take steps to delete it.
			</p>
		</section>

		<section class="legal-section">
			<h2>Changes to This Policy</h2>
			<p>
				We may update this Privacy Policy from time to time. We will notify you of any material
				changes by posting the new policy on this page and updating the "Last updated" date.
			</p>
		</section>

		<section class="legal-section">
			<h2>Contact Us</h2>
			<p>
				If you have any questions about this Privacy Policy, please contact us through our <a
					href="https://github.com/starspacegroup/NebulaKit"
					target="_blank"
					rel="noopener noreferrer">GitHub repository</a
				>.
			</p>
			<p>
				For information about how you can use the Service, please see our
				<a href="/terms">Terms of Service</a>.
			</p>
		</section>
	</div>
</main>

<style>
	.legal-page {
		min-height: 100vh;
		padding: var(--spacing-xl) var(--spacing-md);
		background-color: var(--color-background);
	}

	.legal-container {
		max-width: 800px;
		margin: 0 auto;
	}

	.legal-header {
		text-align: center;
		margin-bottom: var(--spacing-2xl);
		padding-bottom: var(--spacing-xl);
		border-bottom: 1px solid var(--color-border);
	}

	.legal-header h1 {
		font-size: 2.5rem;
		font-weight: 700;
		color: var(--color-text);
		margin-bottom: var(--spacing-sm);
	}

	.legal-updated {
		color: var(--color-text-secondary);
		font-size: 0.9375rem;
	}

	.legal-section {
		margin-bottom: var(--spacing-2xl);
	}

	.legal-section h2 {
		font-size: 1.5rem;
		font-weight: 600;
		color: var(--color-text);
		margin-bottom: var(--spacing-md);
	}

	.legal-section h3 {
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--color-text);
		margin-top: var(--spacing-lg);
		margin-bottom: var(--spacing-sm);
	}

	.legal-section p {
		color: var(--color-text-secondary);
		line-height: 1.7;
		margin-bottom: var(--spacing-md);
	}

	.legal-section ul {
		color: var(--color-text-secondary);
		margin-left: var(--spacing-xl);
		margin-bottom: var(--spacing-md);
	}

	.legal-section li {
		margin-bottom: var(--spacing-sm);
		line-height: 1.6;
	}

	.legal-section a {
		color: var(--color-primary);
		text-decoration: none;
	}

	.legal-section a:hover {
		text-decoration: underline;
	}

	@media (min-width: 768px) {
		.legal-page {
			padding: var(--spacing-2xl);
		}

		.legal-header h1 {
			font-size: 3rem;
		}
	}
</style>
