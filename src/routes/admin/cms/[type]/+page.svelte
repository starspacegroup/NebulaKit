<!--
  Admin CMS Content Type Management

  Shows items for a specific content type with filtering, sorting,
  create/edit modals, and delete confirmation.
-->
<script lang="ts">
	import SharingMeta from '$lib/components/SharingMeta.svelte';
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

	// UI state
	let showCreateModal = false;
	let showEditModal = false;
	let showDeleteConfirm = false;
	let editingItem: any = null;
	let deletingItem: any = null;
	let isLoading = false;
	let errors: Record<string, string> = {};

	// Form fields
	let formTitle = '';
	let formSlug = '';
	let formStatus: 'draft' | 'published' | 'archived' = 'draft';
	let formFields: Record<string, any> = {};
	let formSeoTitle = '';
	let formSeoDescription = '';
	let formSeoImage = '';
	let formTagIds: string[] = [];

	// SEO section visibility
	let showSeoFields = false;

	function getSortedFields() {
		if (!contentType?.fields) return [];
		return [...contentType.fields].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
	}

	$: sortedFields = getSortedFields();

	function toggleMultiselectValue(fieldName: string, value: string) {
		const current: string[] = formFields[fieldName] || [];
		if (current.includes(value)) {
			formFields[fieldName] = current.filter((v: string) => v !== value);
		} else {
			formFields[fieldName] = [...current, value];
		}
	}

	function getDefaultFields(): Record<string, any> {
		const defaults: Record<string, any> = {};
		if (contentType?.fields) {
			for (const field of contentType.fields) {
				if (field.defaultValue !== undefined) {
					defaults[field.name] = field.defaultValue;
				} else if (field.type === 'boolean') {
					defaults[field.name] = false;
				} else if (field.type === 'multiselect') {
					defaults[field.name] = [];
				} else if (field.type === 'number') {
					defaults[field.name] = null;
				} else {
					defaults[field.name] = '';
				}
			}
		}
		return defaults;
	}

	function resetForm() {
		formTitle = '';
		formSlug = '';
		formStatus = 'draft';
		formFields = getDefaultFields();
		formSeoTitle = '';
		formSeoDescription = '';
		formSeoImage = '';
		formTagIds = [];
		showSeoFields = false;
		errors = {};
	}

	function openCreateModal() {
		resetForm();
		showCreateModal = true;
	}

	function openEditModal(item: any) {
		editingItem = item;
		formTitle = item.title || '';
		formSlug = item.slug || '';
		formStatus = item.status || 'draft';
		formFields = { ...getDefaultFields(), ...(item.fields || {}) };
		formSeoTitle = item.seoTitle || '';
		formSeoDescription = item.seoDescription || '';
		formSeoImage = item.seoImage || '';
		formTagIds = item.tags?.map((t: any) => t.id) || [];
		showSeoFields = !!(item.seoTitle || item.seoDescription || item.seoImage);
		errors = {};
		showEditModal = true;
	}

	function closeModals() {
		showCreateModal = false;
		showEditModal = false;
		showDeleteConfirm = false;
		editingItem = null;
		deletingItem = null;
	}

	async function refreshItems() {
		try {
			const qp = new URLSearchParams();
			if (statusFilter) qp.set('status', statusFilter);
			if (searchQuery) qp.set('search', searchQuery);
			const qs = qp.toString() ? `?${qp.toString()}` : '';
			const res = await fetch(`/api/cms/${contentType.slug}${qs}`);
			if (res.ok) {
				const d = await res.json();
				items = d.items || [];
				totalItems = d.totalItems || 0;
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

	async function handleCreate() {
		errors = {};

		if (!formTitle.trim()) {
			errors.title = 'Title is required';
			return;
		}

		isLoading = true;
		try {
			const body: any = {
				title: formTitle.trim(),
				status: formStatus,
				fields: formFields
			};
			if (formSlug.trim()) body.slug = formSlug.trim();
			if (formSeoTitle) body.seoTitle = formSeoTitle;
			if (formSeoDescription) body.seoDescription = formSeoDescription;
			if (formSeoImage) body.seoImage = formSeoImage;
			if (formTagIds.length > 0) body.tagIds = formTagIds;

			const res = await fetch(`/api/cms/${contentType.slug}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});

			if (!res.ok) {
				const errData = await res.json();
				errors.general = errData.message || 'Failed to create item';
				return;
			}

			closeModals();
			await refreshItems();
		} catch (err) {
			errors.general = 'An unexpected error occurred';
		} finally {
			isLoading = false;
		}
	}

	async function handleUpdate() {
		errors = {};

		if (!formTitle.trim()) {
			errors.title = 'Title is required';
			return;
		}
		if (!editingItem) return;

		isLoading = true;
		try {
			const body: any = {
				title: formTitle.trim(),
				slug: formSlug.trim(),
				status: formStatus,
				fields: formFields
			};
			if (contentType.settings?.hasSEO) {
				body.seoTitle = formSeoTitle || null;
				body.seoDescription = formSeoDescription || null;
				body.seoImage = formSeoImage || null;
			}
			if (contentType.settings?.hasTags) {
				body.tagIds = formTagIds;
			}

			const res = await fetch(`/api/cms/${contentType.slug}/${editingItem.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});

			if (!res.ok) {
				const errData = await res.json();
				errors.general = errData.message || 'Failed to update item';
				return;
			}

			closeModals();
			await refreshItems();
		} catch (err) {
			errors.general = 'An unexpected error occurred';
		} finally {
			isLoading = false;
		}
	}

	function confirmDelete(item: any) {
		deletingItem = item;
		showDeleteConfirm = true;
	}

	async function handleDelete() {
		if (!deletingItem) return;

		isLoading = true;
		try {
			const res = await fetch(`/api/cms/${contentType.slug}/${deletingItem.id}`, {
				method: 'DELETE'
			});

			if (!res.ok) {
				const errData = await res.json();
				errors.general = errData.message || 'Failed to delete item';
				return;
			}

			closeModals();
			await refreshItems();
		} catch (err) {
			errors.general = 'An unexpected error occurred';
		} finally {
			isLoading = false;
		}
	}

	function handleFilterChange() {
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

	function toggleTag(tagId: string) {
		if (formTagIds.includes(tagId)) {
			formTagIds = formTagIds.filter((id) => id !== tagId);
		} else {
			formTagIds = [...formTagIds, tagId];
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

<SharingMeta
	title="{contentType.name} - CMS Admin"
	noindex={true}
/>

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
			<button class="btn btn-primary" on:click={openCreateModal}>
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
			</button>
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
			<h3>No items yet</h3>
			<p>Create your first {contentType.name.replace(/s$/, '').toLowerCase()} to get started.</p>
			<button class="btn btn-primary" on:click={openCreateModal}>
				Create {contentType.name.replace(/s$/, '')}
			</button>
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
								<span class="item-slug"
									>/{contentType.settings?.routePrefix?.replace(/^\//, '') ||
										contentType.slug}/{item.slug}</span
								>
							</td>
							<td>
								<span class="status-badge" style="--badge-color: {getStatusColor(item.status)}">
									{item.status}
								</span>
							</td>
							<td class="td-date">{formatDate(item.createdAt)}</td>
							<td class="td-date">{formatDate(item.updatedAt)}</td>
							<td class="td-actions">
								<button class="btn-icon" title="Edit" on:click={() => openEditModal(item)}>
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
								</button>
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

<!-- Create/Edit Modal -->
{#if showCreateModal || showEditModal}
	<div
		class="modal-overlay"
		on:click|self={closeModals}
		on:keydown={(e) => e.key === 'Escape' && closeModals()}
		role="presentation"
	>
		<div
			class="modal"
			role="dialog"
			aria-modal="true"
			aria-label="{showCreateModal ? 'Create' : 'Edit'} {contentType.name.replace(/s$/, '')}"
		>
			<div class="modal-header">
				<h2>{showCreateModal ? 'Create' : 'Edit'} {contentType.name.replace(/s$/, '')}</h2>
				<button class="btn-close" on:click={closeModals} aria-label="Close modal">&times;</button>
			</div>
			<div class="modal-body">
				{#if errors.general}
					<div class="error-banner">{errors.general}</div>
				{/if}

				<!-- Title -->
				<div class="form-group">
					<label for="form-title">Title <span class="required">*</span></label>
					<input
						id="form-title"
						type="text"
						bind:value={formTitle}
						class:error={errors.title}
						placeholder="Enter title..."
					/>
					{#if errors.title}<span class="error-message">{errors.title}</span>{/if}
				</div>

				<!-- Slug (optional override) -->
				<div class="form-group">
					<label for="form-slug">Slug</label>
					<input
						id="form-slug"
						type="text"
						bind:value={formSlug}
						placeholder="auto-generated-from-title"
					/>
					<span class="field-help">Leave empty to auto-generate from title</span>
				</div>

				<!-- Status -->
				{#if contentType.settings?.hasDrafts !== false}
					<div class="form-group">
						<label for="form-status">Status</label>
						<select id="form-status" bind:value={formStatus}>
							<option value="draft">Draft</option>
							<option value="published">Published</option>
							<option value="archived">Archived</option>
						</select>
					</div>
				{/if}

				<!-- Custom Fields -->
				{#if contentType.fields?.length}
					<div class="form-section">
						<h3>Content Fields</h3>
						{#each sortedFields as field}
							<div class="form-group">
								<label for="field-{field.name}">
									{field.label}
									{#if field.required}<span class="required">*</span>{/if}
								</label>

								{#if field.type === 'url'}
									<input
										id="field-{field.name}"
										type="url"
										bind:value={formFields[field.name]}
										placeholder={field.placeholder || ''}
									/>
								{:else if field.type === 'email'}
									<input
										id="field-{field.name}"
										type="email"
										bind:value={formFields[field.name]}
										placeholder={field.placeholder || ''}
									/>
								{:else if field.type === 'color'}
									<input id="field-{field.name}" type="color" bind:value={formFields[field.name]} />
								{:else if field.type === 'text'}
									<input
										id="field-{field.name}"
										type="text"
										bind:value={formFields[field.name]}
										placeholder={field.placeholder || ''}
									/>
								{:else if field.type === 'number'}
									<input
										id="field-{field.name}"
										type="number"
										bind:value={formFields[field.name]}
										placeholder={field.placeholder || ''}
										min={field.validation?.min}
										max={field.validation?.max}
									/>
								{:else if field.type === 'textarea'}
									<textarea
										id="field-{field.name}"
										bind:value={formFields[field.name]}
										placeholder={field.placeholder || ''}
										rows="3"
									></textarea>
								{:else if field.type === 'richtext'}
									<textarea
										id="field-{field.name}"
										bind:value={formFields[field.name]}
										placeholder={field.placeholder || ''}
										rows="10"
										class="richtext-field"
									></textarea>
									<span class="field-help">Supports Markdown formatting</span>
								{:else if field.type === 'boolean'}
									<label class="checkbox-label">
										<input
											id="field-{field.name}"
											type="checkbox"
											bind:checked={formFields[field.name]}
										/>
										<span>{field.helpText || 'Enable'}</span>
									</label>
								{:else if field.type === 'select'}
									<select id="field-{field.name}" bind:value={formFields[field.name]}>
										<option value="">Select...</option>
										{#each field.options || [] as opt}
											<option value={opt.value}>{opt.label}</option>
										{/each}
									</select>
								{:else if field.type === 'multiselect'}
									<div class="multiselect-group">
										{#each field.options || [] as opt}
											<label class="checkbox-label">
												<input
													type="checkbox"
													checked={formFields[field.name]?.includes(opt.value)}
													on:change={() => toggleMultiselectValue(field.name, opt.value)}
												/>
												<span>{opt.label}</span>
											</label>
										{/each}
									</div>
								{:else if field.type === 'date'}
									<input id="field-{field.name}" type="date" bind:value={formFields[field.name]} />
								{:else if field.type === 'datetime'}
									<input
										id="field-{field.name}"
										type="datetime-local"
										bind:value={formFields[field.name]}
									/>
								{:else if field.type === 'image'}
									<input
										id="field-{field.name}"
										type="url"
										bind:value={formFields[field.name]}
										placeholder={field.placeholder || 'https://example.com/image.jpg'}
									/>
								{:else if field.type === 'json'}
									<textarea
										id="field-{field.name}"
										bind:value={formFields[field.name]}
										placeholder={'{"key": "value"}'}
										rows="5"
										class="json-field"
									></textarea>
								{:else}
									<input
										id="field-{field.name}"
										type="text"
										bind:value={formFields[field.name]}
										placeholder={field.placeholder || ''}
									/>
								{/if}

								{#if field.helpText && field.type !== 'boolean' && field.type !== 'richtext'}
									<span class="field-help">{field.helpText}</span>
								{/if}
							</div>
						{/each}
					</div>
				{/if}

				<!-- Tags -->
				{#if contentType.settings?.hasTags && tags.length > 0}
					<div class="form-section">
						<h3>Tags</h3>
						<div class="tag-select">
							{#each tags as tag}
								<button
									class="tag-toggle"
									class:selected={formTagIds.includes(tag.id)}
									on:click={() => toggleTag(tag.id)}
									type="button"
								>
									{tag.name}
								</button>
							{/each}
						</div>
					</div>
				{/if}

				<!-- SEO Fields -->
				{#if contentType.settings?.hasSEO !== false}
					<div class="form-section">
						<button
							class="section-toggle"
							on:click={() => (showSeoFields = !showSeoFields)}
							type="button"
						>
							<svg
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								style="transform: rotate({showSeoFields ? 90 : 0}deg); transition: transform 0.2s"
							>
								<polyline points="9 18 15 12 9 6" />
							</svg>
							SEO Settings
						</button>
						{#if showSeoFields}
							<div class="seo-fields">
								<div class="form-group">
									<label for="seo-title">SEO Title</label>
									<input
										id="seo-title"
										type="text"
										bind:value={formSeoTitle}
										placeholder="Page title for search engines"
									/>
								</div>
								<div class="form-group">
									<label for="seo-description">SEO Description</label>
									<textarea
										id="seo-description"
										bind:value={formSeoDescription}
										placeholder="Brief description for search engine results"
										rows="2"
									></textarea>
								</div>
								<div class="form-group">
									<label for="seo-image">SEO Image URL</label>
									<input
										id="seo-image"
										type="url"
										bind:value={formSeoImage}
										placeholder="https://example.com/og-image.jpg"
									/>
								</div>
							</div>
						{/if}
					</div>
				{/if}
			</div>
			<div class="modal-footer">
				<button class="btn btn-secondary" on:click={closeModals} disabled={isLoading}>
					Cancel
				</button>
				{#if showCreateModal}
					<button class="btn btn-primary" on:click={handleCreate} disabled={isLoading}>
						{isLoading ? 'Creating...' : 'Create'}
					</button>
				{:else}
					<button class="btn btn-primary" on:click={handleUpdate} disabled={isLoading}>
						{isLoading ? 'Saving...' : 'Save Changes'}
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}

<!-- Delete Confirmation Modal -->
{#if showDeleteConfirm && deletingItem}
	<div
		class="modal-overlay"
		on:click|self={closeModals}
		on:keydown={(e) => e.key === 'Escape' && closeModals()}
		role="presentation"
	>
		<div class="modal modal-sm" role="dialog" aria-modal="true" aria-label="Confirm deletion">
			<div class="modal-header">
				<h2>Delete {contentType.name.replace(/s$/, '')}</h2>
				<button class="btn-close" on:click={closeModals} aria-label="Close">&times;</button>
			</div>
			<div class="modal-body">
				<p>
					Are you sure you want to delete <strong>{deletingItem.title}</strong>? This action cannot
					be undone.
				</p>
			</div>
			<div class="modal-footer">
				<button class="btn btn-secondary" on:click={closeModals} disabled={isLoading}>Cancel</button
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

	/* Modal */
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

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: var(--spacing-sm);
		padding: var(--spacing-lg);
		border-top: 1px solid var(--color-border);
	}

	/* Forms */
	.form-group {
		margin-bottom: var(--spacing-md);
	}

	.form-group label {
		display: block;
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--color-text);
		margin-bottom: var(--spacing-xs);
	}

	.form-group input[type='text'],
	.form-group input[type='url'],
	.form-group input[type='email'],
	.form-group input[type='number'],
	.form-group input[type='date'],
	.form-group input[type='datetime-local'],
	.form-group textarea,
	.form-group select {
		width: 100%;
		padding: var(--spacing-sm) var(--spacing-md);
		background: var(--color-surface);
		color: var(--color-text);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		font-size: 0.875rem;
		font-family: inherit;
	}

	.form-group input:focus,
	.form-group textarea:focus,
	.form-group select:focus {
		border-color: var(--color-primary);
		outline: none;
	}

	.form-group input.error {
		border-color: var(--color-danger, #dc3545);
	}

	.form-group input::placeholder,
	.form-group textarea::placeholder {
		color: var(--color-text-secondary);
	}

	.form-group input[type='color'] {
		width: 48px;
		height: 36px;
		padding: 2px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-surface);
		cursor: pointer;
	}

	.richtext-field {
		font-family: 'Courier New', monospace;
		line-height: 1.5;
	}

	.json-field {
		font-family: 'Courier New', monospace;
		font-size: 0.8125rem;
	}

	.field-help {
		display: block;
		font-size: 0.75rem;
		color: var(--color-text-secondary);
		margin-top: 0.25rem;
	}

	.required {
		color: var(--color-danger, #dc3545);
	}

	.error-message {
		display: block;
		font-size: 0.75rem;
		color: var(--color-danger, #dc3545);
		margin-top: 0.25rem;
	}

	.error-banner {
		background: color-mix(in srgb, var(--color-danger, #dc3545) 10%, var(--color-surface));
		border: 1px solid var(--color-danger, #dc3545);
		color: var(--color-danger, #dc3545);
		padding: var(--spacing-sm) var(--spacing-md);
		border-radius: var(--radius-md);
		font-size: 0.875rem;
		margin-bottom: var(--spacing-md);
	}

	.form-section {
		margin-top: var(--spacing-lg);
		padding-top: var(--spacing-lg);
		border-top: 1px solid var(--color-border);
	}

	.form-section h3 {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-text);
		margin-bottom: var(--spacing-md);
	}

	.section-toggle {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		background: none;
		border: none;
		padding: 0;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-text);
		cursor: pointer;
		margin-bottom: var(--spacing-md);
	}

	.section-toggle:hover {
		color: var(--color-primary);
	}

	.seo-fields {
		padding-left: var(--spacing-md);
	}

	.checkbox-label {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-sm);
		font-size: 0.875rem;
		color: var(--color-text);
		cursor: pointer;
	}

	.checkbox-label input[type='checkbox'] {
		width: 16px;
		height: 16px;
		accent-color: var(--color-primary);
	}

	.multiselect-group {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xs);
	}

	/* Tag Selection */
	.tag-select {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-xs);
	}

	.tag-toggle {
		padding: 0.25rem var(--spacing-sm);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-surface);
		color: var(--color-text-secondary);
		font-size: 0.8125rem;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.tag-toggle:hover {
		border-color: var(--color-primary);
	}

	.tag-toggle.selected {
		background: var(--color-primary);
		color: var(--color-background);
		border-color: var(--color-primary);
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
