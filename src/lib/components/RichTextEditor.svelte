<!--
  RichTextEditor — TipTap-based WYSIWYG for CMS richtext fields.

  Two-way binds an HTML string (bind:value), following the TaskListField
  custom-field pattern. The TipTap Editor is constructed client-side only
  (onMount) — during SSR the component renders an empty shell.
-->
<script lang="ts">
	import { embedManifest, getEmbedDefinition } from '$lib/cms/embeds/manifest';
	import {
		buildFormModel,
		coerceProps,
		validateProps,
		type EmbedPropsSchema
	} from '$lib/cms/embeds/props-schema';
	import { SvelteEmbed } from '$lib/cms/richtext-embed-extension';
	import { extractImageFiles, uploadImage } from '$lib/cms/richtext-utils';
	import { Editor } from '@tiptap/core';
	import Image from '@tiptap/extension-image';
	import Link from '@tiptap/extension-link';
	import Placeholder from '@tiptap/extension-placeholder';
	import StarterKit from '@tiptap/starter-kit';
	import { onDestroy, onMount } from 'svelte';

	export let value = '';
	export let placeholder = 'Write something…';
	/** Show the Svelte-embed toolbar button (on for CMS content) */
	export let allowEmbeds = true;

	let element: HTMLDivElement;
	let editor: Editor | null = null;

	// bumped on every transaction so toolbar active-states stay reactive
	let tick = 0;
	// guards against value-loop: editor onUpdate -> value -> setContent
	let internalUpdate = false;

	// source view
	let sourceMode = false;

	// link popover
	let showLinkInput = false;
	let linkUrl = '';
	let linkInputEl: HTMLInputElement | null = null;

	// embed picker + props editor
	let showEmbedPicker = false;
	let showPropsEditor = false;
	let propsJson = '';
	let propsError = '';
	let propsSetter: ((p: Record<string, unknown>) => void) | null = null;
	// When the embed declares a typed schema we render a form instead of raw JSON.
	let propsSchema: EmbedPropsSchema | null = null;
	// Transient form state for the props editor; bound to typed inputs.
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let propsModel: Record<string, any> = {};

	function openPropsEditor(
		embedName: string,
		getProps: () => Record<string, unknown>,
		setProps: (p: Record<string, unknown>) => void
	) {
		const definition = getEmbedDefinition(embedName);
		propsSetter = setProps;
		propsError = '';
		if (definition?.props && definition.props.length > 0) {
			propsSchema = definition.props;
			propsModel = buildFormModel(definition.props, getProps());
		} else {
			propsSchema = null;
			propsJson = JSON.stringify(getProps(), null, 2);
		}
		showPropsEditor = true;
	}

	function closePropsEditor() {
		showPropsEditor = false;
		propsSetter = null;
		propsSchema = null;
	}

	function applyProps() {
		if (propsSchema) {
			const coerced = coerceProps(propsSchema, propsModel);
			const errors = validateProps(propsSchema, coerced);
			if (errors.length > 0) {
				propsError = errors.join(', ');
				return;
			}
			propsSetter?.(coerced);
			closePropsEditor();
			return;
		}
		try {
			const parsed = JSON.parse(propsJson || '{}');
			if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
				propsError = 'Props must be a JSON object';
				return;
			}
			propsSetter?.(parsed);
			closePropsEditor();
		} catch {
			propsError = 'Invalid JSON';
		}
	}

	function insertEmbed(name: string, defaultProps: Record<string, unknown>) {
		editor?.chain().focus().insertSvelteEmbed(name, defaultProps).run();
		showEmbedPicker = false;
	}

	// image upload
	let fileInput: HTMLInputElement | null = null;
	let uploading = false;
	let uploadError = '';

	async function uploadAndInsert(files: File[]) {
		if (!files.length || !editor) return;
		uploading = true;
		uploadError = '';
		for (const file of files) {
			const result = await uploadImage(file);
			if (result.ok) {
				editor.chain().focus().setImage({ src: result.url, alt: file.name }).run();
			} else {
				uploadError = result.error;
			}
		}
		uploading = false;
	}

	function handleFilePick(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		uploadAndInsert(extractImageFiles({ files: input.files ?? [] }));
		input.value = '';
	}

	function handleEditorDrop(event: DragEvent) {
		const images = extractImageFiles(event.dataTransfer);
		if (images.length) {
			event.preventDefault();
			uploadAndInsert(images);
		}
	}

	function handleEditorPaste(event: ClipboardEvent) {
		const images = extractImageFiles(event.clipboardData);
		if (images.length) {
			event.preventDefault();
			uploadAndInsert(images);
		}
	}

	onMount(() => {
		editor = new Editor({
			element,
			extensions: [
				StarterKit.configure({
					heading: { levels: [2, 3, 4] }
				}),
				Link.configure({
					openOnClick: false,
					autolink: true,
					HTMLAttributes: { rel: 'noopener noreferrer' }
				}),
				Image,
				Placeholder.configure({ placeholder }),
				SvelteEmbed.configure({ onEditProps: openPropsEditor })
			],
			content: value || '',
			onUpdate: ({ editor: e }) => {
				internalUpdate = true;
				value = e.getHTML();
			},
			onTransaction: () => {
				tick += 1;
			}
		});
	});

	onDestroy(() => {
		editor?.destroy();
		editor = null;
	});

	// External value changes (e.g. source-mode edits, parent resets) flow in;
	// internal updates are skipped to avoid cursor-destroying setContent calls.
	$: if (editor && !sourceMode) {
		if (internalUpdate) {
			internalUpdate = false;
		} else if (value !== editor.getHTML()) {
			editor.commands.setContent(value || '', false);
		}
	}

	$: active = (name: string, attrs?: Record<string, unknown>) =>
		tick >= 0 && editor ? editor.isActive(name, attrs) : false;

	function cmd(fn: (chain: ReturnType<Editor['chain']>) => { run: () => boolean }) {
		if (!editor) return;
		fn(editor.chain().focus());
	}

	function toggleSource() {
		if (sourceMode) {
			// leaving source view — push edited HTML back into the editor
			sourceMode = false;
			editor?.commands.setContent(value || '', false);
		} else {
			sourceMode = true;
		}
	}

	function openLinkInput() {
		if (!editor) return;
		linkUrl = editor.getAttributes('link').href || '';
		showLinkInput = true;
		setTimeout(() => linkInputEl?.focus(), 0);
	}

	function applyLink() {
		if (!editor) return;
		const url = linkUrl.trim();
		if (url) {
			editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
		} else {
			editor.chain().focus().extendMarkRange('link').unsetLink().run();
		}
		showLinkInput = false;
		linkUrl = '';
	}

	function cancelLink() {
		showLinkInput = false;
		linkUrl = '';
	}
</script>

<div class="rte" class:rte-source={sourceMode}>
	<div class="rte-toolbar" role="toolbar" aria-label="Text formatting">
		<div class="rte-group">
			<button
				type="button"
				class="rte-btn"
				class:rte-active={active('paragraph') &&
					!active('bulletList') &&
					!active('orderedList') &&
					!active('blockquote')}
				title="Paragraph"
				aria-label="Paragraph"
				disabled={sourceMode}
				on:click={() => cmd((c) => c.setParagraph())}>¶</button
			>
			<button
				type="button"
				class="rte-btn"
				class:rte-active={active('heading', { level: 2 })}
				title="Heading 2"
				aria-label="Heading 2"
				disabled={sourceMode}
				on:click={() => cmd((c) => c.toggleHeading({ level: 2 }))}>H2</button
			>
			<button
				type="button"
				class="rte-btn"
				class:rte-active={active('heading', { level: 3 })}
				title="Heading 3"
				aria-label="Heading 3"
				disabled={sourceMode}
				on:click={() => cmd((c) => c.toggleHeading({ level: 3 }))}>H3</button
			>
		</div>

		<div class="rte-group">
			<button
				type="button"
				class="rte-btn rte-b"
				class:rte-active={active('bold')}
				title="Bold (Ctrl+B)"
				aria-label="Bold"
				disabled={sourceMode}
				on:click={() => cmd((c) => c.toggleBold())}>B</button
			>
			<button
				type="button"
				class="rte-btn rte-i"
				class:rte-active={active('italic')}
				title="Italic (Ctrl+I)"
				aria-label="Italic"
				disabled={sourceMode}
				on:click={() => cmd((c) => c.toggleItalic())}>I</button
			>
			<button
				type="button"
				class="rte-btn rte-s"
				class:rte-active={active('strike')}
				title="Strikethrough"
				aria-label="Strikethrough"
				disabled={sourceMode}
				on:click={() => cmd((c) => c.toggleStrike())}>S</button
			>
			<button
				type="button"
				class="rte-btn rte-code"
				class:rte-active={active('code')}
				title="Inline code"
				aria-label="Inline code"
				disabled={sourceMode}
				on:click={() => cmd((c) => c.toggleCode())}>&lt;&gt;</button
			>
			<button
				type="button"
				class="rte-btn"
				class:rte-active={active('link')}
				title="Link"
				aria-label="Link"
				disabled={sourceMode}
				on:click={openLinkInput}>🔗</button
			>
		</div>

		<div class="rte-group">
			<button
				type="button"
				class="rte-btn"
				class:rte-active={active('bulletList')}
				title="Bullet list"
				aria-label="Bullet list"
				disabled={sourceMode}
				on:click={() => cmd((c) => c.toggleBulletList())}>••</button
			>
			<button
				type="button"
				class="rte-btn"
				class:rte-active={active('orderedList')}
				title="Numbered list"
				aria-label="Numbered list"
				disabled={sourceMode}
				on:click={() => cmd((c) => c.toggleOrderedList())}>1.</button
			>
			<button
				type="button"
				class="rte-btn"
				class:rte-active={active('blockquote')}
				title="Blockquote"
				aria-label="Blockquote"
				disabled={sourceMode}
				on:click={() => cmd((c) => c.toggleBlockquote())}>❝</button
			>
			<button
				type="button"
				class="rte-btn"
				class:rte-active={active('codeBlock')}
				title="Code block"
				aria-label="Code block"
				disabled={sourceMode}
				on:click={() => cmd((c) => c.toggleCodeBlock())}>{'{ }'}</button
			>
			<button
				type="button"
				class="rte-btn"
				title="Horizontal rule"
				aria-label="Horizontal rule"
				disabled={sourceMode}
				on:click={() => cmd((c) => c.setHorizontalRule())}>—</button
			>
			<button
				type="button"
				class="rte-btn"
				title="Insert image (or drag & drop / paste)"
				aria-label="Insert image"
				disabled={sourceMode || uploading}
				on:click={() => fileInput?.click()}>🖼</button
			>
			{#if allowEmbeds}
				<button
					type="button"
					class="rte-btn"
					title="Insert Svelte embed"
					aria-label="Insert Svelte embed"
					disabled={sourceMode}
					on:click={() => (showEmbedPicker = true)}>⧉</button
				>
			{/if}
			{#if uploading}
				<span class="rte-uploading" role="status">Uploading…</span>
			{/if}
		</div>

		<slot name="toolbar-extra" {editor} {sourceMode} />

		<div class="rte-group rte-group-end">
			<button
				type="button"
				class="rte-btn"
				title="Undo (Ctrl+Z)"
				aria-label="Undo"
				disabled={sourceMode}
				on:click={() => cmd((c) => c.undo())}>↶</button
			>
			<button
				type="button"
				class="rte-btn"
				title="Redo (Ctrl+Shift+Z)"
				aria-label="Redo"
				disabled={sourceMode}
				on:click={() => cmd((c) => c.redo())}>↷</button
			>
			<button
				type="button"
				class="rte-btn rte-html"
				class:rte-active={sourceMode}
				title="Edit HTML source"
				aria-label="Edit HTML source"
				on:click={toggleSource}>HTML</button
			>
		</div>
	</div>

	{#if showLinkInput}
		<div class="rte-linkbar">
			<input
				type="url"
				placeholder="https://… (empty to remove link)"
				bind:value={linkUrl}
				bind:this={linkInputEl}
				aria-label="Link URL"
				on:keydown={(e) => {
					if (e.key === 'Enter') {
						e.preventDefault();
						applyLink();
					}
					if (e.key === 'Escape') cancelLink();
				}}
			/>
			<button type="button" class="rte-btn" on:click={applyLink}>Apply</button>
			<button type="button" class="rte-btn" on:click={cancelLink}>Cancel</button>
		</div>
	{/if}

	{#if uploadError}
		<p class="rte-upload-error" role="alert">{uploadError}</p>
	{/if}

	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div
		class="rte-editor"
		class:rte-hidden={sourceMode}
		bind:this={element}
		on:drop={handleEditorDrop}
		on:paste={handleEditorPaste}
	></div>

	<input
		type="file"
		accept="image/png,image/jpeg,image/gif,image/webp"
		multiple
		class="rte-file-input"
		bind:this={fileInput}
		on:change={handleFilePick}
		aria-label="Upload image file"
	/>

	{#if sourceMode}
		<textarea
			class="rte-source-area"
			bind:value
			rows="14"
			aria-label="HTML source"
			spellcheck="false"
		></textarea>
	{/if}
</div>

{#if showEmbedPicker}
	<div
		class="rte-modal-overlay"
		on:click|self={() => (showEmbedPicker = false)}
		on:keydown={(e) => e.key === 'Escape' && (showEmbedPicker = false)}
		role="presentation"
	>
		<div class="rte-modal" role="dialog" aria-modal="true" aria-label="Insert embed">
			<h3>Insert Svelte embed</h3>
			<ul class="rte-embed-list">
				{#each embedManifest as embed (embed.name)}
					<li>
						<button
							type="button"
							class="rte-embed-option"
							on:click={() => insertEmbed(embed.name, embed.defaultProps)}
						>
							<strong>{embed.label}</strong>
							<span>{embed.description}</span>
						</button>
					</li>
				{/each}
			</ul>
			<div class="rte-modal-actions">
				<button type="button" class="rte-btn" on:click={() => (showEmbedPicker = false)}>
					Cancel
				</button>
			</div>
		</div>
	</div>
{/if}

{#if showPropsEditor}
	<div
		class="rte-modal-overlay"
		on:click|self={closePropsEditor}
		on:keydown={(e) => e.key === 'Escape' && closePropsEditor()}
		role="presentation"
	>
		<div class="rte-modal" role="dialog" aria-modal="true" aria-label="Edit embed props">
			<h3>Embed props</h3>
			{#if propsSchema}
				<div class="rte-props-form">
					{#each propsSchema as field (field.key)}
						<label class="rte-props-field">
							<span class="rte-props-label">{field.label}</span>
							{#if field.type === 'select'}
								<select bind:value={propsModel[field.key]}>
									{#each field.options || [] as opt (opt.value)}
										<option value={opt.value}>{opt.label}</option>
									{/each}
								</select>
							{:else if field.type === 'boolean'}
								<input type="checkbox" bind:checked={propsModel[field.key]} />
							{:else if field.type === 'number'}
								<input type="number" bind:value={propsModel[field.key]} />
							{:else}
								<input
									type="text"
									bind:value={propsModel[field.key]}
									placeholder={field.placeholder || ''}
								/>
							{/if}
							{#if field.helpText}
								<span class="rte-props-help">{field.helpText}</span>
							{/if}
						</label>
					{/each}
				</div>
			{:else}
				<textarea
					class="rte-props-area"
					bind:value={propsJson}
					rows="8"
					aria-label="Embed props JSON"
					spellcheck="false"
				></textarea>
			{/if}
			{#if propsError}
				<p class="rte-props-error" role="alert">{propsError}</p>
			{/if}
			<div class="rte-modal-actions">
				<button type="button" class="rte-btn" on:click={closePropsEditor}> Cancel </button>
				<button type="button" class="rte-btn rte-active" on:click={applyProps}>Apply</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.rte {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-background);
		overflow: hidden;
	}

	.rte-toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.25rem;
		padding: 0.375rem;
		border-bottom: 1px solid var(--color-border);
		background: var(--color-surface);
	}

	.rte-group {
		display: flex;
		gap: 0.125rem;
		padding: 0 0.25rem;
		border-right: 1px solid var(--color-border);
	}

	.rte-group:last-child,
	.rte-group-end {
		border-right: none;
	}

	.rte-group-end {
		margin-left: auto;
	}

	.rte-btn {
		min-width: 1.9rem;
		height: 1.9rem;
		padding: 0 0.4rem;
		background: none;
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		color: var(--color-text-secondary);
		font-size: 0.8125rem;
		line-height: 1;
		cursor: pointer;
	}

	.rte-btn:hover:not(:disabled) {
		background: var(--color-surface-hover, rgba(128, 128, 128, 0.15));
		color: var(--color-text);
	}

	.rte-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.rte-active {
		background: var(--color-primary);
		color: white;
	}

	.rte-active:hover:not(:disabled) {
		background: var(--color-primary);
		color: white;
	}

	.rte-b {
		font-weight: 700;
	}

	.rte-i {
		font-style: italic;
	}

	.rte-s {
		text-decoration: line-through;
	}

	.rte-code,
	.rte-html {
		font-family: var(--font-mono);
		font-size: 0.6875rem;
	}

	.rte-linkbar {
		display: flex;
		gap: 0.375rem;
		padding: 0.375rem;
		border-bottom: 1px solid var(--color-border);
		background: var(--color-surface);
	}

	.rte-linkbar input {
		flex: 1;
		padding: 0.25rem 0.5rem;
		background: var(--color-background);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		color: var(--color-text);
		font-size: 0.8125rem;
	}

	.rte-uploading {
		font-size: 0.75rem;
		color: var(--color-text-secondary);
		align-self: center;
		padding: 0 0.375rem;
	}

	.rte-upload-error {
		color: var(--color-danger, #ef4444);
		font-size: 0.8125rem;
		padding: 0.375rem 0.75rem;
		border-bottom: 1px solid var(--color-border);
		margin: 0;
	}

	.rte-file-input {
		display: none;
	}

	.rte-editor {
		min-height: 16rem;
	}

	.rte-hidden {
		display: none;
	}

	/* ProseMirror content styling */
	.rte-editor :global(.ProseMirror) {
		min-height: 16rem;
		padding: 0.75rem 1rem;
		outline: none;
		color: var(--color-text);
		font-size: 0.9375rem;
		line-height: 1.7;
	}

	.rte-editor :global(.ProseMirror p) {
		margin: 0 0 0.75em;
	}

	.rte-editor :global(.ProseMirror h2),
	.rte-editor :global(.ProseMirror h3),
	.rte-editor :global(.ProseMirror h4) {
		margin: 1.25em 0 0.5em;
		line-height: 1.3;
	}

	.rte-editor :global(.ProseMirror ul),
	.rte-editor :global(.ProseMirror ol) {
		padding-left: 1.5rem;
		margin: 0 0 0.75em;
	}

	.rte-editor :global(.ProseMirror blockquote) {
		border-left: 3px solid var(--color-border);
		padding-left: 1rem;
		margin: 0 0 0.75em;
		color: var(--color-text-secondary);
	}

	.rte-editor :global(.ProseMirror pre) {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		padding: 0.75rem;
		font-family: var(--font-mono);
		font-size: 0.8125rem;
		overflow-x: auto;
		margin: 0 0 0.75em;
	}

	.rte-editor :global(.ProseMirror code) {
		background: var(--color-surface);
		border-radius: 3px;
		padding: 0.1em 0.3em;
		font-family: var(--font-mono);
		font-size: 0.85em;
	}

	.rte-editor :global(.ProseMirror pre code) {
		background: none;
		padding: 0;
	}

	.rte-editor :global(.ProseMirror img) {
		max-width: 100%;
		height: auto;
		border-radius: var(--radius-sm);
	}

	.rte-editor :global(.ProseMirror a) {
		color: var(--color-primary);
	}

	.rte-editor :global(.ProseMirror hr) {
		border: none;
		border-top: 1px solid var(--color-border);
		margin: 1.5em 0;
	}

	.rte-editor :global(.ProseMirror p.is-editor-empty:first-child::before) {
		content: attr(data-placeholder);
		float: left;
		color: var(--color-text-secondary);
		opacity: 0.5;
		pointer-events: none;
		height: 0;
	}

	.rte-source-area {
		width: 100%;
		border: none;
		background: var(--color-background);
		color: var(--color-text);
		font-family: var(--font-mono);
		font-size: 0.8125rem;
		line-height: 1.6;
		padding: 0.75rem 1rem;
		resize: vertical;
		outline: none;
	}

	/* Embed placeholder cards (nodeview DOM is unscoped) */
	.rte-editor :global(.rte-embed-card) {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.75rem;
		border: 1px dashed var(--color-primary);
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--color-primary) 6%, var(--color-background));
		padding: 0.6rem 0.75rem;
		margin: 0.75em 0;
	}

	.rte-editor :global(.rte-embed-info) {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		font-size: 0.8125rem;
	}

	.rte-editor :global(.rte-embed-chip) {
		font-family: var(--font-mono);
		font-size: 0.6875rem;
		color: var(--color-text-secondary);
	}

	.rte-editor :global(.rte-embed-desc) {
		color: var(--color-text-secondary);
		font-size: 0.75rem;
	}

	.rte-editor :global(.rte-embed-actions) {
		display: flex;
		gap: 0.375rem;
		flex: none;
	}

	.rte-editor :global(.rte-embed-actions button) {
		background: none;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		color: var(--color-text-secondary);
		font-size: 0.75rem;
		padding: 0.2rem 0.5rem;
		cursor: pointer;
	}

	.rte-editor :global(.rte-embed-actions button:hover) {
		color: var(--color-text);
		background: var(--color-surface-hover, rgba(128, 128, 128, 0.15));
	}

	/* Modals */
	.rte-modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 200;
		padding: 1rem;
	}

	.rte-modal {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		width: 100%;
		max-width: 460px;
		padding: 1rem;
	}

	.rte-modal h3 {
		font-size: 0.9375rem;
		margin-bottom: 0.75rem;
		color: var(--color-text);
	}

	.rte-embed-list {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		margin: 0 0 0.75rem;
		padding: 0;
		max-height: 320px;
		overflow-y: auto;
	}

	.rte-embed-option {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		text-align: left;
		background: var(--color-background);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		padding: 0.5rem 0.75rem;
		color: var(--color-text);
		cursor: pointer;
		font-size: 0.8125rem;
	}

	.rte-embed-option span {
		color: var(--color-text-secondary);
		font-size: 0.75rem;
	}

	.rte-embed-option:hover {
		border-color: var(--color-primary);
	}

	.rte-props-area {
		width: 100%;
		background: var(--color-background);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		color: var(--color-text);
		font-family: var(--font-mono);
		font-size: 0.8125rem;
		padding: 0.5rem 0.75rem;
		resize: vertical;
	}

	.rte-props-error {
		color: var(--color-danger, #ef4444);
		font-size: 0.8125rem;
		margin-top: 0.375rem;
	}

	.rte-props-form {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.rte-props-field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.rte-props-label {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--color-text);
	}

	.rte-props-field input[type='text'],
	.rte-props-field input[type='number'],
	.rte-props-field select {
		width: 100%;
		background: var(--color-background);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		color: var(--color-text);
		font-size: 0.875rem;
		padding: 0.5rem 0.75rem;
	}

	.rte-props-field input[type='checkbox'] {
		align-self: flex-start;
	}

	.rte-props-help {
		font-size: 0.75rem;
		color: var(--color-text-secondary);
	}

	.rte-modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.375rem;
		margin-top: 0.75rem;
	}
</style>
