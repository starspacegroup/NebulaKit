<!--
	AppShell — the frame of an app: a skip link, a header, a navigation
	sidebar, the main landmark and a footer. On a wide shell the sidebar sits
	beside the content and collapses with the header button; on a narrow one it
	becomes an off-canvas panel on a native modal <dialog>, so focus is trapped
	in it, Escape closes it, and focus returns to the button that opened it.
	"Narrow" is the width of the shell itself, not the window, so it also
	works in a box. Fill the `brand`, `header`, `nav` (the sidebar), default
	(main) and `footer` slots. Bind `collapsed` and `open`.
-->
<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import { isOffCanvas, uid } from '$lib/ui';
	import { trackWidth } from './dom';

	/** Off, the content is a plain div, for a shell shown inside a page that already has a main landmark. */
	export let landmark = true;
	/** Names the sidebar navigation landmark. */
	export let navLabel = 'Main navigation';
	export let skipLabel = 'Skip to main content';
	export let menuLabel = 'Menu';
	export let collapseLabel = 'Collapse sidebar';
	export let expandLabel = 'Expand sidebar';
	export let closeLabel = 'Close menu';
	/** The shell is narrow below this width in pixels, and the sidebar goes off-canvas. */
	export let breakpoint = 768;
	/** A wide shell's sidebar is hidden. */
	export let collapsed = false;
	/** A narrow shell's off-canvas sidebar is showing. */
	export let open = false;
	/** Fill a box instead of the viewport: give the shell a height of its own (any CSS length). */
	export let height = '';

	const dispatch = createEventDispatcher<{ toggle: { collapsed: boolean }; navigate: void }>();
	const id = uid('app-shell');
	let width = 0;
	let panel: HTMLElement;
	let toggleButton: HTMLButtonElement;
	let main: HTMLElement;

	$: compact = isOffCanvas(width, breakpoint);
	$: if (!compact) open = false;
	$: if (panel && compact) syncDialog(open);

	function syncDialog(want: boolean) {
		const dialog = panel as HTMLDialogElement;
		if (want && !dialog.open) {
			if (typeof dialog.showModal === 'function') dialog.showModal();
			else dialog.setAttribute('open', '');
		} else if (!want && dialog.open) {
			if (typeof dialog.close === 'function') dialog.close();
			else dialog.removeAttribute('open');
		}
	}

	function toggle() {
		if (compact) {
			open = true;
		} else {
			collapsed = !collapsed;
			dispatch('toggle', { collapsed });
		}
	}

	async function closePanel() {
		open = false;
		await tick();
		toggleButton?.focus();
	}

	function skip(event: MouseEvent) {
		event.preventDefault();
		main?.focus();
	}

	// The off-canvas panel is a dialog: a click on the dialog itself is the
	// backdrop, the native close mirrors into `open`, and following a link
	// inside it closes the panel. Attached as an action, as Dialog does.
	function overlay(node: HTMLElement) {
		const onClick = (event: MouseEvent) => {
			const target = event.target as Element;
			if (node.tagName === 'DIALOG' && target === node) closePanel();
			else if (node.tagName === 'DIALOG' && target.closest('a[href]')) {
				dispatch('navigate');
				closePanel();
			}
		};
		const onClose = () => {
			if (open) closePanel();
		};
		node.addEventListener('click', onClick);
		node.addEventListener('close', onClose);
		return {
			destroy() {
				node.removeEventListener('click', onClick);
				node.removeEventListener('close', onClose);
			}
		};
	}

	$: expanded = compact ? open : !collapsed;
</script>

<div
	class="shell"
	class:shell--boxed={height}
	class:shell--compact={compact}
	class:shell--collapsed={!compact && collapsed}
	style:height={height || undefined}
	use:trackWidth={(w) => (width = w)}
>
	<a class="shell__skip" href="#{id}-main" on:click={skip}>{skipLabel}</a>

	<header class="shell__header">
		<button
			bind:this={toggleButton}
			type="button"
			class="shell__toggle"
			aria-expanded={expanded}
			aria-controls="{id}-nav"
			aria-haspopup={compact ? 'dialog' : undefined}
			aria-label={compact ? menuLabel : collapsed ? expandLabel : collapseLabel}
			on:click={toggle}
		>
			<span aria-hidden="true">☰</span>
		</button>
		<div class="shell__brand"><slot name="brand" /></div>
		<div class="shell__header-end"><slot name="header" /></div>
	</header>

	<div class="shell__body">
		<svelte:element
			this={compact ? 'dialog' : 'aside'}
			bind:this={panel}
			id="{id}-nav"
			class="shell__sidebar"
			aria-label={compact ? menuLabel : undefined}
			hidden={!compact && collapsed ? true : undefined}
			use:overlay
		>
			<div class="shell__sidebar-inner">
				{#if compact}
					<button type="button" class="shell__close" on:click={closePanel}>
						<span aria-hidden="true">×</span>
						<span class="shell__sr">{closeLabel}</span>
					</button>
				{/if}
				<nav aria-label={navLabel} class="shell__nav"><slot name="nav" /></nav>
			</div>
		</svelte:element>

		<div class="shell__content">
			<svelte:element
				this={landmark ? 'main' : 'div'}
				id="{id}-main"
				class="shell__main"
				tabindex="-1"
				bind:this={main}
			>
				<slot />
			</svelte:element>
			{#if $$slots.footer}
				<footer class="shell__footer"><slot name="footer" /></footer>
			{/if}
		</div>
	</div>
</div>

<style>
	.shell {
		position: relative;
		display: flex;
		flex-direction: column;
		min-width: 0;
		min-height: 100dvh;
		overflow: hidden;
		background: var(--color-background);
		color: var(--color-text);
		container-type: inline-size;
	}

	.shell--boxed {
		min-height: 0;
	}

	.shell__skip {
		position: absolute;
		inset-block-start: var(--spacing-sm);
		inset-inline-start: var(--spacing-sm);
		z-index: 80;
		padding: var(--spacing-sm) var(--spacing-md);
		border-radius: var(--radius-md);
		background: var(--color-primary-solid);
		color: var(--color-on-solid);
		font-weight: 600;
		transform: translateY(-300%);
	}

	.shell__skip:focus {
		transform: none;
		outline: 2px solid var(--color-text);
		outline-offset: 2px;
	}

	.shell__header {
		display: flex;
		flex: none;
		align-items: center;
		gap: var(--spacing-sm);
		min-width: 0;
		padding: var(--spacing-sm) var(--spacing-md);
		border-block-end: 1px solid var(--color-border);
		background: var(--color-surface);
	}

	.shell__brand {
		flex: 1;
		min-width: 0;
		font-weight: 700;
		overflow-wrap: anywhere;
	}

	.shell__header-end {
		display: flex;
		flex: none;
		align-items: center;
		gap: var(--spacing-sm);
	}

	.shell__toggle,
	.shell__close {
		display: inline-grid;
		flex: none;
		place-items: center;
		min-width: 44px;
		min-height: 44px;
		padding: 0 var(--spacing-sm);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-background);
		color: var(--color-text);
		font: inherit;
		font-size: 1.25rem;
		cursor: pointer;
	}

	.shell__toggle:hover,
	.shell__close:hover {
		background: var(--color-surface-hover);
	}

	.shell__toggle:focus-visible,
	.shell__close:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.shell__body {
		display: flex;
		flex: 1;
		min-height: 0;
		min-width: 0;
	}

	.shell__sidebar {
		flex: none;
		box-sizing: border-box;
		width: 16rem;
		max-width: 100%;
		margin: 0;
		padding: 0;
		overflow-y: auto;
		border: 0;
		border-inline-end: 1px solid var(--color-border);
		background: var(--color-surface);
		color: var(--color-text);
	}

	.shell__sidebar[hidden] {
		display: none;
	}

	.shell__sidebar-inner {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-sm);
		padding: var(--spacing-md);
	}

	.shell__close {
		justify-self: end;
	}

	.shell__nav {
		min-width: 0;
	}

	.shell__content {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-width: 0;
		overflow-y: auto;
	}

	.shell__main {
		flex: 1;
		min-width: 0;
		padding: var(--spacing-md);
	}

	.shell__main:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: -2px;
	}

	.shell__footer {
		flex: none;
		padding: var(--spacing-md);
		border-block-start: 1px solid var(--color-border);
		color: var(--color-text-secondary);
		font-size: 0.875rem;
	}

	/* Off-canvas: the sidebar is a modal dialog docked to the inline start edge. */
	.shell--compact dialog.shell__sidebar {
		position: fixed;
		inset-block: 0;
		inset-inline-start: 0;
		inset-inline-end: auto;
		width: min(20rem, calc(100vw - 3rem));
		height: 100dvh;
		max-height: none;
		border-inline-end: 1px solid var(--color-border);
		box-shadow: var(--shadow-xl);
	}

	.shell--compact dialog.shell__sidebar::backdrop {
		background: rgb(0 0 0 / 0.5);
	}

	@media (prefers-reduced-motion: no-preference) {
		.shell--compact :global(dialog.shell__sidebar[open]) {
			animation: shell-slide var(--transition-slow);
		}
	}

	@keyframes -global-shell-slide {
		from {
			transform: translateX(-100%);
		}
	}

	:global([dir='rtl'] .shell--compact dialog.shell__sidebar[open]) {
		animation-name: shell-slide-rtl;
	}

	@keyframes -global-shell-slide-rtl {
		from {
			transform: translateX(100%);
		}
	}

	@media (min-width: 48rem) {
		.shell__main,
		.shell__footer {
			padding-inline: var(--spacing-lg);
		}
	}

	.shell__sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
</style>
