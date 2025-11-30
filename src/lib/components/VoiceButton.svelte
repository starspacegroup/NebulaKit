<script lang="ts">
	import { onDestroy } from 'svelte';

	export let isActive = false;
	export let state: 'idle' | 'listening' | 'processing' | 'speaking' = 'idle';
	export let onClick: () => void = () => {};
	export let disabled = false;

	// Animation state for bars
	let animationFrame: number = 0;
	let bars: number[] = [0.3, 0.6, 1, 0.6, 0.3];
	let barHeights: number[] = [...bars];

	onDestroy(() => {
		if (animationFrame) {
			cancelAnimationFrame(animationFrame);
			animationFrame = 0;
		}
	});

	// Reactive statement to control animation based on state
	$: {
		if (isActive && state !== 'idle') {
			startAnimation();
		} else {
			stopAnimation();
		}
	}

	function startAnimation() {
		if (animationFrame) return;

		let time = 0;
		const animate = () => {
			time += 0.05;

			barHeights = bars.map((baseHeight, index) => {
				// Different animation patterns based on state
				switch (state) {
					case 'listening': {
						// Active, energetic waves - user is speaking
						const offset = index * 0.5;
						const wave1 = Math.sin(time * 2 + offset) * 0.4;
						const wave2 = Math.sin(time * 3 + offset * 1.5) * 0.3;
						return Math.max(0.1, Math.min(1, baseHeight + wave1 + wave2));
					}
					case 'processing': {
						// Slower, pulsing - waiting for response
						const pulse = Math.sin(time + index * 0.3) * 0.3;
						return Math.max(0.15, Math.min(0.7, baseHeight * 0.5 + pulse));
					}
					case 'speaking': {
						// Smooth, flowing waves - AI is speaking
						const offset = index * 0.4;
						const wave = Math.sin(time * 1.5 + offset) * 0.5;
						return Math.max(0.2, Math.min(1, baseHeight * 0.8 + wave));
					}
					default:
						return baseHeight * 0.3;
				}
			});

			animationFrame = requestAnimationFrame(animate);
		};

		animate();
	}

	function stopAnimation() {
		if (animationFrame) {
			cancelAnimationFrame(animationFrame);
			animationFrame = 0;
		}
		// Reset to base heights
		barHeights = bars.map((h) => h * 0.3);
	}

	function handleClick() {
		if (!disabled) {
			onClick();
		}
	}

	// Get button label based on state
	$: buttonLabel = isActive
		? state === 'listening'
			? 'Listening to your voice'
			: state === 'processing'
				? 'Processing your message'
				: state === 'speaking'
					? 'AI is responding'
					: 'Stop voice chat'
		: 'Start voice chat';

	// Get colors based on state
	$: buttonClass = isActive
		? state === 'listening'
			? 'active listening'
			: state === 'processing'
				? 'active processing'
				: state === 'speaking'
					? 'active speaking'
					: 'active'
		: 'inactive';
</script>

<button
	on:click={handleClick}
	class="voice-button {buttonClass}"
	{disabled}
	aria-label={buttonLabel}
	title={buttonLabel}
>
	<div class="button-content">
		{#if isActive && (state === 'listening' || state === 'processing' || state === 'speaking')}
			<!-- Animated wave bars -->
			<div class="wave-container" aria-hidden="true">
				{#each barHeights as height, i (i)}
					<div class="wave-bar" style="height: {height * 100}%"></div>
				{/each}
			</div>
		{:else if isActive}
			<!-- Stop icon (square) -->
			<svg
				width="20"
				height="20"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<rect x="6" y="6" width="12" height="12" rx="2" />
			</svg>
		{:else}
			<!-- Static wave bars (inactive state) -->
			<div class="wave-container" aria-hidden="true">
				{#each bars as height, i (i)}
					<div class="wave-bar static" style="height: {height * 30}%"></div>
				{/each}
			</div>
		{/if}
	</div>
</button>

<style>
	.voice-button {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all var(--transition-base);
		flex-shrink: 0;
		border: 2px solid var(--color-border);
		background: var(--color-surface);
		color: var(--color-text);
		position: relative;
		overflow: hidden;
	}

	.voice-button:hover:not(:disabled) {
		background: var(--color-surface-hover);
		color: var(--color-text);
		transform: scale(1.05);
		border-color: var(--color-primary);
	}

	.voice-button:active:not(:disabled) {
		transform: scale(0.95);
	}

	.voice-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.button-content {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
	}

	/* Inactive state */
	.voice-button.inactive {
		background: var(--color-surface);
		color: var(--color-text-secondary);
	}

	.voice-button.inactive:hover:not(:disabled) {
		background: var(--color-surface-hover);
		color: var(--color-primary);
	}

	/* Active states */
	.voice-button.active {
		border: 1px solid transparent;
	}

	/* Listening state - green/primary, energetic */
	.voice-button.active.listening {
		background: linear-gradient(135deg, var(--color-success), #10b981);
		color: white;
		animation: pulse-ring-green 2s ease-in-out infinite;
	}

	.voice-button.active.listening:hover {
		background: linear-gradient(135deg, #10b981, #059669);
	}

	@keyframes pulse-ring-green {
		0%,
		100% {
			box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.6);
		}
		50% {
			box-shadow: 0 0 0 8px rgba(16, 185, 129, 0);
		}
	}

	/* Processing state - yellow/warning, slower pulse */
	.voice-button.active.processing {
		background: linear-gradient(135deg, var(--color-warning), #f59e0b);
		color: white;
		animation: pulse-ring-yellow 3s ease-in-out infinite;
	}

	.voice-button.active.processing:hover {
		background: linear-gradient(135deg, #f59e0b, #d97706);
	}

	@keyframes pulse-ring-yellow {
		0%,
		100% {
			box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.5);
		}
		50% {
			box-shadow: 0 0 0 8px rgba(245, 158, 11, 0);
		}
	}

	/* Speaking state - blue/primary, smooth pulse */
	.voice-button.active.speaking {
		background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
		color: white;
		animation: pulse-ring-blue 2.5s ease-in-out infinite;
	}

	.voice-button.active.speaking:hover {
		background: linear-gradient(135deg, var(--color-secondary), var(--color-primary));
	}

	@keyframes pulse-ring-blue {
		0%,
		100% {
			box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.5);
		}
		50% {
			box-shadow: 0 0 0 8px rgba(59, 130, 246, 0);
		}
	}

	/* Default active state (fallback) - red */
	.voice-button.active:not(.listening):not(.processing):not(.speaking) {
		background: linear-gradient(135deg, var(--color-error), #dc2626);
		color: white;
		animation: pulse-ring-red 2s ease-in-out infinite;
	}

	.voice-button.active:not(.listening):not(.processing):not(.speaking):hover {
		background: linear-gradient(135deg, #ef4444, #dc2626);
	}

	@keyframes pulse-ring-red {
		0%,
		100% {
			box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5);
		}
		50% {
			box-shadow: 0 0 0 6px rgba(239, 68, 68, 0);
		}
	}

	/* Wave animation container */
	.wave-container {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 3px;
		height: 24px;
		width: 24px;
	}

	.wave-bar {
		width: 3px;
		background: currentColor;
		border-radius: 3px;
		transition: height 0.1s ease-out;
		min-height: 6px;
	}

	.wave-bar.static {
		opacity: 0.8;
	}

	/* Mobile responsive */
	@media (max-width: 768px) {
		.voice-button {
			width: 46px;
			height: 46px;
		}

		.wave-container {
			height: 20px;
			width: 20px;
		}

		.wave-bar {
			width: 3px;
		}
	}
</style>
