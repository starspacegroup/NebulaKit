<!--
  Admin CMS Content Type Management

  Lists items for a content type with filtering, sorting, and delete
  confirmation. Creating and editing items happen on dedicated pages
  (/admin/cms/[type]/new and /admin/cms/[type]/[id]).
-->
<script lang="ts">
	import SharingMeta from '$lib/components/SharingMeta.svelte';
	import { browser } from '$app/environment';
	import { replaceState } from '$app/navigation';
	import type { PageData } from './$types';

	export let data: PageData;

	let contentType = data.contentType;
	let items: any[] = data.items || [];
	let tags: any[] = data.tags || [];
	let totalItems = data.totalItems || 0;
	let totalPages = data.totalPages || 1;
	let currentPage = data.currentPage || 1;

	// Filters
	let statusFilter = data.filters?.status || '';
	let searchQuery = data.filters?.search || '';

	// An empty table means two very different things: nothing has been created
	// yet, or a filter excluded everything. Saying "no items yet" for the second
	// case tells the user their content is gone, which it isn't.
	$: isFiltered = Boolean(searchQuery.trim() || statusFilter);

	// Delete confirmation
	let showDeleteConfirm = false;
	let deletingItem: any = null;
	let isLoading = false;
	let deleteError = '';

	async function refreshItems() {
		try {
			const qp = new URLSearchParams();
			if (statusFilter) qp.set('status', statusFilter);
			if (searchQuery) qp.set('search', searchQuery);
			const qs = qp.toString() ? `?${qp.toString()}` : '';
			// Keep the address bar in step with what's on screen, so a filtered
			// view is linkable and survives a reload. replaceState rather than
			// push: typing in the search box shouldn't bury the back button.
			if (browser) {
				replaceState(`${window.location.pathname}${qs}`, {});
			}
			const res = await fetch(`/api/cms/${contentType.slug}${qs}`);
			if (res.ok) {
				const d = await res.json();
				items = d.items || [];
				totalItems = d.total || 0;
				totalPages = d.totalPages || 1;
				currentPage = d.page || 1;
			}
		} catch (err) {
			console.error('Failed to refresh items:', err);
		}
	}

	async function refreshTags() {
		if (!contentType.settings?.hasTags) return;
		try {
			const res = await fetch(`/api/cms/${contentType.slug}/tags`);
			if (res.ok) {
				const d = await res.json();
				tags = d.tags || [];
			}
		} catch {
			// ignore
		}
	}

	function confirmDelete(item: any) {
		deletingItem = item;
		deleteError = '';
		showDeleteConfirm = true;
	}

	function closeDelete() {
		showDeleteConfirm = false;
		deletingItem = null;
	}

	async function handleDelete() {
		if (!deletingItem) return;

		isLoading = true;
		try {
			const res = await fetch(`/api/cms/${contentType.slug}/${deletingItem.id}`, {
				method: 'DELETE'
			});

			if (!res.ok) {
				const errData = await res.json().catch(() => ({}));
				deleteError = errData.message || 'Failed to delete item';
				return;
			}

			closeDelete();
			await refreshItems();
		} catch (err) {
			deleteError = 'An unexpected error occurred';
		} finally {
			isLoading = false;
		}
	}

	function handleFilterChange() {
		refreshItems();
	}

	function clearFilters() {
		searchQuery = '';
		statusFilter = '';
		refreshItems();
	}

	function getStatusColor(status: string): string {
		switch (status) {
			case 'published':
				return 'var(--color-success, #22c55e)';
			case 'draft':
				return 'var(--color-warning, #f59e0b)';
			case 'archived':
				return 'var(--color-text-secondary)';
			default:
				return 'var(--color-text-secondary)';
		}
	}

	function formatDate(dateStr: string | null): string {
		if (!dateStr) return '—';
		try {
			return new Date(dateStr).toLocaleDateString('en-US', {
				year: 'numeric',
				month: 'short',
				day: 'numeric'
			});
		} catch {
			return dateStr;
		}
	}

	// Tag management
	let newTagName = '';
	let showTagManager = false;

	async function createTag() {
		if (!newTagName.trim()) return;
		try {
			const res = await fetch(`/api/cms/${contentType.slug}/tags`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: newTagName.trim() })
			});
			if (res.ok) {
				newTagName = '';
				await refreshTags();
			}
		} catch {
			// ignore
		}
	}
</script>

<SharingMeta title="{contentType.name} - CMS Admin" noindex={true} />

<div class="cms-manage">
	<!-- Header -->
	<div class="page-header">
		<div class="page-header-left">
			<a href="/admin/cms" class="back-link">
				<svg
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<polyline points="15 18 9 12 15 6" />
				</svg>
				Back to CMS
			</a>
			<h1>{contentType.name}</h1>
			{#if contentType.description}
				<p class="page-description">{contentType.description}</p>
			{/if}
		</div>
		<div class="page-header-actions">
			{#if contentType.settings?.hasTags}
				<button class="btn btn-secondary" on:click={() => (showTagManager = !showTagManager)}>
					Tags
				</button>
			{/if}
			<a class="btn btn-primary" href="/admin/cms/{contentType.slug}/new">
				<svg
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<line x1="12" y1="5" x2="12" y2="19" />
					<line x1="5" y1="12" x2="19" y2="12" />
				</svg>
				New {contentType.name.replace(/s$/, '')}
			</a>
		</div>
	</div>

	<!-- Tag Manager -->
	{#if showTagManager && contentType.settings?.hasTags}
		<div class="tag-manager">
			<h3>Manage Tags</h3>
			<div class="tag-create-row">
				<input
					type="text"
					bind:value={newTagName}
					placeholder="New tag name..."
					on:keydown={(e) => e.key === 'Enter' && createTag()}
				/>
				<button class="btn btn-primary btn-sm" on:click={createTag}>Add</button>
			</div>
			{#if tags.length > 0}
				<div class="tag-list">
					{#each tags as tag}
						<span class="tag-chip">{tag.name}</span>
					{/each}
				</div>
			{:else}
				<p class="tag-empty">No tags yet</p>
			{/if}
		</div>
	{/if}

	<!-- Filters -->
	<div class="filters-bar">
		<div class="filters-left">
			<input
				type="text"
				class="search-input"
				placeholder="Search {contentType.name.toLowerCase()}..."
				bind:value={searchQuery}
				on:input={handleFilterChange}
			/>
			<select class="status-filter" bind:value={statusFilter} on:change={handleFilterChange}>
				<option value="">All statuses</option>
				<option value="draft">Draft</option>
				<option value="published">Published</option>
				<option value="archived">Archived</option>
			</select>
		</div>
		<span class="items-count">{totalItems} item{totalItems !== 1 ? 's' : ''}</span>
	</div>

	<!-- Items Table -->
	{#if items.length === 0}
		<div class="empty-state">
			<svg
				width="48"
				height="48"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
				<polyline points="14 2 14 8 20 8" />
			</svg>
			{#if isFiltered}
				<h3>No matches</h3>
				<p>
					No {contentType.name.toLowerCase()}
					{#if statusFilter}with status <strong>{statusFilter}</strong>{/if}
					{#if searchQuery.trim()}matching <strong>&ldquo;{searchQuery.trim()}&rdquo;</strong>{/if}.
					Nothing has been deleted — clear the filters to see everything again.
				</p>
				<button class="btn btn-secondary" on:click={clearFilters}>Clear filters</button>
			{:else}
				<h3>No items yet</h3>
				<p>Create your first {contentType.name.replace(/s$/, '').toLowerCase()} to get started.</p>
				<a class="btn btn-primary" href="/admin/cms/{contentType.slug}/new">
					Create {contentType.name.replace(/s$/, '')}
				</a>
			{/if}
		</div>
	{:else}
		<div class="items-table-wrap">
			<table class="items-table">
				<thead>
					<tr>
						<th>Title</th>
						<th>Status</th>
						<th>Created</th>
						<th>Updated</th>
						<th class="th-actions">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each items as item}
						<tr>
							<td class="td-title">
								<span class="item-title">{item.title}</span>
								<span class="item-slug">
									/{contentType.settings?.routePrefix?.replace(/^\//, '') ||
										contentType.slug}/{item.slug}
								</span>
							</td>
							<td>
								<span class="status-badge" style="--badge-color: {getStatusColor(item.status)}">
									{item.status}
								</span>
							</td>
							<td class="td-date">{formatDate(item.createdAt)}</td>
							<td class="td-date">{formatDate(item.updatedAt)}</td>
							<td class="td-actions">
								<a class="btn-icon" title="Edit" href="/admin/cms/{contentType.slug}/{item.id}">
									<svg
										width="16"
										height="16"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
									>
										<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
										<path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z" />
									</svg>
								</a>
								<button
									class="btn-icon btn-icon-danger"
									title="Delete"
									on:click={() => confirmDelete(item)}
								>
									<svg
										width="16"
										height="16"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
									>
										<polyline points="3 6 5 6 21 6" />
										<path
											d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
										/>
									</svg>
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Pagination -->
		{#if totalPages > 1}
			<div class="pagination">
				{#each Array(totalPages) as _, i}
					<a
						href="/admin/cms/{contentType.slug}?page={i + 1}{statusFilter
							? '&status=' + statusFilter
							: ''}{searchQuery ? '&search=' + searchQuery : ''}"
						class="pagination-btn"
						class:active={currentPage === i + 1}
					>
						{i + 1}
					</a>
				{/each}
			</div>
		{/if}
	{/if}
</div>

<!-- Delete Confirmation Modal -->
{#if showDeleteConfirm && deletingItem}
	<div
		class="modal-overlay"
		on:click|self={closeDelete}
		on:keydown={(e) => e.key === 'Escape' && closeDelete()}
		role="presentation"
	>
		<div class="modal modal-sm" role="dialog" aria-modal="true" aria-label="Confirm deletion">
			<div class="modal-header">
				<h2>Delete {contentType.name.replace(/s$/, '')}</h2>
				<button class="btn-close" on:click={closeDelete} aria-label="Close">&times;</button>
			</div>
			<div class="modal-body">
				<p>
					Are you sure you want to delete <strong>{deletingItem.title}</strong>? This action cannot
					be undone.
				</p>
				{#if deleteError}<p class="delete-error">{deleteError}</p>{/if}
			</div>
			<div class="modal-footer">
				<button class="btn btn-secondary" on:click={closeDelete} disabled={isLoading}>Cancel</button
				>
				<button class="btn btn-danger" on:click={handleDelete} disabled={isLoading}>
					{isLoading ? 'Deleting...' : 'Delete'}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	/* Page Layout */
	.cms-manage {
		max-width: 1000px;
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: var(--spacing-xl);
		gap: var(--spacing-md);
	}

	.page-header-left {
		flex: 1;
	}

	.back-link {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-xs);
		color: var(--color-text-secondary);
		text-decoration: none;
		font-size: 0.8125rem;
		margin-bottom: var(--spacing-sm);
		transition: color var(--transition-fast);
	}

	.back-link:hover {
		color: var(--color-primary);
	}

	.page-header h1 {
		font-size: 1.75rem;
		font-weight: 700;
		color: var(--color-text);
		margin-bottom: var(--spacing-xs);
	}

	.page-description {
		color: var(--color-text-secondary);
		font-size: 0.875rem;
	}

	.page-header-actions {
		display: flex;
		gap: var(--spacing-sm);
		align-items: center;
		flex-shrink: 0;
		padding-top: var(--spacing-lg);
	}

	/* Tag Manager */
	.tag-manager {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: var(--spacing-lg);
		margin-bottom: var(--spacing-lg);
	}

	.tag-manager h3 {
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--color-text);
		margin-bottom: var(--spacing-md);
	}

	.tag-create-row {
		display: flex;
		gap: var(--spacing-sm);
		margin-bottom: var(--spacing-md);
	}

	.tag-create-row input {
		flex: 1;
		padding: var(--spacing-xs) var(--spacing-sm);
		background: var(--color-background);
		color: var(--color-text);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		font-size: 0.875rem;
	}

	.tag-list {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-xs);
	}

	.tag-chip {
		display: inline-block;
		padding: 0.125rem var(--spacing-sm);
		background: var(--color-background);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
		color: var(--color-text-secondary);
	}

	.tag-empty {
		color: var(--color-text-secondary);
		font-size: 0.8125rem;
	}

	/* Filters */
	.filters-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-md);
		margin-bottom: var(--spacing-lg);
	}

	.filters-left {
		display: flex;
		gap: var(--spacing-sm);
		flex: 1;
	}

	.search-input {
		flex: 1;
		max-width: 320px;
		padding: var(--spacing-sm) var(--spacing-md);
		background: var(--color-surface);
		color: var(--color-text);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		font-size: 0.875rem;
	}

	.search-input:focus {
		border-color: var(--color-primary);
		outline: none;
	}

	.search-input::placeholder {
		color: var(--color-text-secondary);
	}

	.status-filter {
		padding: var(--spacing-sm) var(--spacing-md);
		background: var(--color-surface);
		color: var(--color-text);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		font-size: 0.875rem;
	}

	.items-count {
		color: var(--color-text-secondary);
		font-size: 0.8125rem;
		white-space: nowrap;
	}

	/* Empty State */
	.empty-state {
		text-align: center;
		padding: var(--spacing-2xl);
		border: 1px dashed var(--color-border);
		border-radius: var(--radius-lg);
		color: var(--color-text-secondary);
	}

	.empty-state svg {
		margin-bottom: var(--spacing-md);
		opacity: 0.4;
	}

	.empty-state h3 {
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--color-text);
		margin-bottom: var(--spacing-sm);
	}

	.empty-state p {
		margin-bottom: var(--spacing-lg);
	}

	/* Items Table */
	.items-table-wrap {
		overflow-x: auto;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
	}

	.items-table {
		width: 100%;
		border-collapse: collapse;
	}

	.items-table th {
		text-align: left;
		padding: var(--spacing-sm) var(--spacing-md);
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		background: var(--color-surface);
		border-bottom: 1px solid var(--color-border);
	}

	.items-table td {
		padding: var(--spacing-sm) var(--spacing-md);
		font-size: 0.875rem;
		color: var(--color-text);
		border-bottom: 1px solid var(--color-border);
		vertical-align: middle;
	}

	.items-table tbody tr:last-child td {
		border-bottom: none;
	}

	.items-table tbody tr:hover {
		background: var(--color-surface);
	}

	.td-title {
		max-width: 300px;
	}

	.item-title {
		display: block;
		font-weight: 500;
	}

	.item-slug {
		display: block;
		font-size: 0.75rem;
		color: var(--color-text-secondary);
		margin-top: 0.125rem;
	}

	.td-date {
		white-space: nowrap;
		font-size: 0.8125rem;
		color: var(--color-text-secondary);
	}

	.th-actions {
		width: 100px;
		text-align: right;
	}

	.td-actions {
		text-align: right;
		white-space: nowrap;
	}

	.status-badge {
		display: inline-block;
		padding: 0.125rem var(--spacing-sm);
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
		font-weight: 500;
		text-transform: capitalize;
		color: var(--badge-color);
		background: color-mix(in srgb, var(--badge-color) 12%, transparent);
	}

	/* Pagination */
	.pagination {
		display: flex;
		gap: var(--spacing-xs);
		justify-content: center;
		margin-top: var(--spacing-lg);
	}

	.pagination-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border-radius: var(--radius-md);
		font-size: 0.875rem;
		text-decoration: none;
		color: var(--color-text);
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		transition: all 0.15s ease;
	}

	.pagination-btn:hover {
		border-color: var(--color-primary);
	}

	.pagination-btn.active {
		background: var(--color-primary);
		color: var(--color-background);
		border-color: var(--color-primary);
	}

	/* Buttons */
	.btn {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-xs);
		padding: var(--spacing-sm) var(--spacing-md);
		border-radius: var(--radius-md);
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		border: 1px solid transparent;
		text-decoration: none;
		transition: all 0.15s ease;
	}

	.btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn-primary {
		background: var(--color-primary);
		color: var(--color-background);
	}

	.btn-primary:hover:not(:disabled) {
		opacity: 0.9;
	}

	.btn-secondary {
		background: var(--color-surface);
		color: var(--color-text);
		border-color: var(--color-border);
	}

	.btn-secondary:hover:not(:disabled) {
		border-color: var(--color-primary);
	}

	.btn-danger {
		background: var(--color-danger, #dc3545);
		color: #fff;
	}

	.btn-danger:hover:not(:disabled) {
		opacity: 0.9;
	}

	.btn-sm {
		padding: var(--spacing-xs) var(--spacing-sm);
		font-size: 0.8125rem;
	}

	.btn-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border: none;
		background: transparent;
		color: var(--color-text-secondary);
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.btn-icon:hover {
		background: var(--color-surface);
		color: var(--color-text);
	}

	.btn-icon-danger:hover {
		color: var(--color-danger, #dc3545);
	}

	/* Modal (delete confirmation) */
	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding: var(--spacing-2xl);
		z-index: 1000;
		overflow-y: auto;
	}

	.modal {
		background: var(--color-background);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		width: 100%;
		max-width: 640px;
		box-shadow: var(--shadow-lg);
		margin-top: var(--spacing-xl);
	}

	.modal-sm {
		max-width: 440px;
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--spacing-lg);
		border-bottom: 1px solid var(--color-border);
	}

	.modal-header h2 {
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--color-text);
	}

	.btn-close {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border: none;
		background: transparent;
		color: var(--color-text-secondary);
		font-size: 1.25rem;
		cursor: pointer;
		border-radius: var(--radius-sm);
	}

	.btn-close:hover {
		background: var(--color-surface);
		color: var(--color-text);
	}

	.modal-body {
		padding: var(--spacing-lg);
		max-height: 60vh;
		overflow-y: auto;
	}

	.delete-error {
		color: var(--color-danger, #dc3545);
		font-size: 0.875rem;
		margin-top: var(--spacing-sm);
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: var(--spacing-sm);
		padding: var(--spacing-lg);
		border-top: 1px solid var(--color-border);
	}

	/* Responsive */
	@media (max-width: 768px) {
		.page-header {
			flex-direction: column;
		}

		.page-header-actions {
			padding-top: 0;
		}

		.filters-bar {
			flex-direction: column;
			align-items: stretch;
		}

		.filters-left {
			flex-direction: column;
		}

		.search-input {
			max-width: none;
		}

		.modal {
			margin-top: var(--spacing-md);
		}

		.modal-body {
			max-height: 70vh;
		}
	}
</style>
