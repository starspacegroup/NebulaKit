<!--
  CmsItemEditor — full-page create/edit form for a CMS content item.

  Shared by the create route (/admin/cms/[type]/new) and the edit route
  (/admin/cms/[type]/[id]). Pass `item` for edit mode; omit it for create.
  Two-column layout: content fields on the left, status/SEO/actions in a
  sticky sidebar. Saves via POST (create) or PUT (edit) and returns to the
  content-type list.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import ImageField from '$lib/components/ImageField.svelte';
	import RichTextEditor from '$lib/components/RichTextEditor.svelte';

	export let contentType: any;
	/** Existing item for edit mode; null/undefined for create mode. */
	export let item: any = null;
	export let tags: any[] = [];

	const isEdit = !!item;
	const listUrl = `/admin/cms/${contentType.slug}`;
	const typeLabel = contentType.name.replace(/s$/, '');

	function getSortedFields() {
		if (!contentType?.fields) return [];
		return [...contentType.fields].sort(
			(a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0)
		);
	}
	const sortedFields = getSortedFields();

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

	let formTitle: string = item?.title || '';
	let formSlug: string = item?.slug || '';
	let formStatus: 'draft' | 'published' | 'archived' = item?.status || 'draft';
	let formFields: Record<string, any> = { ...getDefaultFields(), ...(item?.fields || {}) };
	let formSeoTitle: string = item?.seoTitle || '';
	let formSeoDescription: string = item?.seoDescription || '';
	let formSeoImage: string = item?.seoImage || '';
	let formShowInCommandPalette: boolean = item ? item.showInCommandPalette !== false : true;
	let formTagIds: string[] = item?.tags?.map((t: any) => t.id) || [];
	let showSeoFields: boolean = !!(item?.seoTitle || item?.seoDescription || item?.seoImage);

	let isLoading = false;
	let errors: Record<string, string> = {};

	function toggleMultiselectValue(fieldName: string, value: string) {
		const current: string[] = formFields[fieldName] || [];
		formFields[fieldName] = current.includes(value)
			? current.filter((v: string) => v !== value)
			: [...current, value];
	}

	function toggleTag(tagId: string) {
		formTagIds = formTagIds.includes(tagId)
			? formTagIds.filter((id) => id !== tagId)
			: [...formTagIds, tagId];
	}

	async function handleSave() {
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
				fields: formFields,
				showInCommandPalette: formShowInCommandPalette
			};
			// On edit, keep the (prefilled) slug; on create, only send an explicit override.
			if (isEdit || formSlug.trim()) body.slug = formSlug.trim();
			if (contentType.settings?.hasSEO !== false) {
				body.seoTitle = formSeoTitle || null;
				body.seoDescription = formSeoDescription || null;
				body.seoImage = formSeoImage || null;
			}
			if (contentType.settings?.hasTags) {
				body.tagIds = formTagIds;
			}

			const url = isEdit
				? `/api/cms/${contentType.slug}/${item.id}`
				: `/api/cms/${contentType.slug}`;
			const res = await fetch(url, {
				method: isEdit ? 'PUT' : 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});

			if (!res.ok) {
				const errData = await res.json().catch(() => ({}));
				errors.general = errData.message || `Failed to ${isEdit ? 'save' : 'create'} item`;
				return;
			}

			await goto(listUrl);
		} catch {
			errors.general = 'An unexpected error occurred';
		} finally {
			isLoading = false;
		}
	}
</script>

<div class="edit-page">
	<div class="page-header">
		<div class="page-header-left">
			<a href={listUrl} class="back-link">
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
				Back to {contentType.name}
			</a>
			<h1>{isEdit ? 'Edit' : 'New'} {typeLabel}</h1>
			{#if isEdit}
				<p class="item-meta">{item.title}</p>
			{/if}
		</div>
		<div class="page-header-actions">
			<a href={listUrl} class="btn btn-secondary">Cancel</a>
			<button class="btn btn-primary" on:click={handleSave} disabled={isLoading}>
				{isLoading ? 'Saving…' : isEdit ? 'Save Changes' : 'Create'}
			</button>
		</div>
	</div>

	{#if errors.general}
		<div class="error-banner">{errors.general}</div>
	{/if}

	<div class="edit-layout">
		<div class="edit-main">
			<!-- Title + slug -->
			<div class="card">
				<div class="form-group">
					<label for="form-title">Title <span class="required">*</span></label>
					<input
						id="form-title"
						type="text"
						bind:value={formTitle}
						class:error={errors.title}
						placeholder="Enter title…"
					/>
					{#if errors.title}<span class="error-message">{errors.title}</span>{/if}
				</div>
				<div class="form-group">
					<label for="form-slug">Slug</label>
					<input
						id="form-slug"
						type="text"
						bind:value={formSlug}
						placeholder="auto-generated-from-title"
					/>
					<span class="field-help">Leave empty to auto-generate from the title.</span>
				</div>
			</div>

			<!-- Custom fields -->
			{#if sortedFields.length > 0}
				<div class="card">
					<h2 class="card-title">Content Fields</h2>
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
									rows="4"></textarea>
							{:else if field.type === 'richtext'}
								<RichTextEditor
									bind:value={formFields[field.name]}
									placeholder={field.placeholder || 'Write your content…'}
								/>
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
									<option value="">Select…</option>
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
								<ImageField
									bind:value={formFields[field.name]}
									placeholder={field.placeholder || 'https://… or upload'}
								/>
							{:else if field.type === 'json'}
								<textarea
									id="field-{field.name}"
									bind:value={formFields[field.name]}
									placeholder={'{"key": "value"}'}
									rows="5"
									class="json-field"></textarea>
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
				<div class="card">
					<h2 class="card-title">Tags</h2>
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
		</div>

		<div class="edit-sidebar">
			<!-- Status -->
			{#if contentType.settings?.hasDrafts !== false}
				<div class="card">
					<h2 class="card-title">Status</h2>
					<div class="form-group">
						<select id="form-status" bind:value={formStatus}>
							<option value="draft">Draft</option>
							<option value="published">Published</option>
							<option value="archived">Archived</option>
						</select>
					</div>
					<label class="checkbox-label">
						<input type="checkbox" bind:checked={formShowInCommandPalette} />
						<span>Show in command palette</span>
					</label>
				</div>
			{/if}

			<!-- SEO -->
			{#if contentType.settings?.hasSEO !== false}
				<div class="card">
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
									placeholder="Brief description for search results"
									rows="3"></textarea>
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

			<div class="save-actions">
				<a href={listUrl} class="btn btn-secondary btn-full">Cancel</a>
				<button class="btn btn-primary btn-full" on:click={handleSave} disabled={isLoading}>
					{isLoading ? 'Saving…' : isEdit ? 'Save Changes' : 'Create'}
				</button>
			</div>
		</div>
	</div>
</div>

<style>
	.edit-page {
		width: 100%;
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

	.item-meta {
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

	.edit-layout {
		display: grid;
		grid-template-columns: 1fr 280px;
		gap: var(--spacing-lg);
		align-items: start;
	}

	.edit-main {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-lg);
		min-width: 0;
	}

	.edit-sidebar {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-md);
		position: sticky;
		top: var(--spacing-lg);
	}

	.card {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: var(--spacing-lg);
	}

	.card-title {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-text);
		margin-bottom: var(--spacing-md);
	}

	.error-banner {
		background: color-mix(in srgb, var(--color-danger, #dc3545) 10%, var(--color-surface));
		border: 1px solid var(--color-danger, #dc3545);
		color: var(--color-danger, #dc3545);
		padding: var(--spacing-sm) var(--spacing-md);
		border-radius: var(--radius-md);
		font-size: 0.875rem;
		margin-bottom: var(--spacing-lg);
	}

	.form-group {
		margin-bottom: var(--spacing-md);
	}

	.form-group:last-child {
		margin-bottom: 0;
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
		background: var(--color-background);
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

	.json-field {
		font-family: var(--font-mono, 'Courier New', monospace);
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

	.tag-select {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-xs);
	}

	.tag-toggle {
		padding: 0.25rem var(--spacing-sm);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-background);
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
	}

	.section-toggle:hover {
		color: var(--color-primary);
	}

	.seo-fields {
		margin-top: var(--spacing-md);
	}

	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
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

	.btn-full {
		width: 100%;
	}

	.save-actions {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-sm);
	}

	@media (max-width: 768px) {
		.edit-layout {
			grid-template-columns: 1fr;
		}

		.edit-sidebar {
			position: static;
			order: -1;
		}

		.page-header {
			flex-direction: column;
		}

		.page-header-actions {
			padding-top: 0;
		}
	}
</style>
