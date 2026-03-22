<!--
  Dynamic CMS Content Type List Page

  Renders a list of published content items for any registered content type.
  Uses the content type's listTemplate setting for layout selection.
-->
<script lang="ts">
	import type { PageData } from './$types';
	import SharingMeta from '$lib/components/SharingMeta.svelte';

	export let data: PageData;

	$: contentType = data.contentType;
	$: items = data.items || [];
	$: totalPages = data.totalPages || 1;
	$: currentPage = data.page || 1;

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
	title={contentType.name}
	description={contentType.description || ''}
/>

<div class="cms-list-page">
	<header class="cms-list-header">
		<h1>{contentType.name}</h1>
		{#if contentType.description}
			<p class="cms-list-description">{contentType.description}</p>
		{/if}
	</header>

	{#if items.length === 0}
		<div class="cms-empty-state">
			<p>No content available yet.</p>
		</div>
	{:else}
		<!-- Blog-style list template -->
		{#if contentType.settings.listTemplate === 'blog-list'}
			<div class="cms-blog-grid">
				{#each items as item}
					<article class="cms-blog-card">
						{#if item.fields.featured_image}
							<div class="cms-blog-card-image">
								<img src={String(item.fields.featured_image)} alt={item.title} loading="lazy" />
							</div>
						{/if}
						<div class="cms-blog-card-content">
							{#if item.fields.category}
								<span class="cms-blog-category">{item.fields.category}</span>
							{/if}
							<h2>
								<a href="{getRoutePrefix()}/{item.slug}">{item.title}</a>
							</h2>
							{#if item.fields.excerpt}
								<p class="cms-blog-excerpt">{item.fields.excerpt}</p>
							{/if}
							<div class="cms-blog-meta">
								{#if item.publishedAt}
									<time datetime={item.publishedAt}>{formatDate(item.publishedAt)}</time>
								{/if}
								{#if item.fields.read_time}
									<span class="cms-blog-read-time">{item.fields.read_time} min read</span>
								{/if}
							</div>
						</div>
					</article>
				{/each}
			</div>
		{:else}
			<!-- Default list template -->
			<div class="cms-default-list">
				{#each items as item}
					<article class="cms-default-item">
						<h2>
							<a href="{getRoutePrefix()}/{item.slug}">{item.title}</a>
						</h2>
						{#if item.seoDescription}
							<p>{item.seoDescription}</p>
						{/if}
						{#if item.publishedAt}
							<time datetime={item.publishedAt}>{formatDate(item.publishedAt)}</time>
						{/if}
					</article>
				{/each}
			</div>
		{/if}

		<!-- Pagination -->
		{#if totalPages > 1}
			<nav class="cms-pagination" aria-label="Pagination">
				{#if currentPage > 1}
					<a href="?page={currentPage - 1}" class="cms-pagination-link" aria-label="Previous page">
						&larr; Previous
					</a>
				{/if}
				<span class="cms-pagination-info">
					Page {currentPage} of {totalPages}
				</span>
				{#if currentPage < totalPages}
					<a href="?page={currentPage + 1}" class="cms-pagination-link" aria-label="Next page">
						Next &rarr;
					</a>
				{/if}
			</nav>
		{/if}
	{/if}
</div>

<style>
	.cms-list-page {
		max-width: 900px;
		margin: 0 auto;
		padding: var(--spacing-xl) var(--spacing-md);
	}

	.cms-list-header {
		margin-bottom: var(--spacing-2xl);
		text-align: center;
	}

	.cms-list-header h1 {
		font-size: 2.5rem;
		font-weight: 700;
		color: var(--color-text);
		margin-bottom: var(--spacing-sm);
	}

	.cms-list-description {
		color: var(--color-text-secondary);
		font-size: 1.125rem;
	}

	.cms-empty-state {
		text-align: center;
		padding: var(--spacing-2xl);
		color: var(--color-text-secondary);
	}

	/* Blog grid template */
	.cms-blog-grid {
		display: grid;
		gap: var(--spacing-xl);
	}

	.cms-blog-card {
		display: flex;
		flex-direction: column;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		overflow: hidden;
		background: var(--color-surface);
		transition: box-shadow 0.2s ease;
	}

	.cms-blog-card:hover {
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
	}

	.cms-blog-card-image {
		aspect-ratio: 16 / 9;
		overflow: hidden;
	}

	.cms-blog-card-image img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.cms-blog-card-content {
		padding: var(--spacing-lg);
	}

	.cms-blog-category {
		display: inline-block;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-primary);
		margin-bottom: var(--spacing-xs);
	}

	.cms-blog-card-content h2 {
		font-size: 1.375rem;
		font-weight: 600;
		margin-bottom: var(--spacing-sm);
		line-height: 1.3;
	}

	.cms-blog-card-content h2 a {
		color: var(--color-text);
		text-decoration: none;
	}

	.cms-blog-card-content h2 a:hover {
		color: var(--color-primary);
	}

	.cms-blog-excerpt {
		color: var(--color-text-secondary);
		font-size: 0.9375rem;
		line-height: 1.6;
		margin-bottom: var(--spacing-md);
	}

	.cms-blog-meta {
		display: flex;
		gap: var(--spacing-md);
		font-size: 0.8125rem;
		color: var(--color-text-secondary);
	}

	.cms-blog-read-time::before {
		content: '·';
		margin-right: var(--spacing-sm);
	}

	/* Default list template */
	.cms-default-list {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-lg);
	}

	.cms-default-item {
		padding: var(--spacing-lg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
	}

	.cms-default-item h2 {
		font-size: 1.25rem;
		margin-bottom: var(--spacing-xs);
	}

	.cms-default-item h2 a {
		color: var(--color-text);
		text-decoration: none;
	}

	.cms-default-item h2 a:hover {
		color: var(--color-primary);
	}

	.cms-default-item p {
		color: var(--color-text-secondary);
		margin-bottom: var(--spacing-sm);
	}

	.cms-default-item time {
		font-size: 0.8125rem;
		color: var(--color-text-secondary);
	}

	/* Pagination */
	.cms-pagination {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: var(--spacing-lg);
		margin-top: var(--spacing-2xl);
		padding-top: var(--spacing-lg);
		border-top: 1px solid var(--color-border);
	}

	.cms-pagination-link {
		color: var(--color-primary);
		text-decoration: none;
		font-weight: 500;
		padding: var(--spacing-sm) var(--spacing-md);
		border-radius: var(--radius-md);
		transition: background-color 0.2s ease;
	}

	.cms-pagination-link:hover {
		background-color: var(--color-surface-hover);
	}

	.cms-pagination-info {
		font-size: 0.875rem;
		color: var(--color-text-secondary);
	}

	@media (min-width: 768px) {
		.cms-blog-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}
</style>
