<!--
	Prose — sets long-form HTML you did not mark up yourself (a CMS body,
	rendered Markdown) on the kit's type scale: headings, paragraphs, lists,
	quotes, code, tables, rules and links. Put the HTML in the slot.

	<Prose size="lg">{@html post.html}</Prose>
-->
<script lang="ts">
	export let size: 'sm' | 'md' | 'lg' = 'md';
</script>

<div class="prose prose--{size}">
	<slot />
</div>

<style>
	.prose {
		max-width: 70ch;
		min-width: 0;
		color: var(--color-text);
		font-size: 1rem;
		line-height: 1.7;
		overflow-wrap: break-word;
	}

	.prose--sm {
		font-size: 0.875rem;
	}

	.prose--lg {
		font-size: 1.125rem;
	}

	.prose > :global(:first-child) {
		margin-top: 0;
	}

	.prose > :global(:last-child) {
		margin-bottom: 0;
	}

	.prose :global(p),
	.prose :global(ul),
	.prose :global(ol),
	.prose :global(blockquote),
	.prose :global(pre),
	.prose :global(table),
	.prose :global(figure) {
		margin: 0 0 1.25em;
	}

	.prose :global(h1),
	.prose :global(h2),
	.prose :global(h3),
	.prose :global(h4) {
		margin: 1.75em 0 0.6em;
		color: var(--color-text);
		font-weight: 700;
		line-height: 1.25;
	}

	.prose :global(h1) {
		font-size: 2em;
	}

	.prose :global(h2) {
		padding-bottom: 0.3em;
		border-bottom: 1px solid var(--color-border);
		font-size: 1.5em;
	}

	.prose :global(h3) {
		font-size: 1.25em;
	}

	.prose :global(h4) {
		font-size: 1em;
	}

	.prose :global(a) {
		color: var(--color-primary);
		text-decoration: underline;
		text-decoration-thickness: 1px;
		text-underline-offset: 0.2em;
	}

	.prose :global(a:hover) {
		color: var(--color-primary-hover);
		text-decoration-thickness: 2px;
	}

	.prose :global(a:focus-visible) {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
		border-radius: 2px;
	}

	.prose :global(strong) {
		font-weight: 700;
	}

	.prose :global(ul),
	.prose :global(ol) {
		padding-left: 1.5em;
	}

	.prose :global(li) {
		margin: 0.35em 0;
	}

	.prose :global(li::marker) {
		color: var(--color-text-secondary);
	}

	.prose :global(blockquote) {
		padding: 0.25em 0 0.25em 1em;
		border-left: 3px solid var(--color-primary);
		color: var(--color-text-secondary);
		font-style: italic;
	}

	.prose :global(code) {
		padding: 0.125em 0.375em;
		border-radius: var(--radius-sm);
		background: var(--color-surface);
		font-family: var(--font-mono);
		font-size: 0.875em;
	}

	.prose :global(pre) {
		padding: var(--spacing-md);
		overflow-x: auto;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		line-height: 1.55;
	}

	.prose :global(pre code) {
		padding: 0;
		background: none;
		font-size: 0.875em;
	}

	.prose :global(table) {
		display: block;
		width: max-content;
		max-width: 100%;
		overflow-x: auto;
		border-collapse: collapse;
		font-size: 0.9375em;
	}

	.prose :global(th),
	.prose :global(td) {
		padding: 0.5em 0.75em;
		border: 1px solid var(--color-border);
		text-align: left;
	}

	.prose :global(th) {
		background: var(--color-surface);
		font-weight: 700;
	}

	.prose :global(hr) {
		margin: 2em 0;
		border: 0;
		border-top: 1px solid var(--color-border);
	}

	.prose :global(img) {
		max-width: 100%;
		height: auto;
		border-radius: var(--radius-md);
	}

	.prose :global(figcaption) {
		margin-top: 0.5em;
		color: var(--color-text-secondary);
		font-size: 0.875em;
	}
</style>
