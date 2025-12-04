<script lang="ts">
	import { goto } from '$app/navigation';
	import { openCommandPalette } from '$lib/stores/commandPalette';
	import { onMount } from 'svelte';

	let mounted = false;
	let searchInput = '';
	let focusedOption = -1;

	onMount(() => {
		mounted = true;
	});

	function handleAction(action: string) {
		if (action === 'login') goto('/auth/login');
		else if (action === 'signup') goto('/auth/signup');
		else if (action === 'chat') goto('/chat');
	}

	function handleSearchFocus() {
		openCommandPalette();
	}

	function handleSearchClick() {
		openCommandPalette();
	}

	function handleSearchKeydown(e: KeyboardEvent) {
		// Open command palette on any key press
		openCommandPalette();
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
				A full-stack
				<svg
					class="svelte-icon"
					width="20"
					height="20"
					viewBox="0 0 98.1 118"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						d="M91.8 15.6C80.9-.1 59.2-4.7 43.6 5.2L16.1 22.8C8.6 27.5 3.4 35.2 1.9 43.9c-1.3 7.3-.2 14.8 3.3 21.3-2.4 3.6-4 7.6-4.7 11.8-1.6 8.9.5 18.1 5.7 25.4 11 15.7 32.6 20.3 48.2 10.4l27.5-17.5c7.5-4.7 12.7-12.4 14.2-21.1 1.3-7.3.2-14.8-3.3-21.3 2.4-3.6 4-7.6 4.7-11.8 1.6-9-.5-18.2-5.7-25.5"
						fill="#FF3E00"
					/>
					<path
						d="M40.9 103.9c-8.9 2.3-18.2-1.2-23.4-8.7-3.2-4.4-4.4-9.9-3.5-15.3.2-.9.4-1.7.6-2.6l.5-1.6 1.4 1c3.3 2.4 6.9 4.2 10.8 5.4l1 .3-.1 1c-.1 1.4.3 2.9 1.1 4.1 1.6 2.3 4.4 3.4 7.1 2.7.6-.2 1.2-.4 1.7-.7L65.5 72c1.4-.9 2.3-2.2 2.6-3.8.3-1.6-.1-3.3-1-4.6-1.6-2.3-4.4-3.3-7.1-2.6-.6.2-1.2.4-1.7.7l-10.5 6.7c-1.7 1.1-3.6 1.9-5.6 2.4-8.9 2.3-18.2-1.2-23.4-8.7-3.1-4.4-4.4-9.9-3.4-15.3.9-5.2 4.1-9.9 8.6-12.7L50.5 5.5c1.7-1.1 3.6-1.9 5.6-2.5 8.9-2.3 18.2 1.2 23.4 8.7 3.2 4.4 4.4 9.9 3.5 15.3-.2.9-.4 1.7-.7 2.6l-.5 1.6-1.4-1c-3.3-2.4-6.9-4.2-10.8-5.4l-1-.3.1-1c.1-1.4-.3-2.9-1.1-4.1-1.6-2.3-4.4-3.3-7.1-2.6-.6.2-1.2.4-1.7.7L32.4 46c-1.4.9-2.3 2.2-2.6 3.8s.1 3.3 1 4.6c1.6 2.3 4.4 3.3 7.1 2.6.6-.2 1.2-.4 1.7-.7l10.5-6.7c1.7-1.1 3.6-1.9 5.6-2.5 8.9-2.3 18.2 1.2 23.4 8.7 3.2 4.4 4.4 9.9 3.5 15.3-.9 5.2-4.1 9.9-8.6 12.7l-27.5 17.5c-1.7 1.1-3.6 1.9-5.6 2.5"
						fill="#FFF"
					/>
				</svg>
				SvelteKit +
				<svg
					class="cloudflare-icon"
					width="20"
					height="20"
					viewBox="0 0 100 100"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						d="M70.6 52.9c-.4-1.5-1.7-2.6-3.3-2.6H35.4c-1.3 0-2.4.8-2.8 2-.1.3-.1.6-.1.9 0 1.4 1.2 2.6 2.6 2.6h31.6c1.3 0 2.5-.8 2.9-2 .2-.3.2-.6.2-.9h-.2zm9.3-6c-.3-.1-.5-.1-.8-.1H63.8c-.5-8.9-8-16-17.2-16-7.5 0-13.9 4.8-16.3 11.5-.7-.2-1.5-.3-2.3-.3-4.5 0-8.2 3.7-8.2 8.2v.5c-5.5 1.2-9.6 6.1-9.6 11.9 0 6.7 5.4 12.1 12.1 12.1h38.4c7.8 0 14.1-6.3 14.1-14.1 0-6.9-4.9-12.6-11.4-13.9l-.5.3z"
						fill="#F38020"
					/>
					<path
						d="M46.6 31.4c7.2 0 13.2 5.1 14.7 11.9h17.4c.3 0 .5 0 .8.1 5.2 1.1 9.1 5.8 9.1 11.4 0 6.4-5.2 11.6-11.6 11.6H38.6c-5.5 0-9.9-4.4-9.9-9.9 0-4.7 3.3-8.7 7.8-9.7l1.5-.3v-1.5c0-3.3 2.7-6 6-6 .6 0 1.2.1 1.8.3l1.6.5.7-1.5c2-4.8 6.7-7.9 12-7.9m0-4.8c-7 0-13.1 4.2-15.8 10.2-4.9.6-8.7 4.8-8.7 9.9v.1c-6.2 1.5-10.8 7-10.8 13.6 0 7.7 6.2 13.9 13.9 13.9h38.4c9 0 16.3-7.3 16.3-16.3 0-7.9-5.6-14.5-13-16.1-.8-9.9-9.1-17.6-19.2-17.6l-1.1.3z"
						fill="#FAAD3F"
					/>
				</svg>
				Cloudflare starter for building fast, scalable apps including users authentication, command palette,
				themes, and
				<svg
					class="ai-icon"
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						d="M12 2l2.4 7.4h7.6l-6 4.6 2.3 7.4-6.3-4.6-6.3 4.6 2.3-7.4-6-4.6h7.6z"
						fill="url(#sparkle-gradient-1)"
					/>
					<path
						d="M8 1l1.2 3.7h3.8l-3 2.3 1.15 3.7-3.15-2.3-3.15 2.3 1.15-3.7-3-2.3h3.8z"
						fill="url(#sparkle-gradient-2)"
					/>
					<path
						d="M16 14l.8 2.5h2.5l-2 1.5.75 2.5-2.05-1.5-2.05 1.5.75-2.5-2-1.5h2.5z"
						fill="url(#sparkle-gradient-3)"
					/>
					<defs>
						<linearGradient
							id="sparkle-gradient-1"
							x1="4"
							y1="2"
							x2="20"
							y2="22"
							gradientUnits="userSpaceOnUse"
						>
							<stop offset="0%" stop-color="#667eea" />
							<stop offset="100%" stop-color="#764ba2" />
						</linearGradient>
						<linearGradient
							id="sparkle-gradient-2"
							x1="2"
							y1="1"
							x2="14"
							y2="13"
							gradientUnits="userSpaceOnUse"
						>
							<stop offset="0%" stop-color="#f093fb" />
							<stop offset="100%" stop-color="#f5576c" />
						</linearGradient>
						<linearGradient
							id="sparkle-gradient-3"
							x1="12"
							y1="14"
							x2="22"
							y2="22"
							gradientUnits="userSpaceOnUse"
						>
							<stop offset="0%" stop-color="#4facfe" />
							<stop offset="100%" stop-color="#00f2fe" />
						</linearGradient>
					</defs>
				</svg>
				AI realtime voice/text chat.
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

<!-- Features Section -->
<section class="features">
	<div class="features-header">
		<h2 class="features-title">Built for the Modern Web</h2>
		<p class="features-subtitle">
			A production-ready template with everything you need to build fast, scalable applications
		</p>
	</div>

	<div class="features-grid">
		<!-- Feature 1: SvelteKit -->
		<div class="feature-card">
			<div class="feature-header">
				<div class="feature-icon">
					<svg
						width="40"
						height="40"
						viewBox="0 0 40 40"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							d="M34.5 13.5c0-3.5-2-6.5-5-8-3-1.5-6.5-1.5-9.5 0-3 1.5-5 4.5-5 8v13c0 3.5 2 6.5 5 8 3 1.5 6.5 1.5 9.5 0 3-1.5 5-4.5 5-8v-13z"
							fill="var(--color-primary)"
						/>
						<path
							d="M24 5c-3.5 0-6.5 2-8 5-1.5 3-1.5 6.5 0 9.5 1.5 3 4.5 5 8 5h13c3.5 0 6.5-2 8-5 1.5-3 1.5-6.5 0-9.5-1.5-3-4.5-5-8-5H24z"
							fill="var(--color-secondary)"
							opacity="0.8"
						/>
					</svg>
				</div>
				<h3 class="feature-title">SvelteKit Framework</h3>
			</div>
			<p class="feature-description">
				Blazing fast web applications with SvelteKit's powerful routing, server-side rendering, and
				reactive components. Zero-config TypeScript support included.
			</p>
		</div>

		<!-- Feature 2: Cloudflare Workers -->
		<div class="feature-card">
			<div class="feature-header">
				<div class="feature-icon">
					<svg
						width="40"
						height="40"
						viewBox="0 0 40 40"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							d="M8 20l8-8 8 8 8-8v16l-8-8-8 8-8-8V20z"
							fill="var(--color-primary)"
							opacity="0.2"
						/>
						<path
							d="M8 12l8-8 8 8 8-8v16l-8-8-8 8-8-8V12z"
							fill="var(--color-primary)"
							opacity="0.4"
						/>
						<path d="M8 4l8-8 8 8 8-8v16l-8-8-8 8-8-8V4z" fill="var(--color-primary)" />
					</svg>
				</div>
				<h3 class="feature-title">Cloudflare Workers</h3>
			</div>
			<p class="feature-description">
				Deploy globally in seconds with Cloudflare's edge network. Lightning-fast responses from
				300+ locations worldwide with D1, KV, R2, and Workers AI built-in.
			</p>
		</div>

		<!-- Feature 3: Authentication -->
		<div class="feature-card">
			<div class="feature-header">
				<div class="feature-icon">
					<svg
						width="40"
						height="40"
						viewBox="0 0 40 40"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<rect
							x="8"
							y="14"
							width="24"
							height="20"
							rx="2"
							stroke="var(--color-primary)"
							stroke-width="2"
							fill="none"
						/>
						<path
							d="M13 14v-4a7 7 0 0 1 14 0v4"
							stroke="var(--color-primary)"
							stroke-width="2"
							fill="none"
						/>
						<circle cx="20" cy="24" r="3" fill="var(--color-primary)" />
						<path d="M20 27v4" stroke="var(--color-primary)" stroke-width="2" />
					</svg>
				</div>
				<h3 class="feature-title">Secure Authentication</h3>
			</div>
			<p class="feature-description">
				Built-in authentication with session management, OAuth providers, and secure password
				hashing. Ready for email/password, Google, GitHub, and more.
			</p>
		</div>

		<!-- Feature 4: Database -->
		<div class="feature-card">
			<div class="feature-header">
				<div class="feature-icon">
					<svg
						width="40"
						height="40"
						viewBox="0 0 40 40"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<ellipse cx="20" cy="10" rx="12" ry="4" fill="var(--color-primary)" opacity="0.3" />
						<ellipse cx="20" cy="20" rx="12" ry="4" fill="var(--color-primary)" opacity="0.5" />
						<ellipse cx="20" cy="30" rx="12" ry="4" fill="var(--color-primary)" />
						<path d="M8 10v20M32 10v20" stroke="var(--color-primary)" stroke-width="2" />
					</svg>
				</div>
				<h3 class="feature-title">Cloudflare D1 Database</h3>
			</div>
			<p class="feature-description">
				SQLite at the edge with migrations, type-safe queries, and zero cold starts. Scale
				effortlessly with automatic backups and point-in-time recovery.
			</p>
		</div>

		<!-- Feature 5: AI Integration -->
		<div class="feature-card">
			<div class="feature-header">
				<div class="feature-icon">
					<svg
						width="40"
						height="40"
						viewBox="0 0 40 40"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<circle cx="20" cy="20" r="8" stroke="var(--color-primary)" stroke-width="2" />
						<circle cx="20" cy="20" r="3" fill="var(--color-primary)" />
						<path
							d="M20 4v8M20 28v8M4 20h8M28 20h8M10.3 10.3l5.7 5.7M24 24l5.7 5.7M10.3 29.7l5.7-5.7M24 16l5.7-5.7"
							stroke="var(--color-primary)"
							stroke-width="2"
							stroke-linecap="round"
						/>
					</svg>
				</div>
				<h3 class="feature-title">Workers AI Ready</h3>
			</div>
			<p class="feature-description">
				Pre-configured for AI integration with Cloudflare Workers AI. Add chat, embeddings, image
				generation, and LLM capabilities with a few lines of code.
			</p>
		</div>

		<!-- Feature 6: Testing -->
		<div class="feature-card">
			<div class="feature-header">
				<div class="feature-icon">
					<svg
						width="40"
						height="40"
						viewBox="0 0 40 40"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							d="M8 20l8 8 16-16"
							stroke="var(--color-primary)"
							stroke-width="3"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
						<circle cx="20" cy="20" r="16" stroke="var(--color-primary)" stroke-width="2" />
					</svg>
				</div>
				<h3 class="feature-title">Test-Driven Development</h3>
			</div>
			<p class="feature-description">
				Complete testing setup with Vitest and Playwright. Unit, integration, and E2E tests
				configured out of the box. TDD workflow with 90%+ coverage targets.
			</p>
		</div>

		<!-- Feature 7: Theme System -->
		<div class="feature-card">
			<div class="feature-header">
				<div class="feature-icon">
					<svg
						width="40"
						height="40"
						viewBox="0 0 40 40"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<circle cx="20" cy="20" r="12" fill="var(--color-primary)" opacity="0.3" />
						<path d="M20 8A12 12 0 0 1 32 20" fill="var(--color-primary)" />
						<circle cx="20" cy="20" r="4" fill="var(--color-background)" />
					</svg>
				</div>
				<h3 class="feature-title">Adaptive Theming</h3>
			</div>
			<p class="feature-description">
				Beautiful light and dark themes with CSS custom properties. System preference detection,
				smooth transitions, and WCAG AA contrast compliance.
			</p>
		</div>

		<!-- Feature 8: Command Palette -->
		<div class="feature-card">
			<div class="feature-header">
				<div class="feature-icon">
					<svg
						width="40"
						height="40"
						viewBox="0 0 40 40"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<rect
							x="6"
							y="10"
							width="28"
							height="20"
							rx="3"
							stroke="var(--color-primary)"
							stroke-width="2"
						/>
						<path d="M12 18l4 4 4-4" stroke="var(--color-primary)" stroke-width="2" />
						<line x1="22" y1="16" x2="28" y2="16" stroke="var(--color-primary)" stroke-width="2" />
						<line x1="22" y1="20" x2="26" y2="20" stroke="var(--color-primary)" stroke-width="2" />
						<line x1="22" y1="24" x2="28" y2="24" stroke="var(--color-primary)" stroke-width="2" />
					</svg>
				</div>
				<h3 class="feature-title">Command Palette</h3>
			</div>
			<p class="feature-description">
				Power-user navigation with keyboard shortcuts (⌘K). Quick access to all features, search,
				and actions without touching the mouse.
			</p>
		</div>

		<!-- Feature 9: Developer Experience -->
		<div class="feature-card">
			<div class="feature-header">
				<div class="feature-icon">
					<svg
						width="40"
						height="40"
						viewBox="0 0 40 40"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							d="M12 14l-6 6 6 6M28 14l6 6-6 6"
							stroke="var(--color-primary)"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
						<path
							d="M24 10l-8 20"
							stroke="var(--color-primary)"
							stroke-width="2"
							stroke-linecap="round"
						/>
					</svg>
				</div>
				<h3 class="feature-title">Developer Experience</h3>
			</div>
			<p class="feature-description">
				Hot module replacement, TypeScript, ESLint, Prettier, and Git hooks configured. Build, test,
				and deploy with confidence using best practices.
			</p>
		</div>

		<!-- Feature 10: GitHub Copilot Ready -->
		<div class="feature-card">
			<div class="feature-header">
				<div class="feature-icon">
					<svg
						width="40"
						height="40"
						viewBox="0 0 40 40"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							d="M20 4c-8.84 0-16 7.16-16 16 0 7.07 4.58 13.06 10.94 15.18.8.15 1.09-.35 1.09-.77 0-.38-.01-1.64-.02-2.97-4.45.97-5.39-1.89-5.39-1.89-.73-1.85-1.78-2.34-1.78-2.34-1.45-.99.11-.97.11-.97 1.61.11 2.45 1.65 2.45 1.65 1.43 2.45 3.75 1.74 4.66 1.33.15-1.04.56-1.74 1.02-2.14-3.56-.41-7.3-1.78-7.3-7.92 0-1.75.62-3.18 1.64-4.3-.16-.4-.71-2.03.16-4.23 0 0 1.34-.43 4.4 1.64 1.27-.35 2.64-.53 4-.54 1.36.01 2.73.19 4 .54 3.06-2.07 4.4-1.64 4.4-1.64.87 2.2.32 3.83.16 4.23 1.02 1.12 1.64 2.55 1.64 4.3 0 6.16-3.75 7.51-7.32 7.91.58.5 1.09 1.48 1.09 2.98 0 2.15-.02 3.89-.02 4.42 0 .43.29.93 1.1.77C31.42 33.06 36 27.07 36 20c0-8.84-7.16-16-16-16z"
							fill="var(--color-primary)"
						/>
						<circle cx="28" cy="12" r="6" fill="var(--color-secondary)" />
						<path
							d="M28 9v6M25 12h6"
							stroke="var(--color-background)"
							stroke-width="1.5"
							stroke-linecap="round"
						/>
					</svg>
				</div>
				<h3 class="feature-title">GitHub Copilot Ready</h3>
			</div>
			<p class="feature-description">
				Pre-configured with comprehensive Copilot instructions for TDD workflows, architectural
				patterns, and best practices. Accelerate development with AI-powered assistance.
			</p>
		</div>

		<!-- Feature 11: Real-time Features -->
		<div class="feature-card">
			<div class="feature-header">
				<div class="feature-icon">
					<svg
						width="40"
						height="40"
						viewBox="0 0 40 40"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<circle cx="20" cy="20" r="14" stroke="var(--color-primary)" stroke-width="2" />
						<path
							d="M20 10v10l6 6"
							stroke="var(--color-primary)"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
						<circle cx="32" cy="8" r="4" fill="var(--color-secondary)">
							<animate attributeName="opacity" values="1;0.3;1" dur="2s" repeatCount="indefinite" />
						</circle>
					</svg>
				</div>
				<h3 class="feature-title">WebSocket & Real-time</h3>
			</div>
			<p class="feature-description">
				Built-in support for Cloudflare Durable Objects and WebSockets. Build real-time applications
				like chat, notifications, and live updates with ease.
			</p>
		</div>

		<!-- Feature 12: API & Service Layer -->
		<div class="feature-card">
			<div class="feature-header">
				<div class="feature-icon">
					<svg
						width="40"
						height="40"
						viewBox="0 0 40 40"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<rect
							x="8"
							y="8"
							width="10"
							height="10"
							rx="2"
							fill="var(--color-primary)"
							opacity="0.3"
						/>
						<rect
							x="22"
							y="8"
							width="10"
							height="10"
							rx="2"
							fill="var(--color-primary)"
							opacity="0.5"
						/>
						<rect
							x="8"
							y="22"
							width="10"
							height="10"
							rx="2"
							fill="var(--color-primary)"
							opacity="0.7"
						/>
						<rect x="22" y="22" width="10" height="10" rx="2" fill="var(--color-primary)" />
						<line
							x1="18"
							y1="13"
							x2="22"
							y2="13"
							stroke="var(--color-secondary)"
							stroke-width="2"
						/>
						<line
							x1="13"
							y1="18"
							x2="13"
							y2="22"
							stroke="var(--color-secondary)"
							stroke-width="2"
						/>
						<line
							x1="27"
							y1="18"
							x2="27"
							y2="22"
							stroke="var(--color-secondary)"
							stroke-width="2"
						/>
					</svg>
				</div>
				<h3 class="feature-title">RESTful API Architecture</h3>
			</div>
			<p class="feature-description">
				Clean API design with SvelteKit endpoints. Type-safe request/response handling, middleware
				support, and automatic validation for robust backend services.
			</p>
		</div>
	</div>

	<!-- Additional Info Row -->
	<div class="features-footer">
		<div class="feature-badge">
			<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
				<path
					d="M10 2l2.5 5.5L18 8.5l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-1L10 2z"
					fill="var(--color-primary)"
				/>
			</svg>
			<span>Production Ready</span>
		</div>
		<div class="feature-badge">
			<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
				<path
					d="M10 18c-4.4 0-8-3.6-8-8s3.6-8 8-8 8 3.6 8 8-3.6 8-8 8zm0-14c-3.3 0-6 2.7-6 6s2.7 6 6 6 6-2.7 6-6-2.7-6-6-6z"
					fill="var(--color-primary)"
				/>
				<path d="M9 13l-3-3 1.4-1.4L9 10.2l4.6-4.6L15 7l-6 6z" fill="var(--color-primary)" />
			</svg>
			<span>Type Safe</span>
		</div>
		<div class="feature-badge">
			<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
				<path
					d="M3 10l7-7 7 7M5 12v6h10v-6"
					stroke="var(--color-primary)"
					stroke-width="2"
					fill="none"
				/>
				<path d="M8 18v-4h4v4" stroke="var(--color-primary)" stroke-width="2" />
			</svg>
			<span>Open Source</span>
		</div>
	</div>
</section>

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

	/* Fade-out effect at the bottom of hero */
	.hero::after {
		content: '';
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		height: 200px;
		background: linear-gradient(180deg, transparent 0%, var(--color-background) 100%);
		pointer-events: none;
		z-index: 1;
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
		position: relative;
		text-align: center;
		opacity: 0;
		transform: translateY(30px);
		transition:
			opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1),
			transform 0.8s cubic-bezier(0.4, 0, 0.2, 1);
		z-index: 2;
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

	.svelte-icon,
	.cloudflare-icon,
	.ai-icon {
		display: inline-block;
		vertical-align: middle;
		margin: 0 0.25rem;
		transform: translateY(-2px);
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
		min-width: 0;
		overflow: hidden;
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
		font-size: 0.875rem;
		outline: none;
		font-weight: 400;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.search-box input::placeholder {
		color: var(--color-text-secondary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
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
		gap: var(--spacing-sm);
		background: transparent;
		border: 1px solid transparent;
		border-radius: 10px;
		padding: var(--spacing-md) var(--spacing-lg);
		color: var(--color-text);
		text-align: left;
		font-size: 0.875rem;
		font-weight: 400;
		transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
		cursor: pointer;
		position: relative;
		min-width: 0;
		flex-wrap: nowrap;
		overflow: hidden;
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
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
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
		min-width: 40px;
		flex-shrink: 0;
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
			font-size: 2.5rem;
		}

		.subtitle {
			font-size: 0.938rem;
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
			max-width: 90%;
		}

		.search-box {
			padding: var(--spacing-sm) var(--spacing-md);
		}

		.search-box input {
			font-size: 0.938rem;
		}

		.command-option {
			padding: var(--spacing-sm) var(--spacing-md);
			font-size: 0.875rem;
		}

		.ai-indicator {
			width: 36px;
			height: 36px;
		}

		.ai-indicator svg {
			width: 20px;
			height: 20px;
		}
	}

	@media (max-width: 480px) {
		.main-title {
			font-size: 2rem;
		}

		.subtitle {
			font-size: 0.875rem;
			line-height: 1.6;
		}

		.command-palette {
			padding: var(--spacing-sm);
			border-radius: 16px;
		}

		.search-box {
			padding: var(--spacing-xs) var(--spacing-sm);
			border-radius: 10px;
		}

		.search-box input {
			font-size: 0.875rem;
		}

		.search-icon {
			width: 16px;
			height: 16px;
		}

		.command-option {
			padding: var(--spacing-xs) var(--spacing-sm);
			font-size: 0.813rem;
			gap: var(--spacing-sm);
		}

		.option-icon {
			width: 16px;
			height: 16px;
		}

		.ai-indicator {
			width: 32px;
			height: 32px;
		}

		.ai-indicator svg {
			width: 18px;
			height: 18px;
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

	/* Features Section */
	.features {
		position: relative;
		padding: var(--spacing-6xl) 0;
		background: linear-gradient(
			180deg,
			var(--color-background) 0%,
			var(--color-surface) 50%,
			var(--color-background) 100%
		);
		overflow: hidden;
	}

	/* Subtle background pattern */
	.features::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-image: radial-gradient(
			circle at 20% 30%,
			color-mix(in srgb, var(--color-primary) 3%, transparent) 0%,
			transparent 50%
		);
		pointer-events: none;
	}

	.features-header {
		text-align: center;
		padding-top: 4rem;
		padding-bottom: 4rem;
		max-width: 900px;
		margin-left: auto;
		margin-right: auto;
		position: relative;
		z-index: 1;
	}

	.features-title {
		font-size: 3rem;
		font-weight: 800;
		color: var(--color-text);
		margin-bottom: var(--spacing-lg);
		letter-spacing: -0.03em;
		background: linear-gradient(
			135deg,
			var(--color-text) 0%,
			color-mix(in srgb, var(--color-primary) 80%, var(--color-text)) 100%
		);
		background-clip: text;
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		text-shadow: 0 2px 20px color-mix(in srgb, var(--color-primary) 20%, transparent);
	}

	.features-subtitle {
		font-size: 1.25rem;
		color: var(--color-text-secondary);
		line-height: 1.7;
		font-weight: 400;
		max-width: 640px;
		margin: 0 auto;
	}

	.features-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: var(--spacing-xl);
		margin-bottom: var(--spacing-4xl);
		padding: 0 2rem;
		position: relative;
		z-index: 1;
		max-width: 100%;
		box-sizing: border-box;
	}

	.feature-card {
		position: relative;
		padding: var(--spacing-2xl);
		border: 1px solid var(--color-border);
		border-radius: 16px;
		background: var(--color-surface);
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		overflow: hidden;
		cursor: default;
	}

	/* Gradient overlay on hover */
	.feature-card::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: linear-gradient(
			135deg,
			color-mix(in srgb, var(--color-primary) 5%, transparent) 0%,
			color-mix(in srgb, var(--color-secondary) 5%, transparent) 100%
		);
		opacity: 0;
		transition: opacity 0.3s ease;
		pointer-events: none;
	}

	.feature-card:hover::before {
		opacity: 1;
	}

	.feature-card:hover {
		transform: translateY(-8px) scale(1.02);
		border-color: color-mix(in srgb, var(--color-primary) 40%, transparent);
		box-shadow:
			0 20px 40px color-mix(in srgb, var(--color-primary) 15%, transparent),
			0 0 0 1px color-mix(in srgb, var(--color-primary) 20%, transparent) inset;
	}

	/* Shine effect on hover */
	.feature-card::after {
		content: '';
		position: absolute;
		top: -50%;
		left: -50%;
		width: 200%;
		height: 200%;
		background: linear-gradient(
			45deg,
			transparent 30%,
			color-mix(in srgb, var(--color-text) 5%, transparent) 50%,
			transparent 70%
		);
		transform: rotate(45deg) translate(-100%, -100%);
		transition: transform 0.6s ease;
		pointer-events: none;
	}

	.feature-card:hover::after {
		transform: rotate(45deg) translate(100%, 100%);
	}

	.feature-header {
		display: flex;
		align-items: center;
		gap: var(--spacing-lg);
		margin-bottom: var(--spacing-md);
	}

	.feature-icon {
		width: 48px;
		height: 48px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(
			135deg,
			color-mix(in srgb, var(--color-primary) 15%, transparent) 0%,
			color-mix(in srgb, var(--color-secondary) 10%, transparent) 100%
		);
		border: 1px solid color-mix(in srgb, var(--color-primary) 20%, transparent);
		border-radius: 12px;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		position: relative;
		z-index: 1;
	}

	.feature-icon svg {
		width: 28px;
		height: 28px;
	}

	.feature-card:hover .feature-icon {
		transform: scale(1.08) rotate(3deg);
		background: linear-gradient(
			135deg,
			color-mix(in srgb, var(--color-primary) 25%, transparent) 0%,
			color-mix(in srgb, var(--color-secondary) 20%, transparent) 100%
		);
		box-shadow: 0 6px 16px color-mix(in srgb, var(--color-primary) 25%, transparent);
	}

	.feature-icon svg {
		filter: drop-shadow(0 2px 4px color-mix(in srgb, var(--color-primary) 20%, transparent));
		transition: filter 0.3s ease;
	}

	.feature-card:hover .feature-icon svg {
		filter: drop-shadow(0 4px 8px color-mix(in srgb, var(--color-primary) 40%, transparent));
	}

	.feature-title {
		font-size: 1.375rem;
		font-weight: 700;
		color: var(--color-text);
		margin: 0;
		letter-spacing: -0.01em;
		position: relative;
		z-index: 1;
		transition: color 0.3s ease;
	}

	.feature-card:hover .feature-title {
		color: var(--color-primary);
	}

	.feature-description {
		font-size: 1rem;
		color: var(--color-text-secondary);
		line-height: 1.7;
		position: relative;
		z-index: 1;
	}

	.features-footer {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: var(--spacing-xl);
		flex-wrap: wrap;
		padding: var(--spacing-3xl) 0 0;
		margin-top: var(--spacing-2xl);
		border-top: 1px solid var(--color-border);
		position: relative;
		z-index: 1;
	}

	.feature-badge {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		padding: var(--spacing-md) var(--spacing-xl);
		background: linear-gradient(
			135deg,
			color-mix(in srgb, var(--color-primary) 12%, transparent) 0%,
			color-mix(in srgb, var(--color-secondary) 8%, transparent) 100%
		);
		border: 1px solid color-mix(in srgb, var(--color-primary) 25%, transparent);
		border-radius: var(--radius-full);
		font-size: 0.938rem;
		font-weight: 600;
		color: var(--color-text);
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		cursor: default;
	}

	.feature-badge:hover {
		transform: translateY(-2px) scale(1.05);
		background: linear-gradient(
			135deg,
			color-mix(in srgb, var(--color-primary) 18%, transparent) 0%,
			color-mix(in srgb, var(--color-secondary) 12%, transparent) 100%
		);
		border-color: color-mix(in srgb, var(--color-primary) 40%, transparent);
		box-shadow: 0 8px 16px color-mix(in srgb, var(--color-primary) 15%, transparent);
	}

	.feature-badge svg {
		flex-shrink: 0;
		transition: transform 0.3s ease;
	}

	.feature-badge:hover svg {
		transform: rotate(10deg) scale(1.1);
	}

	/* Tablet: 2 columns */
	@media (min-width: 769px) {
		.features-grid {
			grid-template-columns: repeat(2, 1fr);
			padding: 0 3rem;
		}

		.features {
			padding-top: var(--spacing-6xl);
		}
	}

	/* Desktop: 3 columns */
	@media (min-width: 1400px) {
		.features-grid {
			grid-template-columns: repeat(3, 1fr);
			padding: 0 4rem;
		}
	}

	/* Large desktop: more padding */
	@media (min-width: 1440px) {
		.features-grid {
			padding: 0 6rem;
		}
	}

	/* Mobile: 1 column (base styles) */
	@media (max-width: 768px) {
		.features {
			padding-top: var(--spacing-3xl);
			padding-bottom: var(--spacing-3xl);
		}

		.features-title {
			font-size: 2.25rem;
		}

		.features-subtitle {
			font-size: 1.0625rem;
		}

		.features-grid {
			gap: var(--spacing-lg);
		}

		.feature-card {
			padding: var(--spacing-xl);
		}

		.feature-icon {
			width: 64px;
			height: 64px;
		}

		.feature-title {
			font-size: 1.25rem;
		}

		.feature-description {
			font-size: 0.938rem;
		}

		.features-footer {
			gap: var(--spacing-md);
			padding-top: var(--spacing-2xl);
		}

		.feature-badge {
			font-size: 0.875rem;
			padding: var(--spacing-sm) var(--spacing-lg);
		}
	}

	@media (max-width: 480px) {
		.features-title {
			font-size: 1.75rem;
		}

		.features-subtitle {
			font-size: 0.938rem;
		}

		.feature-card {
			padding: var(--spacing-lg);
		}

		.feature-icon {
			width: 56px;
			height: 56px;
			margin-bottom: var(--spacing-lg);
		}

		.feature-icon svg {
			width: 32px;
			height: 32px;
		}

		.feature-title {
			font-size: 1.125rem;
		}

		.feature-description {
			font-size: 0.875rem;
			line-height: 1.6;
		}

		.feature-badge {
			font-size: 0.813rem;
			padding: var(--spacing-xs) var(--spacing-sm);
		}
	}
</style>
