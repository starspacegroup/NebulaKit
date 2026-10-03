<!--
	CodeBlock — code in a <pre>, with an optional file name or language above
	it, optional line numbers (drawn by CSS, so they are never copied), and a
	copy button. Copying uses the Clipboard API and falls back to the old way
	where that is not allowed; "Copied" is announced politely. Long lines
	scroll inside the block, which takes focus so a keyboard can scroll it.

	<CodeBlock code={source} filename="src/routes/+page.svelte" lineNumbers />
-->
<script lang="ts">
	import { onDestroy } from 'svelte';
	import { codeLines, copyText } from './data-logic';

	export let code: string;
	export let filename = '';
	export let language = '';
	export let lineNumbers = false;
	/** Show the copy button. */
	export let copyable = true;

	let status: 'idle' | 'copied' | 'failed' = 'idle';
	let reset: ReturnType<typeof setTimeout> | undefined;

	$: lines = codeLines(code);
	$: heading = filename || language;
	// Focusable so a keyboard can scroll long lines (axe: scrollable-region-focusable).
	$: frame = { role: 'region', 'aria-label': heading || 'Code', tabindex: 0 };

	async function copy() {
		const ok = await copyText(code);
		status = ok ? 'copied' : 'failed';
		clearTimeout(reset);
		reset = setTimeout(() => (status = 'idle'), 2000);
	}

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
			{#if copyable}
				<button type="button" class="code__copy" on:click={copy}>
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
			>{#if lineNumbers}{#each lines as line, i (i)}<span class="code__line">{line}</span
					>{#if i < lines.length - 1}{'\n'}{/if}{/each}{:else}{code}{/if}</code
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
		overflow: hidden;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
	}

	.code__bar {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		min-height: 2.5rem;
		padding: 0 var(--spacing-xs) 0 var(--spacing-md);
		border-bottom: 1px solid var(--color-border);
		color: var(--color-text-secondary);
		font-size: 0.8125rem;
	}

	.code__name {
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
		margin-left: auto;
		padding: 0.25rem 0.625rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-background);
		color: var(--color-text);
		font: inherit;
		font-size: 0.8125rem;
		cursor: pointer;
	}

	.code__copy:hover {
		background: var(--color-surface-hover);
	}

	.code__copy:focus-visible,
	.code__pre:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: -2px;
	}

	.code__pre {
		margin: 0;
		padding: var(--spacing-md);
		overflow-x: auto;
		border: 0;
		border-radius: 0;
		background: transparent;
		color: var(--color-text);
		font-family: var(--font-mono);
		font-size: 0.875rem;
		line-height: 1.6;
		tab-size: 2;
	}

	.code__pre code {
		padding: 0;
		background: none;
		color: inherit;
		font: inherit;
	}

	.code__pre--numbered {
		counter-reset: line;
	}

	.code__line {
		counter-increment: line;
	}

	/* Generated content is not part of the text, so the numbers never get copied. */
	.code__line::before {
		content: counter(line);
		display: inline-block;
		width: 2.5ch;
		margin-right: var(--spacing-md);
		color: var(--color-text-secondary);
		text-align: right;
		opacity: 0.7;
		user-select: none;
	}
</style>
