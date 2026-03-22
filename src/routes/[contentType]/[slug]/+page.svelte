<!--
  Dynamic CMS Content Item Page

  Renders a single published content item.
  Uses the content type's itemTemplate setting for layout selection.
-->
<script lang="ts">
	import type { PageData } from './$types';
	import SharingMeta from '$lib/components/SharingMeta.svelte';

	export let data: PageData;

	$: contentType = data.contentType;
	$: item = data.item;
	$: tags = data.tags || [];

	function formatDate(dateStr: string | null): string {
		if (!dateStr) return '';
		return new Date(dateStr).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}

	function getRoutePrefix(): string {
		return contentType.settings.routePrefix || `/${contentType.slug}`;
	}
</script>

<SharingMeta
	title={item.seoTitle || item.title}
	description={item.seoDescription || ''}
	image={item.seoImage || ''}
	type="article"
	publishedTime={item.publishedAt || ''}
/>

<div class="cms-item-page">
	<!-- Back link -->
	<a href={getRoutePrefix()} class="cms-back-link">
		&larr; Back to {contentType.name}
	</a>

	<!-- Blog item template -->
	{#if contentType.settings.itemTemplate === 'blog-item'}
		<article class="cms-blog-article">
			<header class="cms-blog-article-header">
				{#if item.fields.category}
					<span class="cms-blog-article-category">{item.fields.category}</span>
				{/if}
				<h1>{item.title}</h1>
				<div class="cms-blog-article-meta">
					{#if item.publishedAt}
						<time datetime={item.publishedAt}>{formatDate(item.publishedAt)}</time>
					{/if}
					{#if item.fields.read_time}
						<span class="cms-read-time">{item.fields.read_time} min read</span>
					{/if}
				</div>
				{#if tags.length > 0}
					<div class="cms-blog-article-tags">
						{#each tags as tag}
							<a href="{getRoutePrefix()}?tag={tag.slug}" class="cms-tag">{tag.name}</a>
						{/each}
					</div>
				{/if}
			</header>

			{#if item.fields.featured_image}
				<div class="cms-blog-article-hero">
					<img src={String(item.fields.featured_image)} alt={item.title} />
				</div>
			{/if}

			{#if item.fields.excerpt}
				<div class="cms-blog-article-excerpt">
					<p>{item.fields.excerpt}</p>
				</div>
			{/if}

			<div class="cms-blog-article-body cms-content">
				{@html item.fields.body || ''}
			</div>
		</article>
	{:else}
		<!-- Default item template -->
		<article class="cms-default-article">
			<header>
				<h1>{item.title}</h1>
				{#if item.publishedAt}
					<time datetime={item.publishedAt}>{formatDate(item.publishedAt)}</time>
				{/if}
			</header>

			{#if tags.length > 0}
				<div class="cms-article-tags">
					{#each tags as tag}
						<a href="{getRoutePrefix()}?tag={tag.slug}" class="cms-tag">{tag.name}</a>
					{/each}
				</div>
			{/if}

			<!-- Render all custom fields -->
			<div class="cms-default-article-fields">
				{#each contentType.fields as fieldDef}
					{#if item.fields[fieldDef.name] !== undefined && item.fields[fieldDef.name] !== null && item.fields[fieldDef.name] !== ''}
						<div class="cms-field-block">
							{#if fieldDef.type === 'richtext'}
								<div class="cms-content">{@html item.fields[fieldDef.name]}</div>
							{:else if fieldDef.type === 'image' || fieldDef.type === 'url'}
								{#if fieldDef.type === 'image'}
									<img src={String(item.fields[fieldDef.name])} alt={fieldDef.label} />
								{:else}
									<a href={String(item.fields[fieldDef.name])} target="_blank" rel="noopener">
										{item.fields[fieldDef.name]}
									</a>
								{/if}
							{:else if fieldDef.type === 'boolean'}
								<p>
									<strong>{fieldDef.label}:</strong>
									{item.fields[fieldDef.name] ? 'Yes' : 'No'}
								</p>
							{:else}
								<p>{item.fields[fieldDef.name]}</p>
							{/if}
						</div>
					{/if}
				{/each}
			</div>
		</article>
	{/if}
</div>

<style>
	.cms-item-page {
		max-width: 780px;
		margin: 0 auto;
		padding: var(--spacing-xl) var(--spacing-md);
	}

	.cms-back-link {
		display: inline-block;
		color: var(--color-text-secondary);
		text-decoration: none;
		font-size: 0.875rem;
		margin-bottom: var(--spacing-lg);
		transition: color 0.2s ease;
	}

	.cms-back-link:hover {
		color: var(--color-primary);
	}

	/* Blog article template */
	.cms-blog-article-header {
		margin-bottom: var(--spacing-xl);
	}

	.cms-blog-article-category {
		display: inline-block;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-primary);
		margin-bottom: var(--spacing-sm);
	}

	.cms-blog-article-header h1 {
		font-size: 2.5rem;
		font-weight: 700;
		color: var(--color-text);
		line-height: 1.2;
		margin-bottom: var(--spacing-md);
	}

	.cms-blog-article-meta {
		display: flex;
		gap: var(--spacing-md);
		font-size: 0.875rem;
		color: var(--color-text-secondary);
		margin-bottom: var(--spacing-md);
	}

	.cms-read-time::before {
		content: '·';
		margin-right: var(--spacing-sm);
	}

	.cms-blog-article-tags,
	.cms-article-tags {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-xs);
	}

	.cms-tag {
		display: inline-block;
		padding: var(--spacing-xs) var(--spacing-sm);
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--color-primary);
		background-color: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		text-decoration: none;
		transition: background-color 0.2s ease;
	}

	.cms-tag:hover {
		background-color: var(--color-surface-hover);
	}

	.cms-blog-article-hero {
		margin-bottom: var(--spacing-xl);
		border-radius: var(--radius-lg);
		overflow: hidden;
	}

	.cms-blog-article-hero img {
		width: 100%;
		height: auto;
		display: block;
	}

	.cms-blog-article-excerpt {
		font-size: 1.25rem;
		line-height: 1.6;
		color: var(--color-text-secondary);
		margin-bottom: var(--spacing-xl);
		padding-bottom: var(--spacing-lg);
		border-bottom: 1px solid var(--color-border);
	}

	/* Rich text content styles */
	.cms-content {
		font-size: 1.0625rem;
		line-height: 1.8;
		color: var(--color-text);
	}

	.cms-content :global(h2) {
		font-size: 1.5rem;
		font-weight: 600;
		margin-top: var(--spacing-2xl);
		margin-bottom: var(--spacing-md);
	}

	.cms-content :global(h3) {
		font-size: 1.25rem;
		font-weight: 600;
		margin-top: var(--spacing-xl);
		margin-bottom: var(--spacing-sm);
	}

	.cms-content :global(p) {
		margin-bottom: var(--spacing-md);
	}

	.cms-content :global(a) {
		color: var(--color-primary);
		text-decoration: underline;
	}

	.cms-content :global(ul),
	.cms-content :global(ol) {
		margin-bottom: var(--spacing-md);
		padding-left: var(--spacing-xl);
	}

	.cms-content :global(li) {
		margin-bottom: var(--spacing-xs);
	}

	.cms-content :global(blockquote) {
		border-left: 3px solid var(--color-primary);
		padding-left: var(--spacing-lg);
		margin: var(--spacing-lg) 0;
		color: var(--color-text-secondary);
		font-style: italic;
	}

	.cms-content :global(code) {
		font-family: 'Fira Code', 'Consolas', monospace;
		font-size: 0.875em;
		background-color: var(--color-surface);
		padding: 0.125em 0.375em;
		border-radius: var(--radius-sm);
	}

	.cms-content :global(pre) {
		background-color: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		padding: var(--spacing-lg);
		overflow-x: auto;
		margin-bottom: var(--spacing-md);
	}

	.cms-content :global(pre code) {
		background: none;
		padding: 0;
	}

	.cms-content :global(img) {
		max-width: 100%;
		height: auto;
		border-radius: var(--radius-md);
		margin: var(--spacing-md) 0;
	}

	/* Default article template */
	.cms-default-article header {
		margin-bottom: var(--spacing-xl);
	}

	.cms-default-article h1 {
		font-size: 2rem;
		font-weight: 700;
		color: var(--color-text);
		margin-bottom: var(--spacing-sm);
	}

	.cms-default-article time {
		font-size: 0.875rem;
		color: var(--color-text-secondary);
	}

	.cms-default-article-fields {
		margin-top: var(--spacing-xl);
	}

	.cms-field-block {
		margin-bottom: var(--spacing-lg);
	}

	.cms-field-block img {
		max-width: 100%;
		height: auto;
		border-radius: var(--radius-md);
	}
</style>
