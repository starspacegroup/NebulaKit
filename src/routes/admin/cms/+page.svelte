<!--
  Admin CMS Dashboard

  Shows all content types with links to manage content.
  Allows creating, editing, and deleting user-defined content types.
  System content types (from registry) can be edited but not deleted.
-->
<script lang="ts">
	import SharingMeta from '$lib/components/SharingMeta.svelte';
	import type { PageData } from './$types';

	export let data: PageData;

	$: contentTypes = data.contentTypes || [];

	// ─── Icon mapping ──────────────────────────────────────────────────────────
	const ICON_OPTIONS = [
		{ value: 'article', label: 'Article' },
		{ value: 'help-circle', label: 'Help Circle' },
		{ value: 'book', label: 'Book' },
		{ value: 'folder', label: 'Folder' },
		{ value: 'star', label: 'Star' },
		{ value: 'tag', label: 'Tag' },
		{ value: 'message', label: 'Message' },
		{ value: 'image', label: 'Image' },
		{ value: 'link', label: 'Link' },
		{ value: 'code', label: 'Code' },
		{ value: 'list', label: 'List' },
		{ value: 'document', label: 'Document' }
	];

	function getIconPath(icon: string): string {
		switch (icon) {
			case 'article':
				return 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8';
			case 'help-circle':
				return 'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3 M12 17h.01';
			case 'book':
				return 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20 M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z';
			case 'folder':
				return 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z';
			case 'star':
				return 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z';
			case 'tag':
				return 'M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z M7 7h.01';
			case 'message':
				return 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z';
			case 'image':
				return 'M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z M8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z M21 15l-5-5L5 21';
			case 'link':
				return 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71 M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71';
			case 'code':
				return 'M16 18l6-6-6-6 M8 6l-6 6 6 6';
			case 'list':
				return 'M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01';
			default:
				return 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6';
		}
	}

	// ─── Field type options ────────────────────────────────────────────────────
	const FIELD_TYPES = [
		{ value: 'text', label: 'Text' },
		{ value: 'textarea', label: 'Text Area' },
		{ value: 'richtext', label: 'Rich Text' },
		{ value: 'number', label: 'Number' },
		{ value: 'boolean', label: 'Boolean' },
		{ value: 'date', label: 'Date' },
		{ value: 'datetime', label: 'Date & Time' },
		{ value: 'select', label: 'Select' },
		{ value: 'multiselect', label: 'Multi Select' },
		{ value: 'image', label: 'Image URL' },
		{ value: 'url', label: 'URL' },
		{ value: 'email', label: 'Email' },
		{ value: 'json', label: 'JSON' },
		{ value: 'color', label: 'Color' }
	];

	// ─── Type editor state ─────────────────────────────────────────────────────
	interface FieldDef {
		name: string;
		label: string;
		type: string;
		required: boolean;
		placeholder: string;
		helpText: string;
		options: { label: string; value: string }[];
	}

	let showEditor = false;
	let editingTypeId: string | null = null;
	let editingIsSystem = false;
	let typeName = '';
	let typeSlug = '';
	let typeDescription = '';
	let typeIcon = 'document';
	let typeRoutePrefix = '';
	let typeHasDrafts = true;
	let typeHasTags = false;
	let typeHasSEO = true;
	let typeHasAuthor = true;
	let typeIsPublic = true;
	let typeFields: FieldDef[] = [];
	let saving = false;
	let errorMessage = '';
	let showDeleteConfirm = false;
	let deleting = false;

	// Auto-generate slug from name (only for new types)
	$: if (!editingTypeId && typeName) {
		typeSlug = typeName
			.toLowerCase()
			.trim()
			.replace(/[^\w\s-]/g, '')
			.replace(/\s+/g, '-')
			.replace(/-+/g, '-')
			.replace(/^-|-$/g, '');
	}

	function openNewTypeEditor() {
		editingTypeId = null;
		editingIsSystem = false;
		typeName = '';
		typeSlug = '';
		typeDescription = '';
		typeIcon = 'document';
		typeRoutePrefix = '';
		typeHasDrafts = true;
		typeHasTags = false;
		typeHasSEO = true;
		typeHasAuthor = true;
		typeIsPublic = true;
		typeFields = [];
		errorMessage = '';
		showDeleteConfirm = false;
		showEditor = true;
	}

	function openEditTypeEditor(ct: any) {
		editingTypeId = ct.id;
		editingIsSystem = ct.isSystem;
		typeName = ct.name;
		typeSlug = ct.slug;
		typeDescription = ct.description || '';
		typeIcon = ct.icon;
		typeRoutePrefix = ct.settings?.routePrefix || `/${ct.slug}`;
		typeHasDrafts = ct.settings?.hasDrafts !== false;
		typeHasTags = ct.settings?.hasTags === true;
		typeHasSEO = ct.settings?.hasSEO !== false;
		typeHasAuthor = ct.settings?.hasAuthor !== false;
		typeIsPublic = ct.settings?.isPublic !== false;
		typeFields = (ct.fields || []).map((f: any) => ({
			name: f.name || '',
			label: f.label || '',
			type: f.type || 'text',
			required: f.required === true,
			placeholder: f.placeholder || '',
			helpText: f.helpText || '',
			options: f.options || []
		}));
		errorMessage = '';
		showDeleteConfirm = false;
		showEditor = true;
	}

	function closeEditor() {
		showEditor = false;
		editingTypeId = null;
		errorMessage = '';
		showDeleteConfirm = false;
	}

	// ─── Field management ──────────────────────────────────────────────────────

	function addField() {
		typeFields = [
			...typeFields,
			{
				name: '',
				label: '',
				type: 'text',
				required: false,
				placeholder: '',
				helpText: '',
				options: []
			}
		];
	}

	function removeField(index: number) {
		typeFields = typeFields.filter((_, i) => i !== index);
	}

	function moveFieldUp(index: number) {
		if (index <= 0) return;
		const newFields = [...typeFields];
		[newFields[index - 1], newFields[index]] = [newFields[index], newFields[index - 1]];
		typeFields = newFields;
	}

	function moveFieldDown(index: number) {
		if (index >= typeFields.length - 1) return;
		const newFields = [...typeFields];
		[newFields[index], newFields[index + 1]] = [newFields[index + 1], newFields[index]];
		typeFields = newFields;
	}

	function autoGenerateFieldName(index: number) {
		const field = typeFields[index];
		if (field.label && !field.name) {
			typeFields[index].name = field.label
				.toLowerCase()
				.trim()
				.replace(/[^\w\s]/g, '')
				.replace(/\s+/g, '_');
		}
	}

	function addFieldOption(fieldIndex: number) {
		const field = typeFields[fieldIndex];
		field.options = [...field.options, { label: '', value: '' }];
		typeFields = [...typeFields];
	}

	function removeFieldOption(fieldIndex: number, optionIndex: number) {
		const field = typeFields[fieldIndex];
		field.options = field.options.filter((_: any, i: number) => i !== optionIndex);
		typeFields = [...typeFields];
	}

	// ─── Save / Delete ─────────────────────────────────────────────────────────

	async function saveType() {
		saving = true;
		errorMessage = '';

		try {
			const fields = typeFields.map((f, i) => ({
				name: f.name,
				label: f.label,
				type: f.type,
				required: f.required,
				placeholder: f.placeholder || undefined,
				helpText: f.helpText || undefined,
				options: f.type === 'select' || f.type === 'multiselect' ? f.options : undefined,
				sortOrder: i
			}));

			const settings = {
				hasDrafts: typeHasDrafts,
				hasTags: typeHasTags,
				hasSEO: typeHasSEO,
				hasAuthor: typeHasAuthor,
				routePrefix: typeRoutePrefix || `/${typeSlug}`,
				isPublic: typeIsPublic
			};

			const body: Record<string, any> = {
				name: typeName,
				slug: typeSlug,
				description: typeDescription || undefined,
				icon: typeIcon,
				fields,
				settings
			};

			let response: Response;
			if (editingTypeId) {
				response = await fetch(`/api/cms/types/${editingTypeId}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(body)
				});
			} else {
				response = await fetch('/api/cms/types', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(body)
				});
			}

			if (!response.ok) {
				const err = await response.json().catch(() => null);
				errorMessage = err?.message || `Failed to save content type (${response.status})`;
				return;
			}

			// Reload the page data
			const typesRes = await fetch('/api/cms/types');
			if (typesRes.ok) {
				const typesData = await typesRes.json();
				contentTypes = typesData.types || [];
			}

			closeEditor();
		} catch (err: any) {
			errorMessage = err?.message || 'An unexpected error occurred';
		} finally {
			saving = false;
		}
	}

	async function deleteType() {
		if (!editingTypeId) return;
		deleting = true;
		errorMessage = '';

		try {
			const response = await fetch(`/api/cms/types/${editingTypeId}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				const err = await response.json().catch(() => null);
				errorMessage = err?.message || `Failed to delete content type (${response.status})`;
				return;
			}

			// Reload the page data
			const typesRes = await fetch('/api/cms/types');
			if (typesRes.ok) {
				const typesData = await typesRes.json();
				contentTypes = typesData.types || [];
			}

			closeEditor();
		} catch (err: any) {
			errorMessage = err?.message || 'An unexpected error occurred';
		} finally {
			deleting = false;
			showDeleteConfirm = false;
		}
	}
</script>

<SharingMeta
	title="CMS - Admin"
	noindex={true}
/>

<div class="cms-dashboard">
	<div class="cms-dashboard-header">
		<div class="cms-header-row">
			<div>
				<h1>Content Management</h1>
				<p class="cms-dashboard-subtitle">Manage your content types and entries.</p>
			</div>
			<button class="btn-primary" on:click={openNewTypeEditor}>
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
				New Content Type
			</button>
		</div>
	</div>

	{#if contentTypes.length === 0}
		<div class="cms-empty-state">
			<p>No content types yet.</p>
			<p class="cms-help-text">Create a content type to start managing your content.</p>
		</div>
	{:else}
		<div class="cms-types-grid">
			{#each contentTypes as ct}
				<div class="cms-type-card">
					<a href="/admin/cms/{ct.slug}" class="cms-type-card-link">
						<div class="cms-type-card-icon">
							<svg
								width="28"
								height="28"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<path d={getIconPath(ct.icon)} />
							</svg>
						</div>
						<div class="cms-type-card-info">
							<h2>
								{ct.name}
								{#if ct.isSystem}
									<span class="cms-badge-system">System</span>
								{/if}
							</h2>
							{#if ct.description}
								<p>{ct.description}</p>
							{/if}
							<span class="cms-type-card-meta">
								{ct.fields.length} field{ct.fields.length !== 1 ? 's' : ''}
								{#if ct.settings?.routePrefix}
									&middot; {ct.settings.routePrefix}
								{/if}
							</span>
						</div>
						<div class="cms-type-card-arrow">
							<svg
								width="20"
								height="20"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<polyline points="9 18 15 12 9 6" />
							</svg>
						</div>
					</a>
					<button
						class="cms-type-card-edit"
						on:click|stopPropagation={() => openEditTypeEditor(ct)}
						title="Edit content type"
					>
						<svg
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<circle cx="12" cy="12" r="3" />
							<path
								d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
							/>
						</svg>
					</button>
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- ─── Content Type Editor Modal ─────────────────────────────────────────── -->
{#if showEditor}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div class="modal-overlay" on:click={closeEditor}>
		<div class="modal-content" on:click|stopPropagation>
			<div class="modal-header">
				<h2>{editingTypeId ? 'Edit' : 'New'} Content Type</h2>
				<button class="modal-close" on:click={closeEditor}>
					<svg
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<line x1="18" y1="6" x2="6" y2="18" />
						<line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				</button>
			</div>

			{#if errorMessage}
				<div class="editor-error">{errorMessage}</div>
			{/if}

			<div class="modal-body">
				<!-- Basic Info -->
				<section class="editor-section">
					<h3>Basic Information</h3>
					<div class="form-grid">
						<label class="form-field">
							<span>Name <span class="required">*</span></span>
							<input type="text" bind:value={typeName} placeholder="e.g. FAQ, Knowledge Base" />
						</label>
						<label class="form-field">
							<span>Slug</span>
							<input
								type="text"
								bind:value={typeSlug}
								placeholder="auto-generated"
								disabled={editingIsSystem}
							/>
						</label>
						<label class="form-field full-width">
							<span>Description</span>
							<input
								type="text"
								bind:value={typeDescription}
								placeholder="Brief description of this content type"
							/>
						</label>
						<label class="form-field">
							<span>Icon</span>
							<select bind:value={typeIcon}>
								{#each ICON_OPTIONS as opt}
									<option value={opt.value}>{opt.label}</option>
								{/each}
							</select>
						</label>
						<label class="form-field">
							<span>URL Prefix</span>
							<input type="text" bind:value={typeRoutePrefix} placeholder="/{typeSlug || 'slug'}" />
							<span class="form-hint">Public URL path, e.g. /blog or /faq</span>
						</label>
					</div>
				</section>

				<!-- Settings -->
				<section class="editor-section">
					<h3>Settings</h3>
					<div class="settings-grid">
						<label class="toggle-field">
							<input type="checkbox" bind:checked={typeHasDrafts} />
							<span>Draft/Publish workflow</span>
						</label>
						<label class="toggle-field">
							<input type="checkbox" bind:checked={typeHasTags} />
							<span>Tags support</span>
						</label>
						<label class="toggle-field">
							<input type="checkbox" bind:checked={typeHasSEO} />
							<span>SEO fields</span>
						</label>
						<label class="toggle-field">
							<input type="checkbox" bind:checked={typeHasAuthor} />
							<span>Track author</span>
						</label>
						<label class="toggle-field">
							<input type="checkbox" bind:checked={typeIsPublic} />
							<span>Publicly listable</span>
						</label>
					</div>
				</section>

				<!-- Field Builder -->
				<section class="editor-section">
					<div class="section-header">
						<h3>Custom Fields</h3>
						<button class="btn-secondary btn-sm" on:click={addField}>
							<svg
								width="14"
								height="14"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<line x1="12" y1="5" x2="12" y2="19" />
								<line x1="5" y1="12" x2="19" y2="12" />
							</svg>
							Add Field
						</button>
					</div>

					{#if typeFields.length === 0}
						<p class="fields-empty">No custom fields defined. Click "Add Field" to create one.</p>
					{:else}
						<div class="fields-list">
							{#each typeFields as field, i}
								<div class="field-card">
									<div class="field-card-header">
										<span class="field-number">#{i + 1}</span>
										<div class="field-card-actions">
											<button
												class="btn-icon"
												on:click={() => moveFieldUp(i)}
												disabled={i === 0}
												title="Move up">&#8593;</button
											>
											<button
												class="btn-icon"
												on:click={() => moveFieldDown(i)}
												disabled={i === typeFields.length - 1}
												title="Move down">&#8595;</button
											>
											<button
												class="btn-icon btn-icon-danger"
												on:click={() => removeField(i)}
												title="Remove field">&times;</button
											>
										</div>
									</div>
									<div class="field-card-body">
										<div class="form-grid">
											<label class="form-field">
												<span>Label <span class="required">*</span></span>
												<input
													type="text"
													bind:value={field.label}
													placeholder="e.g. Author Name"
													on:blur={() => autoGenerateFieldName(i)}
												/>
											</label>
											<label class="form-field">
												<span>Key <span class="required">*</span></span>
												<input type="text" bind:value={field.name} placeholder="e.g. author_name" />
											</label>
											<label class="form-field">
												<span>Type</span>
												<select bind:value={field.type}>
													{#each FIELD_TYPES as ft}
														<option value={ft.value}>{ft.label}</option>
													{/each}
												</select>
											</label>
											<label class="toggle-field field-required">
												<input type="checkbox" bind:checked={field.required} />
												<span>Required</span>
											</label>
											<label class="form-field">
												<span>Placeholder</span>
												<input
													type="text"
													bind:value={field.placeholder}
													placeholder="Placeholder text"
												/>
											</label>
											<label class="form-field">
												<span>Help Text</span>
												<input
													type="text"
													bind:value={field.helpText}
													placeholder="Help text below field"
												/>
											</label>
										</div>

										<!-- Select/Multiselect Options -->
										{#if field.type === 'select' || field.type === 'multiselect'}
											<div class="field-options">
												<div class="field-options-header">
													<span class="field-options-label">Options</span>
													<button class="btn-secondary btn-xs" on:click={() => addFieldOption(i)}>
														+ Option
													</button>
												</div>
												{#each field.options as opt, oi}
													<div class="field-option-row">
														<input type="text" bind:value={opt.label} placeholder="Label" />
														<input type="text" bind:value={opt.value} placeholder="Value" />
														<button
															class="btn-icon btn-icon-danger"
															on:click={() => removeFieldOption(i, oi)}>&times;</button
														>
													</div>
												{/each}
											</div>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</section>
			</div>

			<div class="modal-footer">
				{#if editingTypeId && !editingIsSystem}
					{#if showDeleteConfirm}
						<div class="delete-confirm">
							<span>Delete this type and all its content?</span>
							<button class="btn-danger btn-sm" on:click={deleteType} disabled={deleting}>
								{deleting ? 'Deleting...' : 'Yes, Delete'}
							</button>
							<button class="btn-secondary btn-sm" on:click={() => (showDeleteConfirm = false)}
								>Cancel</button
							>
						</div>
					{:else}
						<button class="btn-danger-outline btn-sm" on:click={() => (showDeleteConfirm = true)}
							>Delete</button
						>
					{/if}
				{/if}
				<div class="modal-footer-right">
					<button class="btn-secondary" on:click={closeEditor}>Cancel</button>
					<button class="btn-primary" on:click={saveType} disabled={saving || !typeName.trim()}>
						{saving ? 'Saving...' : editingTypeId ? 'Save Changes' : 'Create Type'}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	/* ─── Dashboard Layout ──────────────────────────────────────────────────── */
	.cms-dashboard {
		max-width: 800px;
	}

	.cms-dashboard-header {
		margin-bottom: var(--spacing-2xl);
	}

	.cms-header-row {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--spacing-md);
	}

	.cms-dashboard-header h1 {
		font-size: 1.75rem;
		font-weight: 700;
		color: var(--color-text);
		margin-bottom: var(--spacing-sm);
	}

	.cms-dashboard-subtitle {
		color: var(--color-text-secondary);
		font-size: 0.9375rem;
	}

	.cms-empty-state {
		text-align: center;
		padding: var(--spacing-2xl);
		border: 1px dashed var(--color-border);
		border-radius: var(--radius-lg);
		color: var(--color-text-secondary);
	}

	.cms-help-text {
		font-size: 0.875rem;
		margin-top: var(--spacing-sm);
	}

	/* ─── Content Type Cards ────────────────────────────────────────────────── */
	.cms-types-grid {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-md);
	}

	.cms-type-card {
		position: relative;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		transition:
			border-color 0.2s ease,
			box-shadow 0.2s ease;
	}

	.cms-type-card:hover {
		border-color: var(--color-primary);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
	}

	.cms-type-card-link {
		display: flex;
		align-items: center;
		gap: var(--spacing-lg);
		padding: var(--spacing-lg);
		padding-right: 3.5rem;
		text-decoration: none;
		color: var(--color-text);
	}

	.cms-type-card-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 48px;
		height: 48px;
		background: var(--color-background);
		border-radius: var(--radius-md);
		color: var(--color-primary);
		flex-shrink: 0;
	}

	.cms-type-card-info {
		flex: 1;
	}

	.cms-type-card-info h2 {
		font-size: 1.125rem;
		font-weight: 600;
		margin-bottom: var(--spacing-xs);
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
	}

	.cms-type-card-info p {
		font-size: 0.875rem;
		color: var(--color-text-secondary);
		margin-bottom: var(--spacing-xs);
	}

	.cms-type-card-meta {
		font-size: 0.75rem;
		color: var(--color-text-secondary);
	}

	.cms-type-card-arrow {
		color: var(--color-text-secondary);
		flex-shrink: 0;
	}

	.cms-type-card-edit {
		position: absolute;
		top: var(--spacing-sm);
		right: var(--spacing-sm);
		background: none;
		border: none;
		padding: var(--spacing-xs);
		cursor: pointer;
		color: var(--color-text-secondary);
		border-radius: var(--radius-sm);
		transition:
			color 0.15s ease,
			background-color 0.15s ease;
	}

	.cms-type-card-edit:hover {
		color: var(--color-primary);
		background: var(--color-background);
	}

	.cms-badge-system {
		font-size: 0.625rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 0.125em 0.5em;
		background: var(--color-background);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		color: var(--color-text-secondary);
	}

	/* ─── Buttons ───────────────────────────────────────────────────────────── */
	.btn-primary {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-xs);
		padding: var(--spacing-sm) var(--spacing-lg);
		background: var(--color-primary);
		color: var(--color-background);
		border: none;
		border-radius: var(--radius-md);
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: opacity 0.15s ease;
		white-space: nowrap;
	}

	.btn-primary:hover:not(:disabled) {
		opacity: 0.9;
	}

	.btn-primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-secondary {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-xs);
		padding: var(--spacing-sm) var(--spacing-md);
		background: var(--color-surface);
		color: var(--color-text);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		font-size: 0.875rem;
		cursor: pointer;
		transition: border-color 0.15s ease;
	}

	.btn-secondary:hover {
		border-color: var(--color-text-secondary);
	}

	.btn-sm {
		padding: var(--spacing-xs) var(--spacing-sm);
		font-size: 0.8125rem;
	}

	.btn-xs {
		padding: 0.125rem var(--spacing-xs);
		font-size: 0.75rem;
	}

	.btn-danger-outline {
		display: inline-flex;
		align-items: center;
		padding: var(--spacing-xs) var(--spacing-sm);
		background: none;
		color: var(--color-error, #dc2626);
		border: 1px solid var(--color-error, #dc2626);
		border-radius: var(--radius-md);
		font-size: 0.8125rem;
		cursor: pointer;
		transition: background-color 0.15s ease;
	}

	.btn-danger-outline:hover {
		background: var(--color-error, #dc2626);
		color: var(--color-background);
	}

	.btn-danger {
		display: inline-flex;
		align-items: center;
		padding: var(--spacing-xs) var(--spacing-sm);
		background: var(--color-error, #dc2626);
		color: var(--color-background);
		border: none;
		border-radius: var(--radius-md);
		font-size: 0.8125rem;
		cursor: pointer;
	}

	.btn-danger:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-icon {
		background: none;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		padding: 0.125rem 0.375rem;
		cursor: pointer;
		color: var(--color-text-secondary);
		font-size: 0.875rem;
		line-height: 1;
	}

	.btn-icon:hover:not(:disabled) {
		background: var(--color-surface);
		color: var(--color-text);
	}

	.btn-icon:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	.btn-icon-danger:hover:not(:disabled) {
		color: var(--color-error, #dc2626);
		border-color: var(--color-error, #dc2626);
	}

	/* ─── Modal ─────────────────────────────────────────────────────────────── */
	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding: var(--spacing-xl);
		overflow-y: auto;
		z-index: 1000;
	}

	.modal-content {
		background: var(--color-background);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		width: 100%;
		max-width: 720px;
		margin: var(--spacing-xl) 0;
		display: flex;
		flex-direction: column;
		max-height: calc(100vh - 4rem);
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--spacing-lg);
		border-bottom: 1px solid var(--color-border);
		flex-shrink: 0;
	}

	.modal-header h2 {
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--color-text);
	}

	.modal-close {
		background: none;
		border: none;
		padding: var(--spacing-xs);
		cursor: pointer;
		color: var(--color-text-secondary);
		border-radius: var(--radius-sm);
	}

	.modal-close:hover {
		color: var(--color-text);
	}

	.modal-body {
		padding: var(--spacing-lg);
		overflow-y: auto;
		flex: 1;
	}

	.modal-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--spacing-md) var(--spacing-lg);
		border-top: 1px solid var(--color-border);
		flex-shrink: 0;
		gap: var(--spacing-sm);
	}

	.modal-footer-right {
		display: flex;
		gap: var(--spacing-sm);
		margin-left: auto;
	}

	/* ─── Editor Sections ───────────────────────────────────────────────────── */
	.editor-section {
		margin-bottom: var(--spacing-xl);
	}

	.editor-section h3 {
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--color-text);
		margin-bottom: var(--spacing-md);
	}

	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: var(--spacing-md);
	}

	.section-header h3 {
		margin-bottom: 0;
	}

	.editor-error {
		margin: var(--spacing-md) var(--spacing-lg) 0;
		padding: var(--spacing-sm) var(--spacing-md);
		background: var(--color-error, #dc2626);
		color: var(--color-background);
		border-radius: var(--radius-md);
		font-size: 0.875rem;
	}

	/* ─── Form Fields ───────────────────────────────────────────────────────── */
	.form-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--spacing-md);
	}

	.form-field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.form-field span {
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--color-text-secondary);
	}

	.form-field input,
	.form-field select {
		padding: var(--spacing-sm);
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		color: var(--color-text);
		font-size: 0.875rem;
	}

	.form-field input:focus,
	.form-field select:focus {
		outline: none;
		border-color: var(--color-primary);
	}

	.form-field input:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.form-hint {
		font-size: 0.75rem !important;
		font-weight: 400 !important;
		color: var(--color-text-secondary) !important;
	}

	.full-width {
		grid-column: 1 / -1;
	}

	.required {
		color: var(--color-error, #dc2626) !important;
	}

	/* ─── Settings ──────────────────────────────────────────────────────────── */
	.settings-grid {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-md) var(--spacing-xl);
	}

	.toggle-field {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		cursor: pointer;
	}

	.toggle-field span {
		font-size: 0.875rem;
		color: var(--color-text);
	}

	.toggle-field input[type='checkbox'] {
		accent-color: var(--color-primary);
	}

	.field-required {
		align-self: end;
		padding-bottom: var(--spacing-sm);
	}

	/* ─── Field Builder ─────────────────────────────────────────────────────── */
	.fields-empty {
		text-align: center;
		padding: var(--spacing-lg);
		color: var(--color-text-secondary);
		font-size: 0.875rem;
		border: 1px dashed var(--color-border);
		border-radius: var(--radius-md);
	}

	.fields-list {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-md);
	}

	.field-card {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		overflow: hidden;
	}

	.field-card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--spacing-sm) var(--spacing-md);
		background: var(--color-surface);
		border-bottom: 1px solid var(--color-border);
	}

	.field-number {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-text-secondary);
	}

	.field-card-actions {
		display: flex;
		gap: 0.25rem;
	}

	.field-card-body {
		padding: var(--spacing-md);
	}

	/* ─── Field Options (Select/Multiselect) ────────────────────────────────── */
	.field-options {
		margin-top: var(--spacing-md);
		padding-top: var(--spacing-md);
		border-top: 1px solid var(--color-border);
	}

	.field-options-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: var(--spacing-sm);
	}

	.field-options-label {
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--color-text-secondary);
	}

	.field-option-row {
		display: flex;
		gap: var(--spacing-sm);
		margin-bottom: var(--spacing-xs);
	}

	.field-option-row input {
		flex: 1;
		padding: var(--spacing-xs) var(--spacing-sm);
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		color: var(--color-text);
		font-size: 0.8125rem;
	}

	.field-option-row input:focus {
		outline: none;
		border-color: var(--color-primary);
	}

	/* ─── Delete Confirm ────────────────────────────────────────────────────── */
	.delete-confirm {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		font-size: 0.8125rem;
		color: var(--color-error, #dc2626);
	}

	/* ─── Responsive ────────────────────────────────────────────────────────── */
	@media (max-width: 640px) {
		.cms-header-row {
			flex-direction: column;
		}

		.form-grid {
			grid-template-columns: 1fr;
		}

		.modal-overlay {
			padding: var(--spacing-sm);
		}

		.modal-content {
			margin: var(--spacing-sm) 0;
		}
	}
</style>
