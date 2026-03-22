<script lang="ts">
	import SharingMeta from '$lib/components/SharingMeta.svelte';
	const currentYear = new Date().getFullYear();
	const lastUpdated = 'January 1, 2026';
</script>

<SharingMeta
	title="Terms of Service"
	description="Terms of Service for NebulaKit"
/>

<main class="legal-page">
	<div class="legal-container">
		<header class="legal-header">
			<h1>Terms of Service</h1>
			<p class="legal-updated">Last updated: {lastUpdated}</p>
		</header>

		<section class="legal-section">
			<h2>Acceptance of Terms</h2>
			<p>
				By accessing or using NebulaKit ("the Service"), you agree to be bound by these Terms of
				Service. If you do not agree to these terms, please do not use the Service.
			</p>
			<p>
				We reserve the right to modify these terms at any time. Changes will be effective
				immediately upon posting. Your continued use of the Service after any changes indicates your
				acceptance of the modified terms.
			</p>
		</section>

		<section class="legal-section">
			<h2>Use of Service</h2>
			<p>
				You agree to use the Service only for lawful purposes and in accordance with these Terms.
				You are responsible for ensuring that your use complies with all applicable laws and
				regulations.
			</p>
			<h3>Prohibited Activities</h3>
			<p>You may not:</p>
			<ul>
				<li>Use the Service for any illegal or unauthorized purpose</li>
				<li>Attempt to gain unauthorized access to the Service or its related systems</li>
				<li>Interfere with or disrupt the Service or servers or networks connected to it</li>
				<li>Transmit any malware, viruses, or harmful code</li>
				<li>Harass, abuse, or harm other users of the Service</li>
				<li>Collect or harvest any information from the Service without authorization</li>
			</ul>
		</section>

		<section class="legal-section">
			<h2>User Accounts</h2>
			<p>
				When you create an account, you must provide accurate and complete information. You are
				responsible for maintaining the security of your account credentials and for all activities
				that occur under your account.
			</p>
			<p>
				You agree to notify us immediately of any unauthorized use of your account. We reserve the
				right to suspend or terminate accounts that violate these terms.
			</p>
		</section>

		<section class="legal-section">
			<h2>Intellectual Property</h2>
			<p>
				The Service and its original content, features, and functionality are owned by *Space and
				its licensors. The Service is protected by copyright, trademark, and other intellectual
				property laws.
			</p>
			<p>
				NebulaKit is open-source software. The source code is available under the terms of its
				applicable license. Your use of the source code is subject to that license.
			</p>
		</section>

		<section class="legal-section">
			<h2>User Content</h2>
			<p>
				You retain ownership of any content you submit to the Service. By submitting content, you
				grant us a non-exclusive, worldwide, royalty-free license to use, store, and display your
				content as necessary to provide the Service.
			</p>
			<p>
				You are responsible for your content and represent that you have all necessary rights to
				submit it.
			</p>
		</section>

		<section class="legal-section">
			<h2>Third-Party Services</h2>
			<p>
				The Service may integrate with or link to third-party services (such as OAuth providers and
				AI services). Your use of these services is subject to their respective terms and privacy
				policies. We are not responsible for the content or practices of any third-party services.
			</p>
		</section>

		<section class="legal-section">
			<h2>Limitation of Liability</h2>
			<p>
				THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER
				EXPRESS OR IMPLIED. TO THE FULLEST EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES,
				INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
				NON-INFRINGEMENT.
			</p>
			<p>
				IN NO EVENT SHALL *SPACE, ITS AFFILIATES, OR THEIR RESPECTIVE OFFICERS, DIRECTORS,
				EMPLOYEES, OR AGENTS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR
				PUNITIVE DAMAGES ARISING OUT OF OR RELATING TO YOUR USE OF THE SERVICE.
			</p>
		</section>

		<section class="legal-section">
			<h2>Indemnification</h2>
			<p>
				You agree to indemnify and hold harmless *Space and its affiliates from any claims, damages,
				losses, or expenses (including reasonable attorneys' fees) arising from your use of the
				Service or violation of these Terms.
			</p>
		</section>

		<section class="legal-section">
			<h2>Termination</h2>
			<p>
				We may terminate or suspend your access to the Service immediately, without prior notice,
				for any reason, including breach of these Terms. Upon termination, your right to use the
				Service will cease immediately.
			</p>
		</section>

		<section class="legal-section">
			<h2>Governing Law</h2>
			<p>
				These Terms shall be governed by and construed in accordance with applicable laws, without
				regard to conflict of law principles.
			</p>
		</section>

		<section class="legal-section">
			<h2>Contact Us</h2>
			<p>
				If you have any questions about these Terms of Service, please contact us through our <a
					href="https://github.com/starspacegroup/NebulaKit"
					target="_blank"
					rel="noopener noreferrer">GitHub repository</a
				>.
			</p>
			<p>
				For information about how we collect and use your data, please see our
				<a href="/privacy">Privacy Policy</a>.
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
