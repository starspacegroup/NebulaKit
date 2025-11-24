<script lang="ts">
	import { goto } from '$app/navigation';
	import CommandPalette from '$lib/components/CommandPalette.svelte';
	import { onMount } from 'svelte';

	let mounted = false;
	let searchInput = '';
	let focusedOption = -1;
	let showCommandPalette = false;

	onMount(() => {
		mounted = true;
	});

	function handleAction(action: string) {
		if (action === 'login') goto('/auth/login');
		else if (action === 'signup') goto('/auth/signup');
		else if (action === 'chat') goto('/chat');
	}

	function handleSearchFocus() {
		showCommandPalette = true;
	}

	function handleSearchClick() {
		showCommandPalette = true;
	}

	function handleSearchKeydown(e: KeyboardEvent) {
		// Open command palette on any key press
		if (!showCommandPalette) {
			showCommandPalette = true;
		}
	}
</script>

<svelte:head>
	<title>NebulaKit - Cosmic SvelteKit Starter</title>
	<meta name="description" content="A cosmic-grade SvelteKit starter powered by Cloudflare" />
</svelte:head>

<div class="hero">
	<!-- Cosmic Background -->
	<div class="cosmic-bg">
		<!-- New Nebula Flow - Left Side -->
		<div class="nebula-flow-left">
			<svg class="nebula-waves-svg" viewBox="0 0 400 1200" preserveAspectRatio="xMidYMid slice">
				<defs>
					<!-- Radial gradients for nebula clouds -->
					<radialGradient id="nebula-gradient-1" cx="50%" cy="30%">
						<stop offset="0%" style="stop-color: var(--color-secondary); stop-opacity: 0.8" />
						<stop offset="30%" style="stop-color: var(--color-primary); stop-opacity: 0.6" />
						<stop offset="60%" style="stop-color: var(--color-secondary); stop-opacity: 0.4" />
						<stop offset="100%" style="stop-color: var(--color-primary); stop-opacity: 0" />
					</radialGradient>
					<radialGradient id="nebula-gradient-2" cx="40%" cy="50%">
						<stop offset="0%" style="stop-color: var(--color-primary); stop-opacity: 0.7" />
						<stop offset="25%" style="stop-color: var(--color-secondary); stop-opacity: 0.65" />
						<stop offset="55%" style="stop-color: var(--color-primary); stop-opacity: 0.5" />
						<stop offset="100%" style="stop-color: var(--color-secondary); stop-opacity: 0" />
					</radialGradient>
					<radialGradient id="nebula-gradient-3" cx="60%" cy="40%">
						<stop offset="0%" style="stop-color: var(--color-secondary); stop-opacity: 0.75" />
						<stop offset="35%" style="stop-color: var(--color-primary); stop-opacity: 0.55" />
						<stop offset="70%" style="stop-color: var(--color-secondary); stop-opacity: 0.3" />
						<stop offset="100%" style="stop-color: var(--color-primary); stop-opacity: 0" />
					</radialGradient>
					<radialGradient id="nebula-gradient-4" cx="45%" cy="60%">
						<stop offset="0%" style="stop-color: var(--color-primary); stop-opacity: 0.65" />
						<stop offset="30%" style="stop-color: var(--color-secondary); stop-opacity: 0.5" />
						<stop offset="60%" style="stop-color: var(--color-primary); stop-opacity: 0.35" />
						<stop offset="100%" style="stop-color: var(--color-secondary); stop-opacity: 0" />
					</radialGradient>
					<radialGradient id="nebula-gradient-5" cx="55%" cy="35%">
						<stop offset="0%" style="stop-color: var(--color-secondary); stop-opacity: 0.7" />
						<stop offset="40%" style="stop-color: var(--color-primary); stop-opacity: 0.45" />
						<stop offset="75%" style="stop-color: var(--color-secondary); stop-opacity: 0.25" />
						<stop offset="100%" style="stop-color: var(--color-primary); stop-opacity: 0" />
					</radialGradient>

					<!-- Turbulence for organic texture -->
					<filter id="nebula-filter-1">
						<feTurbulence
							type="fractalNoise"
							baseFrequency="0.008 0.012"
							numOctaves="4"
							seed="1"
							result="turbulence"
						/>
						<feDisplacementMap
							in="SourceGraphic"
							in2="turbulence"
							scale="40"
							xChannelSelector="R"
							yChannelSelector="G"
						/>
						<feGaussianBlur stdDeviation="35" />
					</filter>
					<filter id="nebula-filter-2">
						<feTurbulence
							type="fractalNoise"
							baseFrequency="0.01 0.015"
							numOctaves="3"
							seed="5"
							result="turbulence"
						/>
						<feDisplacementMap
							in="SourceGraphic"
							in2="turbulence"
							scale="50"
							xChannelSelector="R"
							yChannelSelector="G"
						/>
						<feGaussianBlur stdDeviation="45" />
					</filter>
					<filter id="nebula-filter-3">
						<feTurbulence
							type="fractalNoise"
							baseFrequency="0.012 0.01"
							numOctaves="5"
							seed="10"
							result="turbulence"
						/>
						<feDisplacementMap
							in="SourceGraphic"
							in2="turbulence"
							scale="35"
							xChannelSelector="R"
							yChannelSelector="G"
						/>
						<feGaussianBlur stdDeviation="40" />
					</filter>
					<filter id="nebula-filter-4">
						<feTurbulence
							type="fractalNoise"
							baseFrequency="0.009 0.014"
							numOctaves="4"
							seed="15"
							result="turbulence"
						/>
						<feDisplacementMap
							in="SourceGraphic"
							in2="turbulence"
							scale="45"
							xChannelSelector="R"
							yChannelSelector="G"
						/>
						<feGaussianBlur stdDeviation="50" />
					</filter>
					<filter id="nebula-filter-5">
						<feTurbulence
							type="fractalNoise"
							baseFrequency="0.011 0.008"
							numOctaves="3"
							seed="20"
							result="turbulence"
						/>
						<feDisplacementMap
							in="SourceGraphic"
							in2="turbulence"
							scale="38"
							xChannelSelector="R"
							yChannelSelector="G"
						/>
						<feGaussianBlur stdDeviation="42" />
					</filter>

					<!-- Glow effect -->
					<filter id="glow-intense">
						<feGaussianBlur stdDeviation="20" result="blur" />
						<feComposite in="blur" in2="blur" operator="over" result="glow1" />
						<feComposite in="glow1" in2="blur" operator="over" result="glow2" />
						<feMerge>
							<feMergeNode in="glow2" />
							<feMergeNode in="SourceGraphic" />
						</feMerge>
					</filter>
				</defs>

				<!-- Organic nebula cloud shapes -->
				<!-- Layer 1: Deep background -->
				<path
					class="nebula-cloud nebula-1"
					d="M-50,0 C20,80 40,180 60,280 C80,380 70,480 90,580 C110,680 130,780 140,880 C145,930 150,1000 160,1100 L400,1200 L400,0 Z"
					fill="url(#nebula-gradient-1)"
					filter="url(#nebula-filter-1)"
				/>

				<!-- Layer 2: Mid layer with curves -->
				<path
					class="nebula-cloud nebula-2"
					d="M-30,50 C30,120 50,220 80,320 C100,400 90,500 110,600 C130,700 120,800 140,900 C150,960 160,1050 170,1150 L400,1200 L400,0 Z"
					fill="url(#nebula-gradient-2)"
					filter="url(#nebula-filter-2)"
				/>

				<!-- Layer 3: Flowing organic shape -->
				<path
					class="nebula-cloud nebula-3"
					d="M-40,100 Q60,200 80,350 T120,600 Q140,750 160,900 T190,1100 L400,1150 L400,50 Z"
					fill="url(#nebula-gradient-3)"
					filter="url(#nebula-filter-3)"
				/>

				<!-- Layer 4: Wispy tendrils -->
				<path
					class="nebula-cloud nebula-4"
					d="M-20,150 C40,230 70,330 100,450 S130,650 150,770 C165,850 175,950 185,1050 L400,1100 L400,100 Z"
					fill="url(#nebula-gradient-4)"
					filter="url(#nebula-filter-4)"
				/>

				<!-- Layer 5: Front wispy layer -->
				<path
					class="nebula-cloud nebula-5"
					d="M0,200 Q90,300 110,450 T160,700 Q180,850 200,1000 L400,1050 L400,150 Z"
					fill="url(#nebula-gradient-5)"
					filter="url(#nebula-filter-5)"
				/>

				<!-- Bright glowing wisps -->
				<ellipse
					class="nebula-glow glow-1"
					cx="120"
					cy="250"
					rx="150"
					ry="180"
					fill="url(#nebula-gradient-1)"
					filter="url(#glow-intense)"
					opacity="0.6"
				/>
				<ellipse
					class="nebula-glow glow-2"
					cx="140"
					cy="550"
					rx="130"
					ry="160"
					fill="url(#nebula-gradient-2)"
					filter="url(#glow-intense)"
					opacity="0.5"
				/>
				<ellipse
					class="nebula-glow glow-3"
					cx="110"
					cy="850"
					rx="140"
					ry="170"
					fill="url(#nebula-gradient-3)"
					filter="url(#glow-intense)"
					opacity="0.55"
				/>
			</svg>

			<!-- Stars within the nebula -->
			<div class="nebula-star" style="top: 8%; left: 12%;"></div>
			<div class="nebula-star small" style="top: 15%; left: 18%;"></div>
			<div class="nebula-star large" style="top: 22%; left: 8%;"></div>
			<div class="nebula-star" style="top: 35%; left: 14%;"></div>
			<div class="nebula-star small" style="top: 42%; left: 6%;"></div>
			<div class="nebula-star" style="top: 48%; left: 16%;"></div>
			<div class="nebula-star large" style="top: 58%; left: 10%;"></div>
			<div class="nebula-star small" style="top: 65%; left: 20%;"></div>
			<div class="nebula-star" style="top: 72%; left: 7%;"></div>
			<div class="nebula-star small" style="top: 82%; left: 15%;"></div>
			<div class="nebula-star large" style="top: 90%; left: 11%;"></div>
		</div>
		<!-- Wavy colored background blobs -->
		<div class="wavy-blob wavy-blob-left"></div>
		<div class="wavy-blob wavy-blob-bottom"></div>

		<!-- Animated nebula clouds -->
		<div class="nebula nebula-left"></div>
		<div class="nebula-overlay nebula-left-overlay"></div>

		<!-- Four-pointed stars scattered throughout -->
		<div class="star-sparkle" style="top: 8%; left: 18%; animation-delay: 0s;"></div>
		<div class="star-sparkle" style="top: 15%; left: 52%; animation-delay: 1.5s;"></div>
		<div class="star-sparkle large" style="top: 18%; right: 15%; animation-delay: 0.8s;"></div>
		<div class="star-sparkle" style="top: 35%; left: 25%; animation-delay: 2s;"></div>
		<div class="star-sparkle large" style="top: 50%; left: 8%; animation-delay: 1.2s;"></div>
		<div class="star-sparkle" style="bottom: 25%; left: 15%; animation-delay: 2.5s;"></div>
		<div class="star-sparkle large" style="bottom: 15%; right: 8%; animation-delay: 0.3s;"></div>
		<div class="star-sparkle" style="top: 45%; right: 12%; animation-delay: 1.8s;"></div>

		<!-- Small dots for depth -->
		<div class="stars-layer"></div>
		<div class="stars-layer-2"></div>

		<!-- Chat bubble decoration with user icon -->
		<div class="chat-bubble">
			<svg
				width="80"
				height="80"
				viewBox="0 0 80 80"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
			>
				<rect width="80" height="80" rx="16" fill="url(#chatGradient)" />
				<circle cx="40" cy="28" r="10" fill="white" />
				<path d="M26 52c0-7.732 6.268-14 14-14s14 6.268 14 14v6H26v-6z" fill="white" />
				<defs>
					<linearGradient id="chatGradient" x1="0" y1="0" x2="80" y2="80">
						<stop offset="0%" stop-color="#6366f1" />
						<stop offset="100%" stop-color="#8b5cf6" />
					</linearGradient>
				</defs>
			</svg>
		</div>

		<!-- Planets with enhanced detail -->
		<div class="planet planet-left"></div>
		<div class="planet planet-right"></div>

		<!-- Comet/shooting star -->
		<div class="comet"></div>
	</div>

	<div class="container">
		<div class="hero-content" class:mounted>
			<!-- Main Title -->
			<h1 class="main-title">NebulaKit</h1>

			<!-- Subtitle -->
			<p class="subtitle">
				A template for SvelteKit, Cloudflare, AI,<br />and chat-themed user login sites
			</p>

			<!-- Command Palette Style Search -->
			<div class="command-palette">
				<div class="search-box">
					<svg
						class="search-icon"
						width="20"
						height="20"
						viewBox="0 0 20 20"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="2" fill="none" />
						<path d="M13 13l5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
					</svg>
					<input
						type="text"
						placeholder="Start typing or ask something..."
						bind:value={searchInput}
						on:focus={handleSearchFocus}
						on:click={handleSearchClick}
						on:keydown={handleSearchKeydown}
						aria-label="Search or ask a question"
						readonly
					/>
				</div>

				<div class="command-options">
					<button
						class="command-option"
						class:focused={focusedOption === 0}
						on:click={() => handleAction('login')}
						on:mouseenter={() => (focusedOption = 0)}
						on:mouseleave={() => (focusedOption = -1)}
					>
						<svg
							class="option-icon"
							width="20"
							height="20"
							viewBox="0 0 20 20"
							fill="currentColor"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path d="M10 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
							<path d="M10 12c-4.42 0-8 1.79-8 4v2h16v-2c0-2.21-3.58-4-8-4z" />
						</svg>
						<span>Log in</span>
					</button>

					<button
						class="command-option"
						class:focused={focusedOption === 1}
						on:click={() => handleAction('signup')}
						on:mouseenter={() => (focusedOption = 1)}
						on:mouseleave={() => (focusedOption = -1)}
					>
						<svg
							class="option-icon"
							width="20"
							height="20"
							viewBox="0 0 20 20"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								d="M6 7h3V4a1 1 0 0 1 2 0v3h3a1 1 0 0 1 0 2h-3v3a1 1 0 0 1-2 0V9H6a1 1 0 0 1 0-2z"
								fill="currentColor"
							/>
							<path
								d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm0 14.4A6.4 6.4 0 1 1 10 3.6a6.4 6.4 0 0 1 0 12.8z"
								fill="currentColor"
							/>
						</svg>
						<span>Sign up</span>
					</button>

					<button
						class="command-option ask"
						class:focused={focusedOption === 2}
						on:click={() => handleAction('chat')}
						on:mouseenter={() => (focusedOption = 2)}
						on:mouseleave={() => (focusedOption = -1)}
					>
						<svg
							class="option-icon"
							width="20"
							height="20"
							viewBox="0 0 20 20"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
						>
							<circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="2" />
							<path
								d="M10 6v4M10 14h.01"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
							/>
						</svg>
						<span>Ask something...</span>
						<div class="ai-indicator">
							<svg
								width="24"
								height="24"
								viewBox="0 0 24 24"
								fill="none"
								xmlns="http://www.w3.org/2000/svg"
							>
								<rect
									x="4"
									y="8"
									width="3"
									height="8"
									rx="1.5"
									fill="currentColor"
									class="bar bar-1"
								/>
								<rect
									x="10.5"
									y="4"
									width="3"
									height="16"
									rx="1.5"
									fill="currentColor"
									class="bar bar-2"
								/>
								<rect
									x="17"
									y="10"
									width="3"
									height="4"
									rx="1.5"
									fill="currentColor"
									class="bar bar-3"
								/>
							</svg>
						</div>
					</button>
				</div>
			</div>
		</div>
	</div>
</div>

<CommandPalette bind:show={showCommandPalette} />

<style>
	.hero {
		position: relative;
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		background: linear-gradient(180deg, var(--color-surface) 0%, var(--color-background) 100%);
		padding: var(--spacing-2xl) var(--spacing-md);
	}

	/* Cosmic Background Elements */
	.cosmic-bg {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		overflow: hidden;
		z-index: 0;
		pointer-events: none;
	}

	/* Wavy colored background blobs */
	.wavy-blob {
		position: absolute;
		background: linear-gradient(
			135deg,
			color-mix(in srgb, var(--color-secondary) 80%, transparent) 0%,
			color-mix(in srgb, var(--color-primary) 70%, transparent) 50%,
			color-mix(in srgb, var(--color-secondary) 60%, transparent) 100%
		);
		border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%;
		filter: blur(60px);
		animation: blob-float 20s ease-in-out infinite;
	}

	.wavy-blob-left {
		top: 5%;
		left: -10%;
		width: 500px;
		height: 600px;
		opacity: 0.7;
	}

	.wavy-blob-bottom {
		bottom: -15%;
		right: -10%;
		width: 600px;
		height: 500px;
		opacity: 0.6;
		background: linear-gradient(
			225deg,
			color-mix(in srgb, var(--color-error) 70%, transparent) 0%,
			color-mix(in srgb, var(--color-primary) 60%, transparent) 50%,
			color-mix(in srgb, var(--color-error) 50%, transparent) 100%
		);
		border-radius: 70% 30% 30% 70% / 70% 70% 30% 30%;
		animation: blob-float 25s ease-in-out infinite reverse;
	}

	@keyframes blob-float {
		0%,
		100% {
			transform: translate(0, 0) rotate(0deg);
			border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%;
		}
		25% {
			transform: translate(20px, -30px) rotate(5deg);
			border-radius: 40% 60% 60% 40% / 40% 40% 60% 60%;
		}
		50% {
			transform: translate(-20px, -50px) rotate(-5deg);
			border-radius: 50% 50% 50% 50% / 50% 50% 50% 50%;
		}
		75% {
			transform: translate(30px, -20px) rotate(3deg);
			border-radius: 60% 40% 40% 60% / 60% 60% 40% 40%;
		}
	}

	/* New Nebula Flow - Left Side (like the image) */
	.nebula-flow-left {
		position: absolute;
		left: 0;
		top: 0;
		width: 100%;
		height: 100%;
		z-index: 0;
		opacity: 0.95;
		pointer-events: none;
		/* Gradient mask to fade out on right edge */
		-webkit-mask-image: linear-gradient(
			to right,
			rgba(0, 0, 0, 1) 0%,
			rgba(0, 0, 0, 1) 30%,
			rgba(0, 0, 0, 0.6) 50%,
			rgba(0, 0, 0, 0.2) 70%,
			rgba(0, 0, 0, 0) 85%
		);
		mask-image: linear-gradient(
			to right,
			rgba(0, 0, 0, 1) 0%,
			rgba(0, 0, 0, 1) 30%,
			rgba(0, 0, 0, 0.6) 50%,
			rgba(0, 0, 0, 0.2) 70%,
			rgba(0, 0, 0, 0) 85%
		);
	}

	.nebula-waves-svg {
		position: absolute;
		left: -120px;
		top: 0;
		width: calc(100% + 240px);
		height: 100%;
		mix-blend-mode: screen;
	}

	/* Organic nebula cloud animations */
	.nebula-cloud {
		animation: nebula-drift 30s ease-in-out infinite;
		transform-origin: center center;
	}

	.nebula-1 {
		animation-duration: 35s;
		animation-delay: 0s;
	}

	.nebula-2 {
		animation-duration: 40s;
		animation-delay: -8s;
	}

	.nebula-3 {
		animation-duration: 32s;
		animation-delay: -16s;
	}

	.nebula-4 {
		animation-duration: 38s;
		animation-delay: -24s;
	}

	.nebula-5 {
		animation-duration: 36s;
		animation-delay: -12s;
	}

	@keyframes nebula-drift {
		0%,
		100% {
			opacity: 0.9;
			transform: translateX(0) translateY(0) scale(1);
		}
		25% {
			opacity: 1;
			transform: translateX(15px) translateY(-20px) scale(1.05);
		}
		50% {
			opacity: 0.85;
			transform: translateX(-10px) translateY(-30px) scale(0.98);
		}
		75% {
			opacity: 0.95;
			transform: translateX(20px) translateY(-15px) scale(1.02);
		}
	}

	/* Glowing ellipse animations */
	.nebula-glow {
		animation: glow-pulse 25s ease-in-out infinite;
	}

	.glow-1 {
		animation-duration: 28s;
		animation-delay: -5s;
	}

	.glow-2 {
		animation-duration: 32s;
		animation-delay: -15s;
	}

	.glow-3 {
		animation-duration: 30s;
		animation-delay: -22s;
	}

	@keyframes glow-pulse {
		0%,
		100% {
			opacity: 0.5;
			transform: scale(1) translateX(0);
		}
		33% {
			opacity: 0.7;
			transform: scale(1.15) translateX(10px);
		}
		66% {
			opacity: 0.4;
			transform: scale(0.95) translateX(-8px);
		}
	}

	/* Stars within nebula */
	.nebula-star {
		position: absolute;
		width: 4px;
		height: 4px;
		background: var(--color-text);
		border-radius: 50%;
		box-shadow: 0 0 12px 2px color-mix(in srgb, var(--color-text) 90%, transparent);
		animation: nebula-star-twinkle 3s ease-in-out infinite;
		z-index: 1;
	}

	.nebula-star.small {
		width: 2.5px;
		height: 2.5px;
		box-shadow: 0 0 8px 1px color-mix(in srgb, var(--color-text) 80%, transparent);
	}

	.nebula-star.large {
		width: 5px;
		height: 5px;
		box-shadow: 0 0 16px 3px color-mix(in srgb, var(--color-text) 95%, transparent);
	}

	@keyframes nebula-star-twinkle {
		0%,
		100% {
			opacity: 0.6;
			transform: scale(1);
		}
		50% {
			opacity: 1;
			transform: scale(1.3);
		}
	}

	/* Enhanced Nebula clouds with layering */
	.nebula {
		position: absolute;
		border-radius: 50%;
		filter: blur(100px);
		opacity: 0.5;
		animation: float 25s ease-in-out infinite;
	}

	.nebula-left {
		top: -5%;
		left: -15%;
		width: 600px;
		height: 700px;
		background: radial-gradient(
			ellipse at center,
			color-mix(in srgb, var(--color-secondary) 50%, transparent) 0%,
			color-mix(in srgb, var(--color-secondary) 35%, transparent) 30%,
			color-mix(in srgb, var(--color-primary) 20%, transparent) 60%,
			transparent 100%
		);
	}

	.nebula-overlay {
		position: absolute;
		border-radius: 50%;
		filter: blur(60px);
	}

	.nebula-left-overlay {
		top: 5%;
		left: -5%;
		width: 400px;
		height: 500px;
		background: radial-gradient(
			ellipse at center,
			color-mix(in srgb, var(--color-secondary) 30%, transparent) 0%,
			color-mix(in srgb, var(--color-secondary) 15%, transparent) 50%,
			transparent 100%
		);
		animation: float 20s ease-in-out infinite;
		animation-delay: -5s;
	}

	/* Four-pointed sparkle stars */
	.star-sparkle {
		position: absolute;
		width: 12px;
		height: 12px;
		animation: sparkle 3s ease-in-out infinite;
	}

	.star-sparkle::before,
	.star-sparkle::after {
		content: '';
		position: absolute;
		background: var(--color-text);
		box-shadow: 0 0 8px color-mix(in srgb, var(--color-text) 80%, transparent);
	}

	.star-sparkle::before {
		width: 12px;
		height: 2px;
		top: 5px;
		left: 0;
	}

	.star-sparkle::after {
		width: 2px;
		height: 12px;
		top: 0;
		left: 5px;
	}

	.star-sparkle.large {
		width: 16px;
		height: 16px;
	}

	.star-sparkle.large::before {
		width: 16px;
		height: 2.5px;
		top: 6.75px;
		left: 0;
	}

	.star-sparkle.large::after {
		width: 2.5px;
		height: 16px;
		top: 0;
		left: 6.75px;
	}

	/* Small dot stars for depth */
	.stars-layer,
	.stars-layer-2 {
		position: absolute;
		width: 100%;
		height: 100%;
		background-image:
			radial-gradient(
				2px 2px at 15% 20%,
				color-mix(in srgb, var(--color-text) 80%, transparent),
				transparent
			),
			radial-gradient(
				1.5px 1.5px at 40% 15%,
				color-mix(in srgb, var(--color-text) 60%, transparent),
				transparent
			),
			radial-gradient(
				1px 1px at 65% 25%,
				color-mix(in srgb, var(--color-text) 70%, transparent),
				transparent
			),
			radial-gradient(
				1.5px 1.5px at 80% 35%,
				color-mix(in srgb, var(--color-text) 50%, transparent),
				transparent
			),
			radial-gradient(
				1px 1px at 25% 45%,
				color-mix(in srgb, var(--color-text) 60%, transparent),
				transparent
			),
			radial-gradient(
				2px 2px at 90% 50%,
				color-mix(in srgb, var(--color-text) 70%, transparent),
				transparent
			),
			radial-gradient(
				1px 1px at 35% 60%,
				color-mix(in srgb, var(--color-text) 50%, transparent),
				transparent
			),
			radial-gradient(
				1.5px 1.5px at 70% 70%,
				color-mix(in srgb, var(--color-text) 60%, transparent),
				transparent
			),
			radial-gradient(
				1px 1px at 20% 80%,
				color-mix(in srgb, var(--color-text) 80%, transparent),
				transparent
			),
			radial-gradient(
				1.5px 1.5px at 55% 85%,
				color-mix(in srgb, var(--color-text) 50%, transparent),
				transparent
			);
		background-size: 100% 100%;
		animation: twinkle 4s ease-in-out infinite;
	}

	.stars-layer-2 {
		animation-delay: -2s;
		opacity: 0.7;
	}

	/* Chat bubble decoration */
	.chat-bubble {
		position: absolute;
		top: 12%;
		right: 10%;
		animation: float 20s ease-in-out infinite;
		animation-delay: -3s;
		filter: drop-shadow(0 10px 30px color-mix(in srgb, var(--color-primary) 40%, transparent));
	}

	/* Planets with enhanced realism */
	.planet {
		position: absolute;
		border-radius: 50%;
	}

	.planet-left {
		top: 10%;
		left: 3%;
		width: 180px;
		height: 180px;
		background: radial-gradient(
			circle at 30% 30%,
			color-mix(in srgb, var(--color-secondary) 40%, transparent) 0%,
			color-mix(in srgb, var(--color-secondary) 50%, transparent) 25%,
			color-mix(in srgb, var(--color-secondary) 60%, transparent) 50%,
			color-mix(in srgb, var(--color-secondary) 40%, transparent) 100%
		);
		box-shadow:
			inset -25px -25px 50px color-mix(in srgb, var(--color-background) 50%, transparent),
			0 0 40px color-mix(in srgb, var(--color-secondary) 30%, transparent);
		animation: float 30s ease-in-out infinite;
		filter: blur(0.5px);
	}

	.planet-right {
		bottom: 8%;
		right: 2%;
		width: 240px;
		height: 240px;
		background: radial-gradient(
			circle at 35% 35%,
			color-mix(in srgb, var(--color-error) 30%, transparent) 0%,
			color-mix(in srgb, var(--color-error) 40%, transparent) 20%,
			color-mix(in srgb, var(--color-error) 50%, transparent) 40%,
			color-mix(in srgb, var(--color-error) 50%, transparent) 60%,
			color-mix(in srgb, var(--color-error) 40%, transparent) 100%
		);
		box-shadow:
			inset -35px -35px 70px color-mix(in srgb, var(--color-background) 60%, transparent),
			0 0 50px color-mix(in srgb, var(--color-error) 25%, transparent);
		animation: float 35s ease-in-out infinite reverse;
		filter: blur(0.5px);
	}

	/* Comet/shooting star effect */
	.comet {
		position: absolute;
		top: 30%;
		right: 20%;
		width: 3px;
		height: 3px;
		background: var(--color-text);
		border-radius: 50%;
		box-shadow: 0 0 10px 2px color-mix(in srgb, var(--color-text) 80%, transparent);
		animation: comet 8s linear infinite;
		opacity: 0;
	}

	.comet::after {
		content: '';
		position: absolute;
		top: 0;
		right: 3px;
		width: 100px;
		height: 2px;
		background: linear-gradient(to left, var(--color-text), transparent);
		opacity: 0.7;
	}

	/* Content */
	.container {
		position: relative;
		z-index: 1;
		width: 100%;
		max-width: 960px;
		margin: 0 auto;
	}

	.hero-content {
		text-align: center;
		opacity: 0;
		transform: translateY(30px);
		transition:
			opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1),
			transform 0.8s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.hero-content.mounted {
		opacity: 1;
		transform: translateY(0);
	}

	.main-title {
		font-size: 3.5rem;
		font-weight: 700;
		color: var(--color-text);
		margin-bottom: var(--spacing-lg);
		letter-spacing: -0.03em;
		text-shadow: 0 2px 20px color-mix(in srgb, var(--color-secondary) 30%, transparent);
	}

	@media (min-width: 768px) {
		.main-title {
			font-size: 5.5rem;
		}
	}

	@media (min-width: 1024px) {
		.main-title {
			font-size: 7rem;
		}
	}

	.subtitle {
		font-size: 1.125rem;
		color: var(--color-text-secondary);
		margin-bottom: var(--spacing-2xl);
		line-height: 1.7;
		font-weight: 400;
	}

	@media (min-width: 768px) {
		.subtitle {
			font-size: 1.35rem;
			margin-bottom: 3rem;
		}
	}

	/* Command Palette - Enhanced glass morphism */
	.command-palette {
		background: color-mix(in srgb, var(--color-surface) 50%, transparent);
		backdrop-filter: blur(24px);
		border: 1px solid color-mix(in srgb, var(--color-secondary) 25%, transparent);
		border-radius: 20px;
		padding: var(--spacing-lg);
		max-width: 720px;
		margin: 0 auto;
		box-shadow:
			0 24px 80px color-mix(in srgb, var(--color-background) 60%, transparent),
			0 0 0 1px color-mix(in srgb, var(--color-text) 5%, transparent) inset;
	}

	.search-box {
		display: flex;
		align-items: center;
		gap: var(--spacing-md);
		background: color-mix(in srgb, var(--color-surface) 70%, transparent);
		border: 1px solid color-mix(in srgb, var(--color-secondary) 15%, transparent);
		border-radius: 12px;
		padding: var(--spacing-md) var(--spacing-lg);
		margin-bottom: var(--spacing-md);
		transition: all var(--transition-base);
	}

	.search-box:focus-within {
		border-color: color-mix(in srgb, var(--color-secondary) 40%, transparent);
		background: color-mix(in srgb, var(--color-surface) 85%, transparent);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-secondary) 10%, transparent);
	}

	.search-icon {
		color: var(--color-text-secondary);
		flex-shrink: 0;
	}

	.search-box input {
		flex: 1;
		background: transparent;
		border: none;
		color: var(--color-text);
		font-size: 1rem;
		outline: none;
		font-weight: 400;
	}

	.search-box input::placeholder {
		color: var(--color-text-secondary);
	}

	/* Command Options */
	.command-options {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.command-option {
		display: flex;
		align-items: center;
		gap: var(--spacing-md);
		background: transparent;
		border: 1px solid transparent;
		border-radius: 10px;
		padding: var(--spacing-md) var(--spacing-lg);
		color: var(--color-text);
		text-align: left;
		font-size: 0.95rem;
		font-weight: 400;
		transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
		cursor: pointer;
		position: relative;
	}

	.command-option:hover,
	.command-option.focused {
		background: color-mix(in srgb, var(--color-secondary) 12%, transparent);
		border-color: color-mix(in srgb, var(--color-secondary) 30%, transparent);
		transform: translateX(2px);
	}

	.command-option:active {
		transform: translateX(2px) scale(0.98);
	}

	.option-icon {
		color: var(--color-text-secondary);
		flex-shrink: 0;
		transition: color var(--transition-fast);
	}

	.command-option:hover .option-icon,
	.command-option.focused .option-icon {
		color: var(--color-text);
	}

	.command-option span {
		flex: 1;
	}

	/* AI Indicator - Enhanced styling */
	.command-option.ask {
		position: relative;
	}

	.ai-indicator {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		background: linear-gradient(
			135deg,
			color-mix(in srgb, var(--color-secondary) 80%, transparent) 0%,
			color-mix(in srgb, var(--color-primary) 80%, transparent) 100%
		);
		border-radius: 10px;
		box-shadow: 0 4px 12px color-mix(in srgb, var(--color-secondary) 30%, transparent);
		transition: all var(--transition-fast);
	}

	.command-option.ask:hover .ai-indicator,
	.command-option.ask.focused .ai-indicator {
		background: linear-gradient(135deg, var(--color-secondary) 0%, var(--color-primary) 100%);
		box-shadow: 0 6px 20px color-mix(in srgb, var(--color-secondary) 50%, transparent);
		transform: scale(1.05);
	}

	.ai-indicator svg {
		width: 22px;
		height: 22px;
		color: var(--color-background);
	}

	.bar {
		animation: pulse 1.4s ease-in-out infinite;
		transform-origin: center bottom;
	}

	.bar-1 {
		animation-delay: 0s;
	}

	.bar-2 {
		animation-delay: 0.2s;
	}

	.bar-3 {
		animation-delay: 0.4s;
	}

	/* Animations */
	@keyframes float {
		0%,
		100% {
			transform: translateY(0) translateX(0) rotate(0deg);
		}
		33% {
			transform: translateY(-25px) translateX(15px) rotate(2deg);
		}
		66% {
			transform: translateY(-10px) translateX(-10px) rotate(-2deg);
		}
	}

	@keyframes sparkle {
		0%,
		100% {
			opacity: 0.4;
			transform: scale(0.8) rotate(0deg);
		}
		50% {
			opacity: 1;
			transform: scale(1) rotate(180deg);
		}
	}

	@keyframes twinkle {
		0%,
		100% {
			opacity: 0.4;
		}
		50% {
			opacity: 0.9;
		}
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
			transform: scaleY(1);
		}
		50% {
			opacity: 0.5;
			transform: scaleY(0.5);
		}
	}

	@keyframes comet {
		0% {
			opacity: 0;
			transform: translate(0, 0);
		}
		10% {
			opacity: 1;
		}
		90% {
			opacity: 1;
		}
		100% {
			opacity: 0;
			transform: translate(-400px, 400px);
		}
	}

	/* Responsive adjustments */
	@media (max-width: 1024px) {
		.chat-bubble {
			width: 70px;
			height: 70px;
		}

		.chat-bubble svg {
			width: 70px;
			height: 70px;
		}
	}

	@media (max-width: 768px) {
		.hero {
			padding: var(--spacing-xl) var(--spacing-md);
		}

		.main-title {
			font-size: 3rem;
		}

		.subtitle {
			font-size: 1rem;
			margin-bottom: var(--spacing-xl);
		}

		.nebula-flow-left {
			opacity: 0.9;
		}

		.nebula-waves-svg {
			left: -80px;
			width: calc(100% + 160px);
		}

		.planet-left {
			width: 120px;
			height: 120px;
			left: -5%;
			top: 5%;
		}

		.planet-right {
			width: 160px;
			height: 160px;
			right: -5%;
		}

		.nebula-left {
			width: 400px;
			height: 450px;
		}

		.nebula-left-overlay {
			width: 300px;
			height: 350px;
		}

		.chat-bubble {
			width: 60px;
			height: 60px;
			top: 8%;
			right: 5%;
		}

		.chat-bubble svg {
			width: 60px;
			height: 60px;
		}

		.star-sparkle {
			width: 10px;
			height: 10px;
		}

		.star-sparkle::before {
			width: 10px;
			height: 1.5px;
			top: 4.25px;
		}

		.star-sparkle::after {
			width: 1.5px;
			height: 10px;
			left: 4.25px;
		}

		.star-sparkle.large {
			width: 12px;
			height: 12px;
		}

		.star-sparkle.large::before {
			width: 12px;
			height: 2px;
			top: 5px;
		}

		.star-sparkle.large::after {
			width: 2px;
			height: 12px;
			left: 5px;
		}

		.command-palette {
			padding: var(--spacing-md);
		}

		.search-box {
			padding: var(--spacing-sm) var(--spacing-md);
		}

		.command-option {
			padding: var(--spacing-sm) var(--spacing-md);
			font-size: 0.9rem;
		}

		.ai-indicator {
			width: 36px;
			height: 36px;
		}
	}

	@media (max-width: 480px) {
		.main-title {
			font-size: 2.5rem;
		}

		.subtitle {
			font-size: 0.95rem;
		}

		.subtitle br {
			display: none;
		}

		.nebula-flow-left {
			opacity: 0.85;
		}

		.nebula-waves-svg {
			left: -60px;
			width: calc(100% + 120px);
		}

		.comet {
			display: none;
		}
	}
</style>
