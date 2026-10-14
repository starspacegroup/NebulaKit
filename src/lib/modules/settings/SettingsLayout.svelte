<!--
	SettingsLayout — the shell of a settings page. Wide screens get a sticky
	side nav; narrow ones get a select. One section shows at a time: the default
	slot receives `active` (the section id), so a page renders whichever panel
	matches. Bind `active`, or listen to `change`. The hash (#notifications)
	deep-links to a section.
-->
<script lang="ts">
	import { createEventDispatcher, onMount, tick } from 'svelte';
	import { moveSection, resolveSection, sectionFromHash, type SettingsSection } from './logic';

	export let sections: SettingsSection[] = [];
	export let active = '';
	export let title = 'Settings';
	export let level: 1 | 2 | 3 | 4 = 1;
	export let navLabel = 'Settings sections';
	export let selectLabel = 'Go to section';
	/** Read and write location.hash so sections are linkable. */
	export let syncHash = true;

	const dispatch = createEventDispatcher<{ change: { id: string } }>();

	$: current = resolveSection(active, sections);
	$: section = sections.find((s) => s.id === current);

	let panel: HTMLElement | undefined;
	let nav: HTMLElement | undefined;

	onMount(() => {
		if (!syncHash) return;
		const fromHash = () => {
			const id = sectionFromHash(location.hash, sections);
			if (id) active = id;
		};
		fromHash();
		window.addEventListener('hashchange', fromHash);
		return () => window.removeEventListener('hashchange', fromHash);
	});

	async function go(id: string, moveFocus: 'panel' | 'nav' | 'none') {
		active = resolveSection(id, sections);
		dispatch('change', { id: active });
		if (syncHash && typeof history !== 'undefined') {
			history.replaceState(history.state, '', `#${encodeURIComponent(active)}`);
		}
		await tick();
		if (moveFocus === 'panel') panel?.focus();
		else if (moveFocus === 'nav')
			Array.from(nav?.querySelectorAll<HTMLElement>('[data-section]') ?? [])
				.find((a) => a.dataset.section === active)
				?.focus();
	}

	function onKey(event: KeyboardEvent) {
		const map: Record<string, 1 | -1 | 'first' | 'last'> = {
			ArrowDown: 1,
			ArrowUp: -1,
			Home: 'first',
			End: 'last'
		};
		const delta = map[event.key];
		if (!delta) return;
		event.preventDefault();
		go(moveSection(current, sections, delta), 'nav');
	}

	function onSelect(event: Event) {
		go((event.target as HTMLSelectElement).value, 'panel');
	}
</script>

<div class="settings">
	<header class="settings__head">
		<svelte:element this={`h${level}`} class="settings__title">{title}</svelte:element>
	</header>

	<div class="settings__body">
		<div class="settings__mobile">
			<label for="settings-select">{selectLabel}</label>
			<select id="settings-select" value={current} on:change={onSelect}>
				{#each sections as s (s.id)}
					<option value={s.id}>{s.label}</option>
				{/each}
			</select>
		</div>

		<nav class="settings__nav" aria-label={navLabel} bind:this={nav}>
			<ul>
				{#each sections as s (s.id)}
					<li>
						<a
							href="#{s.id}"
							data-section={s.id}
							aria-current={s.id === current ? 'page' : undefined}
							on:click|preventDefault={() => go(s.id, 'panel')}
							on:keydown={onKey}>{s.label}</a
						>
					</li>
				{/each}
			</ul>
		</nav>

		<div
			class="settings__panel"
			tabindex="-1"
			bind:this={panel}
			role="region"
			aria-label={section?.label ?? title}
		>
			{#if section}
				<svelte:element this={`h${level + 1}`} class="settings__heading"
					>{section.label}</svelte:element
				>
				{#if section.description}<p class="settings__desc">{section.description}</p>{/if}
			{/if}
			<slot active={current} {section} />
		</div>
	</div>
</div>

<style>
	.settings {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-lg);
		min-width: 0;
	}

	.settings__title {
		margin: 0;
	}

	.settings__body {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
		min-width: 0;
	}

	.settings__mobile {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-xs);
	}

	.settings__mobile label {
		font-weight: 600;
	}

	.settings__mobile select {
		min-block-size: 2.75rem;
		inline-size: 100%;
		box-sizing: border-box;
	}

	.settings__nav {
		display: none;
	}

	.settings__panel {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		align-content: start;
		gap: var(--spacing-md);
		min-width: 0;
	}

	.settings__panel:focus-visible {
		outline: 3px solid var(--color-primary);
		outline-offset: 4px;
	}

	.settings__heading {
		margin: 0;
	}

	.settings__desc {
		margin: 0;
		color: var(--color-text-secondary);
	}

	@media (min-width: 52rem) {
		.settings__body {
			grid-template-columns: 14rem minmax(0, 1fr);
			align-items: start;
			gap: var(--spacing-xl);
		}

		.settings__mobile {
			display: none;
		}

		.settings__nav {
			display: block;
			position: sticky;
			inset-block-start: var(--spacing-md);
		}

		.settings__nav ul {
			display: grid;
			grid-template-columns: minmax(0, 1fr);
			gap: var(--spacing-xs);
			margin: 0;
			padding: 0;
			list-style: none;
		}

		.settings__nav a {
			display: flex;
			align-items: center;
			min-block-size: 2.75rem;
			padding: 0 var(--spacing-md);
			border-inline-start: 3px solid transparent;
			border-radius: var(--radius-md);
			color: var(--color-text);
			text-decoration: none;
		}

		.settings__nav a:hover {
			background: var(--color-surface-hover);
		}

		.settings__nav a:focus-visible {
			outline: 3px solid var(--color-primary);
			outline-offset: 2px;
		}

		.settings__nav a[aria-current='page'] {
			border-inline-start-color: var(--color-primary);
			background: var(--color-surface);
			font-weight: 600;
		}
	}
</style>
