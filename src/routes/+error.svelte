<script lang="ts">
	import { page } from '$app/stores';
	import SharingMeta from '$lib/components/SharingMeta.svelte';

	// Error messages and icons for different status codes
	const errorInfo: Record<number, { title: string; message: string; icon: string }> = {
		400: {
			title: 'Bad Request',
			message: 'Something went wrong with your request. Please check and try again.',
			icon: '⚠️'
		},
		401: {
			title: 'Unauthorized',
			message: 'You need to be logged in to access this page.',
			icon: '🔐'
		},
		403: {
			title: 'Forbidden',
			message: "You don't have permission to access this resource.",
			icon: '🚫'
		},
		404: {
			title: 'Lost in Space',
			message: "The page you're looking for has drifted into the cosmic void.",
			icon: '🌌'
		},
		500: {
			title: 'Server Error',
			message: "Our servers encountered an unexpected anomaly. We're on it!",
			icon: '💥'
		},
		502: {
			title: 'Bad Gateway',
			message: "We're having trouble connecting to our services.",
			icon: '🔌'
		},
		503: {
			title: 'Service Unavailable',
			message: "We're temporarily offline for maintenance. Please try again soon.",
			icon: '🔧'
		},
		504: {
			title: 'Gateway Timeout',
			message: 'The request took too long to process. Please try again.',
			icon: '⏱️'
		}
	};

	$: status = $page.status;
	$: error = $page.error;
	$: info = errorInfo[status] || {
		title: 'Something Went Wrong',
		message: error?.message || 'An unexpected error occurred.',
		icon: '❌'
	};
</script>

<SharingMeta
	title="{status} - {info.title}"
	noindex={true}
/>

<div class="error-page">
	<!-- Animated cosmic background -->
	<div class="cosmic-bg" aria-hidden="true">
		<div class="stars"></div>
		<div class="stars stars-2"></div>
		<div class="stars stars-3"></div>
		<div class="nebula"></div>
	</div>

	<main class="error-content">
		<!-- Floating icon -->
		<div class="error-icon" aria-hidden="true">
			<span class="icon-main">{info.icon}</span>
			<div class="icon-glow"></div>
		</div>

		<!-- Error code with glitch effect -->
		<h1 class="error-code">
			<span class="code-digit">{String(status).charAt(0)}</span>
			<span class="code-digit code-digit-center">{String(status).charAt(1)}</span>
			<span class="code-digit">{String(status).charAt(2)}</span>
		</h1>

		<!-- Error title -->
		<h2 class="error-title">{info.title}</h2>

		<!-- Error message -->
		<p class="error-message">{info.message}</p>

		<!-- Action buttons -->
		<div class="error-actions">
			<a href="/" class="btn btn-primary">
				<svg
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					aria-hidden="true"
				>
					<path
						d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1h3a1 1 0 001-1V10"
					/>
				</svg>
				Go Home
			</a>
			<button class="btn btn-secondary" on:click={() => history.back()}>
				<svg
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					aria-hidden="true"
				>
					<path d="M19 12H5M12 19l-7-7 7-7" />
				</svg>
				Go Back
			</button>
		</div>

		<!-- Debug info (only in dev) -->
		{#if error?.message && error.message !== info.message}
			<details class="error-details">
				<summary>Technical Details</summary>
				<pre>{error.message}</pre>
			</details>
		{/if}
	</main>
</div>

<style>
	.error-page {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		overflow: hidden;
		padding: var(--spacing-xl) var(--spacing-lg);
		margin-bottom: calc(-1 * var(--spacing-2xl));
	}

	/* Cosmic Background */
	.cosmic-bg {
		position: absolute;
		inset: 0;
		background: radial-gradient(
			ellipse at bottom,
			var(--color-surface) 0%,
			var(--color-background) 100%
		);
		z-index: 0;
	}

	.stars {
		position: absolute;
		inset: 0;
		background-image:
			radial-gradient(2px 2px at 20px 30px, var(--color-text-secondary), transparent),
			radial-gradient(2px 2px at 40px 70px, var(--color-text-secondary), transparent),
			radial-gradient(1px 1px at 90px 40px, var(--color-text-secondary), transparent),
			radial-gradient(2px 2px at 160px 120px, var(--color-text-secondary), transparent),
			radial-gradient(1px 1px at 230px 80px, var(--color-text-secondary), transparent),
			radial-gradient(2px 2px at 300px 150px, var(--color-text-secondary), transparent),
			radial-gradient(1px 1px at 370px 200px, var(--color-text-secondary), transparent),
			radial-gradient(2px 2px at 450px 50px, var(--color-text-secondary), transparent);
		background-size: 500px 500px;
		animation: twinkle 4s ease-in-out infinite;
		opacity: 0.5;
	}

	.stars-2 {
		background-position: 50px 50px;
		animation-delay: -1s;
		opacity: 0.3;
	}

	.stars-3 {
		background-position: -50px 100px;
		animation-delay: -2s;
		opacity: 0.4;
	}

	.nebula {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(circle at 20% 80%, var(--color-primary), transparent 40%),
			radial-gradient(circle at 80% 20%, var(--color-secondary), transparent 40%);
		opacity: 0.1;
		animation: nebula-pulse 8s ease-in-out infinite alternate;
	}

	@keyframes twinkle {
		0%,
		100% {
			opacity: 0.5;
		}
		50% {
			opacity: 0.8;
		}
	}

	@keyframes nebula-pulse {
		0% {
			opacity: 0.08;
			transform: scale(1);
		}
		100% {
			opacity: 0.15;
			transform: scale(1.1);
		}
	}

	/* Content */
	.error-content {
		position: relative;
		z-index: 1;
		text-align: center;
		max-width: 600px;
	}

	/* Icon */
	.error-icon {
		position: relative;
		display: inline-block;
		margin-bottom: var(--spacing-lg);
		animation: float 3s ease-in-out infinite;
	}

	.icon-main {
		font-size: 4rem;
		display: block;
		filter: drop-shadow(0 0 20px var(--color-primary));
	}

	.icon-glow {
		position: absolute;
		inset: -20px;
		background: radial-gradient(circle, var(--color-primary), transparent 70%);
		opacity: 0.3;
		border-radius: 50%;
		animation: glow-pulse 2s ease-in-out infinite alternate;
	}

	@keyframes float {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-10px);
		}
	}

	@keyframes glow-pulse {
		0% {
			opacity: 0.2;
			transform: scale(0.9);
		}
		100% {
			opacity: 0.4;
			transform: scale(1.1);
		}
	}

	/* Error Code */
	.error-code {
		font-size: 8rem;
		font-weight: 900;
		line-height: 1;
		margin-bottom: var(--spacing-md);
		display: flex;
		justify-content: center;
		gap: var(--spacing-sm);
	}

	.code-digit {
		display: inline-block;
		background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
		background-clip: text;
		-webkit-background-clip: text;
		color: transparent;
		animation: digit-float 2s ease-in-out infinite;
	}

	.code-digit:nth-child(1) {
		animation-delay: 0s;
	}
	.code-digit-center {
		animation-delay: 0.2s;
	}
	.code-digit:nth-child(3) {
		animation-delay: 0.4s;
	}

	@keyframes digit-float {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-5px);
		}
	}

	/* Title & Message */
	.error-title {
		font-size: 2rem;
		font-weight: 600;
		color: var(--color-text);
		margin-bottom: var(--spacing-sm);
	}

	.error-message {
		font-size: 1.1rem;
		color: var(--color-text-secondary);
		margin-bottom: var(--spacing-xl);
		max-width: 400px;
		margin-left: auto;
		margin-right: auto;
	}

	/* Actions */
	.error-actions {
		display: flex;
		gap: var(--spacing-md);
		justify-content: center;
		flex-wrap: wrap;
	}

	.btn {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-sm);
		padding: var(--spacing-sm) var(--spacing-lg);
		font-size: 1rem;
		font-weight: 500;
		border-radius: var(--radius-lg);
		text-decoration: none;
		transition: all var(--transition-fast);
		cursor: pointer;
	}

	.btn-primary {
		background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
		color: white;
		border: none;
		box-shadow: 0 4px 15px var(--color-primary);
	}

	.btn-primary:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 20px var(--color-primary);
		color: white;
	}

	.btn-secondary {
		background: var(--color-surface);
		color: var(--color-text);
		border: 1px solid var(--color-border);
	}

	.btn-secondary:hover {
		background: var(--color-surface-hover);
		border-color: var(--color-primary);
	}

	/* Details */
	.error-details {
		margin-top: var(--spacing-xl);
		text-align: left;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		padding: var(--spacing-md);
	}

	.error-details summary {
		cursor: pointer;
		color: var(--color-text-secondary);
		font-size: 0.9rem;
	}

	.error-details pre {
		margin-top: var(--spacing-sm);
		padding: var(--spacing-md);
		background: var(--color-background);
		border-radius: var(--radius-sm);
		overflow-x: auto;
		font-family: var(--font-mono);
		font-size: 0.85rem;
		color: var(--color-error);
	}

	/* Responsive */
	@media (max-width: 480px) {
		.error-code {
			font-size: 5rem;
		}

		.error-title {
			font-size: 1.5rem;
		}

		.error-message {
			font-size: 1rem;
		}

		.icon-main {
			font-size: 3rem;
		}
	}
</style>
