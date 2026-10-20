<script lang="ts">
	/**
	 * The drag-and-drop page editor.
	 *
	 * Build a page from blocks: drag one from the palette (or press its Add
	 * button), drop it on the page or inside a Section or Column, drag blocks
	 * to reorder or nest them, and set each one's fields in the settings panel.
	 *
	 * What it promises:
	 * - **Every drag has a non-drag path.** Add buttons, Move up/down, Move into
	 *   the block above, Move out, and Alt+Arrow keys do everything a drag does,
	 *   and each result is announced. Dragging itself works with a mouse, a
	 *   finger (press and hold) or the keyboard, through `$lib/actions/draggable`.
	 * - **Undo is real.** Ctrl/⌘+Z and Ctrl/⌘+Shift+Z, with typing folded into
	 *   one step per field (see history.ts).
	 * - **It shows what visitors get.** The canvas uses the live page's own
	 *   styles, and the Mobile / Tablet / Desktop switch narrows the frame so
	 *   the same responsive rules fire as on a real device.
	 * - **Nothing here saves.** All edits go through the pure functions in
	 *   ops.ts; saving is the caller's job (`onsave`), which the admin route
	 *   does through the site API. A page with unsaved edits warns before the
	 *   tab closes.
	 */
	import { tick, untrack } from 'svelte';
	import { dropzone, draggable, type DropDetail } from '$lib/actions/draggable';
	import CanvasBlocks, { BOARD, ROOT_GROUP, type CanvasContext } from './CanvasBlocks.svelte';
	import Inspector from './Inspector.svelte';
	import PageRenderer from './PageRenderer.svelte';
	import { canRedo, canUndo, commit, createHistory, redo, reset, undo } from './history';
	import { lintDocument, type LintIssue } from './lint';
	import {
		cloneBlock,
		createBlock,
		duplicateBlock,
		findBlock,
		indentBlock,
		insertBlock,
		moveBlock,
		moveBy,
		newBlockId,
		outdentBlock,
		removeBlock,
		selectionAfterRemoval,
		setColumnCount,
		setHidden,
		updateBlockProps,
		walk,
		canInsert
	} from './ops';
	import {
		BLOCK_LIBRARY,
		PALETTE_TYPES,
		isContainer,
		type Block,
		type BlockType,
		type Breakpoint,
		type PageDocument
	} from './schema';
	import type { GridProduct } from './BlockView.svelte';

	let {
		document = $bindable(),
		onsave,
		saving = false,
		products = []
	}: {
		document: PageDocument;
		/** Return `false` (or reject) when the save failed, so the page stays marked unsaved. */
		onsave?: (doc: PageDocument) => void | boolean | Promise<void | boolean>;
		saving?: boolean;
		products?: GridProduct[];
	} = $props();

	// The editor works on plain, raw documents it owns (never `$state` proxies), so the
	// "nothing changed" reference checks in ops.ts and history.ts hold. The bound
	// `document` is only where the result is handed back.
	// svelte-ignore state_referenced_locally
	let history = $state.raw(createHistory(document));
	// svelte-ignore state_referenced_locally
	let savedDoc = $state.raw<PageDocument>(document);
	const doc = $derived(history.present);
	let selectedId = $state<string | null>(null);
	let view = $state<'mobile' | 'tablet' | 'desktop'>('desktop');
	let previewing = $state(false);
	let announcement = $state('');
	let clipboard: Block | null = null;
	let root: HTMLElement;
	let wide = $state(false);
	// svelte-ignore state_referenced_locally
	let paletteOpen = $state(document.blocks.length === 0);

	// On a wide editor the palette is a permanent column, so it is always open.
	$effect(() => {
		const watch = new ResizeObserver(([entry]) => {
			wide = entry.contentRect.width >= 1024;
			if (wide) paletteOpen = true;
		});
		watch.observe(root);
		return () => watch.disconnect();
	});

	// A parent that swaps in a different document (loading another page) starts a fresh
	// history. Compared by content: the bound value comes back through a `$state` proxy,
	// so a reference check would mistake the editor's own change for the parent's.
	$effect(() => {
		const incoming = $state.snapshot(document) as PageDocument;
		if (JSON.stringify(incoming) !== JSON.stringify(untrack(() => history.present))) {
			history = reset(incoming);
			savedDoc = incoming;
		}
	});

	function publish() {
		document = history.present;
	}

	const dirty = $derived(history.present !== savedDoc);
	const selected = $derived(selectedId ? (findBlock(doc, selectedId)?.block ?? null) : null);
	const issues = $derived(lintDocument(doc));
	const issuesById = $derived.by(() => {
		const map = new Map<string, LintIssue[]>();
		for (const issue of issues) map.set(issue.blockId, [...(map.get(issue.blockId) ?? []), issue]);
		return map;
	});
	const order = $derived.by(() => {
		const ids: string[] = [];
		walk(doc.blocks, (b) => ids.push(b.id));
		return ids;
	});
	const focusId = $derived(
		selectedId && order.includes(selectedId) ? selectedId : (order[0] ?? null)
	);

	function say(message: string) {
		// A trailing space makes the same message announce again.
		announcement = announcement === message ? `${message} ` : message;
	}

	const nameOf = (block: Block): string => {
		const label = BLOCK_LIBRARY[block.type].label;
		const p = block.props as Record<string, unknown>;
		const text = (p.text ?? p.label ?? p.heading ?? p.alt ?? '') as string;
		return `${label}: ${String(text).trim().slice(0, 60) || 'empty'}`;
	};

	function apply(next: PageDocument, message?: string, key?: string) {
		if (next === history.present) return false;
		history = commit(history, next, { key });
		publish();
		if (selectedId && !findBlock(doc, selectedId)) selectedId = null;
		if (message) say(message);
		return true;
	}

	function doUndo() {
		if (!canUndo(history)) return;
		history = undo(history);
		publish();
		if (selectedId && !findBlock(doc, selectedId)) selectedId = null;
		say('Undone.');
	}
	function doRedo() {
		if (!canRedo(history)) return;
		history = redo(history);
		publish();
		say('Redone.');
	}

	async function focusBlock(id: string) {
		selectedId = id;
		await tick();
		globalThis.document.getElementById(`cv-select-${id}`)?.focus();
	}

	/** Where a block added with the Add button goes: next to, or inside, what is selected. */
	function target(): { parentId: string | null; index: number } {
		const found = selectedId ? findBlock(doc, selectedId) : null;
		if (!found) return { parentId: null, index: Infinity };
		const kind = found.block.type;
		if (kind === 'section' || kind === 'column')
			return { parentId: found.block.id, index: Infinity };
		if (kind === 'columns') return { parentId: found.parent?.id ?? null, index: found.index + 1 };
		return { parentId: found.parent?.id ?? null, index: found.index + 1 };
	}

	function add(type: BlockType, parentId?: string | null, index?: number) {
		const place = parentId === undefined ? target() : { parentId, index: index ?? Infinity };
		const block = createBlock(type);
		if (!canInsert(doc, block, place.parentId)) {
			say(`A ${BLOCK_LIBRARY[type].label} cannot go there.`);
			return;
		}
		const next = insertBlock(doc, block, place.parentId, place.index);
		apply(next, `${BLOCK_LIBRARY[type].label} added.`);
		void focusBlock(block.id);
	}

	function drop(detail: DropDetail) {
		const toParent = detail.toGroup === ROOT_GROUP ? null : detail.toGroup;
		if (detail.id.startsWith('new:')) {
			if (detail.toGroup === 'palette') return;
			add(detail.id.slice(4) as BlockType, toParent, detail.toIndex);
			return;
		}
		const block = findBlock(doc, detail.id)?.block;
		if (!block) return;
		const next = moveBlock(doc, detail.id, toParent, detail.toIndex);
		if (next === doc) {
			const same = findBlock(doc, detail.id)?.parent?.id === toParent;
			if (!same || toParent !== null) say(`${nameOf(block)} cannot go there.`);
			return;
		}
		const now = findBlock(next, detail.id);
		apply(
			next,
			`${nameOf(block)} moved to position ${(now?.index ?? 0) + 1} of ${now?.siblings.length ?? 0}.`
		);
	}

	function step(fn: (doc: PageDocument, id: string) => PageDocument, id: string, said: string) {
		const block = findBlock(doc, id)?.block;
		const next = fn(doc, id);
		if (next === doc) return;
		apply(next, block ? `${nameOf(block)} ${said}` : said);
		void tick().then(() => globalThis.document.getElementById(`cv-select-${id}`)?.focus());
	}

	function remove(id: string) {
		const block = findBlock(doc, id)?.block;
		const after = selectionAfterRemoval(doc, id);
		const next = removeBlock(doc, id);
		if (next === doc) return;
		apply(next, `${block ? nameOf(block) : 'Block'} deleted.`);
		if (after) void focusBlock(after);
		else selectedId = null;
	}

	function duplicate(id: string) {
		const copyId = newBlockId();
		const next = duplicateBlock(doc, id, copyId);
		if (apply(next, 'Duplicated.')) void focusBlock(copyId);
		else say('The page is full. Nothing was duplicated.');
	}

	async function settings(id: string) {
		selectedId = id;
		await tick();
		const heading = globalThis.document.getElementById('pe-inspector-title');
		heading?.focus();
		heading?.scrollIntoView({ block: 'nearest' });
	}

	const can = {
		moveUp: (id: string) => moveBy(doc, id, -1) !== doc,
		moveDown: (id: string) => moveBy(doc, id, 1) !== doc,
		indent: (id: string) => indentBlock(doc, id) !== doc,
		outdent: (id: string) => outdentBlock(doc, id) !== doc
	};

	const ctx: CanvasContext = $derived({
		doc: doc,
		selectedId,
		focusId,
		order,
		nameOf,
		issues: issuesById,
		select: (id) => (selectedId = id),
		focus: (id) => void focusBlock(id),
		drop,
		moveBy: (id, delta) =>
			step((d, i) => moveBy(d, i, delta), id, delta < 0 ? 'moved up.' : 'moved down.'),
		indent: (id) => step(indentBlock, id, 'moved into the block above.'),
		outdent: (id) => step(outdentBlock, id, 'moved out.'),
		duplicate,
		remove,
		settings,
		can
	});

	function field(key: string, value: unknown) {
		if (!selected) return;
		apply(updateBlockProps(doc, selected.id, { [key]: value }), undefined, `${selected.id}:${key}`);
	}

	async function save() {
		if (!onsave || saving) return;
		const saving_ = doc;
		try {
			const result = await onsave(saving_);
			if (result !== false) savedDoc = saving_;
		} catch {
			/* the caller shows its own error; the page simply stays marked unsaved */
		}
	}

	function onKeydown(event: KeyboardEvent) {
		const mod = event.ctrlKey || event.metaKey;
		const key = event.key.toLowerCase();
		const el = event.target as HTMLElement;
		const inField = el.closest('input, textarea, select, [contenteditable="true"]') !== null;
		if (mod && key === 's') {
			event.preventDefault();
			void save();
			return;
		}
		if (inField) return;
		if (mod && key === 'z') {
			event.preventDefault();
			event.shiftKey ? doRedo() : doUndo();
		} else if (mod && key === 'y') {
			event.preventDefault();
			doRedo();
		} else if (el.closest('.cv-select') && selected) {
			if (mod && key === 'd') {
				event.preventDefault();
				duplicate(selected.id);
			} else if (mod && key === 'c') {
				clipboard = selected;
				say('Copied.');
			} else if (mod && key === 'x') {
				clipboard = selected;
				remove(selected.id);
			} else if (mod && key === 'v' && clipboard) {
				event.preventDefault();
				paste();
			} else if (event.key === 'Delete' || event.key === 'Backspace') {
				event.preventDefault();
				remove(selected.id);
			} else if (event.key === 'Escape') {
				selectedId = null;
			}
		}
	}

	function paste() {
		if (!clipboard) return;
		const copy = cloneBlock(clipboard);
		const place = target();
		if (!canInsert(doc, copy, place.parentId)) return say('That cannot be pasted there.');
		apply(insertBlock(doc, copy, place.parentId, place.index), 'Pasted.');
		void focusBlock(copy.id);
	}

	$effect(() => {
		if (!dirty || !onsave) return;
		const warn = (e: BeforeUnloadEvent) => e.preventDefault();
		window.addEventListener('beforeunload', warn);
		return () => window.removeEventListener('beforeunload', warn);
	});

	const VIEWS = [
		['mobile', 'Mobile'],
		['tablet', 'Tablet'],
		['desktop', 'Desktop']
	] as const;
	const WIDTHS = { mobile: '24.375rem', tablet: '51.25rem', desktop: '100%' } as const;

	const paletteDrop = (type: BlockType) => (detail: DropDetail) =>
		drop({ ...detail, id: `new:${type}` });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="pe" class:pe--wide={wide} bind:this={root} onkeydown={onKeydown}>
	<div class="pe__toolbar" role="toolbar" aria-label="Page editor">
		<div class="pe__group">
			<button type="button" disabled={!canUndo(history)} onclick={doUndo}>Undo</button>
			<button type="button" disabled={!canRedo(history)} onclick={doRedo}>Redo</button>
		</div>
		<div class="pe__group" role="group" aria-label="Preview width">
			{#each VIEWS as [id, label] (id)}
				<button type="button" aria-pressed={view === id} onclick={() => (view = id)}>{label}</button
				>
			{/each}
		</div>
		<button type="button" aria-pressed={previewing} onclick={() => (previewing = !previewing)}>
			Preview
		</button>
		<span class="pe__status">
			{#if issues.length}{issues.length} to check ·
			{/if}{dirty ? 'Unsaved changes' : 'All changes saved'}
		</span>
		{#if onsave}
			<button type="button" class="pe__save" disabled={saving || !dirty} onclick={save}>
				{saving ? 'Saving…' : 'Save page'}
			</button>
		{/if}
	</div>

	<div class="pe__body">
		<details class="pe__panel pe__palette" bind:open={paletteOpen}>
			<summary>Add a block</summary>
			<p class="pe__hint">
				Press Add, or drag a block onto the page. Select a Section or Column first to add inside it.
			</p>
			<ul class="pe__blocks" use:dropzone={{ group: 'palette', board: BOARD }}>
				{#each PALETTE_TYPES as type (type)}
					<li
						use:draggable={{
							id: `new:${type}`,
							group: 'palette',
							board: BOARD,
							label: BLOCK_LIBRARY[type].label,
							onDrop: paletteDrop(type)
						}}
					>
						<button
							type="button"
							class="pe__add"
							aria-describedby="pe-about-{type}"
							onclick={() => add(type)}
						>
							<span aria-hidden="true">+</span>
							{BLOCK_LIBRARY[type].label}
						</button>
						<span class="sr-only" id="pe-about-{type}">{BLOCK_LIBRARY[type].description}</span>
						<button
							type="button"
							class="pe__grab"
							data-drag-handle
							tabindex="-1"
							aria-hidden="true"
						>
							⠿
						</button>
					</li>
				{/each}
			</ul>
		</details>

		<section class="pe__canvas" aria-label="Page">
			<div class="pe__frame-wrap" style:--frame-width={WIDTHS[view]}>
				{#if previewing}
					<div class="pe__frame"><PageRenderer document={doc} {products} /></div>
				{:else}
					<div class="nk-frame pe__frame">
						<CanvasBlocks blocks={doc.blocks} parent={null} {ctx} />
					</div>
				{/if}
			</div>
		</section>

		<aside class="pe__panel pe__inspector" aria-label="Block settings">
			{#if selected}
				<Inspector
					block={selected}
					issues={issuesById.get(selected.id) ?? []}
					onfield={field}
					onhide={(hide: Breakpoint[]) =>
						apply(setHidden(doc, selected.id, hide), undefined, `${selected.id}:hide`)}
					oncolumns={(n: number) => apply(setColumnCount(doc, selected.id, n), `Now ${n} columns.`)}
				/>
			{:else}
				<p class="pe__hint">Select a block to change its settings.</p>
				{#if issues.length}
					<h2>To check</h2>
					<ul class="pe__issues">
						{#each issues as issue, i (issue.blockId + issue.rule + i)}
							{@const block = findBlock(doc, issue.blockId)?.block}
							<li>
								<button type="button" onclick={() => void focusBlock(issue.blockId)}>
									{block ? nameOf(block) : 'Block'} — {issue.message}
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			{/if}
		</aside>
	</div>

	<div class="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</div>
</div>

<style>
	.pe {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		min-width: 0;
		color: var(--color-text);
	}
	.pe__toolbar {
		z-index: 5;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
	}
	.pe__group {
		display: inline-flex;
		gap: 0.25rem;
	}
	.pe__toolbar button,
	.pe__panel summary,
	.pe__issues button {
		min-height: 2.75rem;
		padding: 0 0.875rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-background);
		color: var(--color-text);
		font: inherit;
		cursor: pointer;
	}
	.pe__toolbar button:hover:not(:disabled) {
		background: var(--color-surface-hover);
	}
	.pe__toolbar button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.pe__toolbar button[aria-pressed='true'] {
		border-color: var(--color-primary);
		background: color-mix(in srgb, var(--color-primary) 16%, var(--color-background));
		font-weight: 700;
	}
	.pe__toolbar button:focus-visible,
	.pe__panel summary:focus-visible,
	.pe__add:focus-visible,
	.pe__issues button:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}
	.pe__status {
		margin-inline-start: auto;
		color: var(--color-text-secondary);
		font-size: 0.875rem;
		font-variant-numeric: tabular-nums;
	}
	.pe__save {
		background: var(--color-primary-solid) !important;
		border-color: var(--color-primary-solid) !important;
		color: var(--color-on-solid) !important;
		font-weight: 600;
	}

	.pe__body {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 0.75rem;
		align-items: start;
	}
	.pe__panel {
		padding: 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		min-width: 0;
	}
	.pe__panel summary {
		display: flex;
		align-items: center;
		font-weight: 600;
	}
	.pe__hint {
		margin: 0.5rem 0;
		color: var(--color-text-secondary);
		font-size: 0.875rem;
	}
	h2 {
		margin: 0.75rem 0 0.25rem;
		font-size: 0.9375rem;
	}

	.pe__blocks {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
		gap: 0.5rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.pe__blocks li {
		display: flex;
		min-width: 0;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-background);
	}
	.pe__add {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-height: 2.75rem;
		padding: 0 0.625rem;
		border: 0;
		background: transparent;
		color: var(--color-text);
		font: inherit;
		text-align: start;
		cursor: pointer;
	}
	.pe__grab {
		min-width: 2.25rem;
		border: 0;
		border-inline-start: 1px solid var(--color-border);
		background: transparent;
		color: var(--color-text-secondary);
		cursor: grab;
		touch-action: none;
	}

	.pe__canvas {
		min-width: 0;
	}
	.pe__frame-wrap {
		width: 100%;
		max-width: var(--frame-width);
		margin-inline: auto;
		transition: max-width 0.2s ease;
	}
	.pe__frame {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-background);
		overflow: clip;
	}
	@media (prefers-reduced-motion: reduce) {
		.pe__frame-wrap {
			transition: none;
		}
	}

	.pe__issues {
		display: grid;
		gap: 0.25rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.pe__issues button {
		width: 100%;
		min-height: 2.75rem;
		padding: 0.25rem 0.625rem;
		text-align: start;
		font-size: 0.875rem;
	}

	/* "Wide" is the editor's own width, not the window's: it may sit in a narrow column. */
	.pe--wide {
		.pe__toolbar {
			position: sticky;
			top: 0;
		}
		.pe__body {
			grid-template-columns: 14rem minmax(0, 1fr) 18rem;
		}
		.pe__panel {
			position: sticky;
			top: 4.5rem;
			max-height: calc(100vh - 6rem);
			overflow-y: auto;
		}
		.pe__blocks {
			grid-template-columns: minmax(0, 1fr);
		}
		/* The palette is always open on a wide screen, so its toggle is just a title. */
		.pe__palette summary {
			border: 0;
			background: transparent;
			padding: 0;
			cursor: default;
		}
	}

	@media (forced-colors: active) {
		.pe__toolbar button[aria-pressed='true'] {
			outline: 2px solid Highlight;
		}
	}
</style>
