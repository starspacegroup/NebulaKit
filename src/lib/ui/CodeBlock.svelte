<!--
	CodeBlock — code in a <pre>, with an optional file name or language above
	it, optional line numbers (drawn by CSS, so they are never copied), and a
	copy button. Copying uses the Clipboard API and falls back to the old way
	where that is not allowed; "Copied" is announced politely. Long lines
	scroll inside the block, which takes focus so a keyboard can scroll it.

	<CodeBlock code={source} filename="src/routes/+page.svelte" lineNumbers />
-->
<!--
	CodeBlock — code in a <pre>, highlighted, with a slim header (a file name or language on the
	left, a copy button on the right), optional line numbers (drawn by CSS, so they are never
	copied) and long lines that scroll inside the block. The block never widens its parent.

	The highlighting comes from `tokenizeLines` (no dependency). Each token is rendered as a text
	node inside a span; nothing is inserted as raw HTML, so a sample can never inject markup. Colours are the
	--code-* tokens in app.css, checked for 4.5:1 in both themes by `validate:contrast`.

	Copying uses the Clipboard API and falls back to the old way where that is not allowed;
	"Copied" is announced politely. The copy button appears once the page is interactive, so
	without script nothing dead is shown. The scrolling region takes focus so a keyboard can scroll it.

	<CodeBlock code={source} filename="src/routes/+page.svelte" lineNumbers />
	Code samples use CodeBlock, never a bare <pre>.
-->
<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { tokenizeLines } from '$lib/utils/code-highlight';
	import { copyText } from './data-logic';

	export let code: string;
	export let filename = '';
	/** A language label: svelte, html, ts, js, css, json, yaml, sql, sh. Anything else is shown unhighlighted. */
	export let language = '';
	export let lineNumbers = false;
	/** Show the copy button. */
	export let copyable = true;
	/** The accessible name of the scrolling region; defaults to the file name or language. */
	export let label = '';

	let status: 'idle' | 'copied' | 'failed' = 'idle';
	let reset: ReturnType<typeof setTimeout> | undefined;
	let ready = false;

	$: lines = tokenizeLines(code, language);
	$: heading = filename || language;
	// Focusable so a keyboard can scroll long lines (axe: scrollable-region-focusable).
	$: frame = { role: 'region', 'aria-label': label || heading || 'Code', tabindex: 0 };

	async function copy() {
		const ok = await copyText(code);
		status = ok ? 'copied' : 'failed';
		clearTimeout(reset);
		reset = setTimeout(() => (status = 'idle'), 2000);
	}

	onMount(() => (ready = true));
	onDestroy(() => clearTimeout(reset));
</script>

<div class="code">
	{#if heading || copyable}
		<div class="code__bar">
			{#if heading}
				<span class="code__name">{heading}</span>
			{/if}
			{#if filename && language}
				<span class="code__lang">{language}</span>
			{/if}
			{#if copyable && ready}
				<button
					type="button"
					class="code__copy"
					class:code__copy--done={status === 'copied'}
					on:click={copy}
				>
					<svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
						{#if status === 'copied'}
							<path d="m3 8.5 3.2 3.2L13 4.8" />
						{:else}
							<rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
							<path d="M10.5 5.5v-2a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2" />
						{/if}
					</svg>
					{#if status === 'copied'}Copied{:else if status === 'failed'}Copy failed{:else}Copy<span
							class="sr-only"
						>
							code</span
						>{/if}
				</button>
			{/if}
		</div>
	{/if}
	<pre class="code__pre" class:code__pre--numbered={lineNumbers} {...frame}><code
			class={language ? `language-${language}` : undefined}
			>{#each lines as line, i (i)}<span class="code__line"
					>{#each line as token}{#if token.kind === 'plain'}{token.text}{:else}<span
								class="tok tok-{token.kind}">{token.text}</span
							>{/if}{/each}</span
				>{#if i < lines.length - 1}{'\n'}{/if}{/each}</code
		></pre>
	<span class="sr-only" aria-live="polite"
		>{status === 'copied'
			? 'Copied to clipboard'
			: status === 'failed'
				? 'Could not copy'
				: ''}</span
	>
</div>

<style>
	.code {
		min-width: 0;
		max-width: 100%;
		overflow: hidden;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		box-shadow: var(--shadow-sm);
	}

	.code__bar {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		min-height: 2.75rem;
		padding: 0 var(--spacing-sm) 0 var(--spacing-md);
		border-bottom: 1px solid var(--color-border);
		color: var(--color-text-secondary);
		font-size: 0.8125rem;
	}

	.code__name {
		min-width: 0;
		overflow: hidden;
		color: var(--color-text);
		font-family: var(--font-mono);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.code__lang {
		padding: 0 0.375rem;
		border-radius: var(--radius-sm);
		background: var(--color-surface-hover);
		font-size: 0.75rem;
		text-transform: lowercase;
	}

	.code__copy {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		min-height: 2rem;
		margin-left: auto;
		padding: 0.25rem 0.625rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-background);
		color: var(--color-text);
		font: inherit;
		font-size: 0.8125rem;
		cursor: pointer;
		transition:
			background var(--transition-fast),
			border-color var(--transition-fast);
	}

	.code__copy svg {
		flex: none;
		stroke: currentColor;
		stroke-width: 1.5;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.code__copy:hover {
		background: var(--color-surface-hover);
	}

	.code__copy--done {
		border-color: var(--color-success);
		color: var(--color-success);
	}

	.code__copy:focus-visible,
	.code__pre:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: -2px;
	}

	.code__pre {
		display: block;
		margin: 0;
		padding: var(--spacing-md);
		overflow-x: auto;
		border: 0;
		border-radius: 0;
		/* Scroll shadows: an edge darkens only while there is more to scroll to that side. */
		background:
			linear-gradient(to right, var(--color-surface) 30%, transparent) left center / 2rem 100%
				no-repeat local,
			linear-gradient(to left, var(--color-surface) 30%, transparent) right center / 2rem 100%
				no-repeat local,
			linear-gradient(to right, color-mix(in srgb, var(--color-text) 14%, transparent), transparent)
				left center / 0.75rem 100% no-repeat scroll,
			linear-gradient(to left, color-mix(in srgb, var(--color-text) 14%, transparent), transparent)
				right center / 0.75rem 100% no-repeat scroll,
			var(--color-surface);
		color: var(--color-text);
		font-family: var(--font-mono);
		font-size: 0.875rem;
		font-variant-numeric: tabular-nums;
		line-height: 1.6;
		tab-size: 2;
		white-space: pre;
		scrollbar-color: var(--color-border) transparent;
		scrollbar-width: thin;
	}

	.code__pre::-webkit-scrollbar {
		height: 0.5rem;
	}

	.code__pre::-webkit-scrollbar-thumb {
		border-radius: var(--radius-sm);
		background: var(--color-border);
	}

	.code__pre code {
		padding: 0;
		background: none;
		color: inherit;
		font: inherit;
	}

	.code__pre :global(.tok-keyword) {
		color: var(--code-keyword);
	}

	.code__pre :global(.tok-string) {
		color: var(--code-string);
	}

	.code__pre :global(.tok-comment) {
		color: var(--code-comment);
		font-style: italic;
	}

	.code__pre :global(.tok-number) {
		color: var(--code-number);
	}

	.code__pre :global(.tok-tag) {
		color: var(--code-tag);
	}

	.code__pre :global(.tok-attr) {
		color: var(--code-attr);
	}

	.code__pre :global(.tok-function) {
		color: var(--code-function);
	}

	.code__pre :global(.tok-variable) {
		color: var(--code-variable);
	}

	.code__pre :global(.tok-punct) {
		color: var(--code-punct);
	}

	.code__pre--numbered {
		counter-reset: line;
	}

	.code__line {
		counter-increment: line;
	}

	/* Generated content is not part of the text, so the numbers never get copied. */
	.code__pre--numbered .code__line::before {
		content: counter(line);
		display: inline-block;
		width: 2.5ch;
		margin-right: var(--spacing-md);
		color: var(--color-text-secondary);
		text-align: right;
		user-select: none;
	}
</style>
