<script lang="ts">
	import type { PageData } from './$types';

	export let data: PageData;

	let keys = data.keys || [];
	let showForm = false;
	let editingKey: any = null;
	let formData = {
		name: '',
		provider: 'github',
		type: 'oauth',
		clientId: '',
		clientSecret: ''
	};
	let errors: Record<string, string> = {};
	let visibleKeys: Record<string, boolean> = {};
	let showDeleteConfirm = false;
	let deletingKeyId: string | null = null;

	const providers = [
		{ value: 'github', label: 'GitHub' },
		{ value: 'google', label: 'Google' },
		{ value: 'microsoft', label: 'Microsoft' },
		{ value: 'custom', label: 'Custom' }
	];

	function openAddForm() {
		showForm = true;
		editingKey = null;
		formData = {
			name: '',
			provider: 'github',
			type: 'oauth',
			clientId: '',
			clientSecret: ''
		};
		errors = {};
	}

	function openEditForm(key: any) {
		// Prevent editing setup keys
		if (key.isSetupKey) {
			return;
		}
		showForm = true;
		editingKey = key;
		formData = {
			name: key.name,
			provider: key.provider,
			type: key.type,
			clientId: key.clientId || '',
			clientSecret: ''
		};
		errors = {};
	}

	function closeForm() {
		showForm = false;
		editingKey = null;
		formData = {
			name: '',
			provider: 'github',
			type: 'oauth',
			clientId: '',
			clientSecret: ''
		};
		errors = {};
	}

	function validateForm() {
		errors = {};

		if (!formData.name.trim()) {
			errors.name = 'Key name is required';
		}

		if (!formData.clientId.trim()) {
			errors.clientId = 'Client ID is required';
		}

		if (!editingKey && !formData.clientSecret.trim()) {
			errors.clientSecret = 'Client Secret is required';
		}

		return Object.keys(errors).length === 0;
	}

	async function saveKey() {
		if (!validateForm()) {
			return;
		}

		try {
			const url = editingKey ? `/api/admin/auth-keys/${editingKey.id}` : '/api/admin/auth-keys';
			const method = editingKey ? 'PUT' : 'POST';

			const response = await fetch(url, {
				method,
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(formData)
			});

			if (response.ok) {
				const result = await response.json();
				if (editingKey) {
					keys = keys.map((k: any) => (k.id === editingKey.id ? { ...k, ...formData } : k));
				} else {
					keys = [...keys, result.key];
				}
				closeForm();
			} else {
				errors.submit = 'Failed to save key';
			}
		} catch (error) {
			errors.submit = 'An error occurred while saving';
		}
	}

	function openDeleteConfirm(keyId: string) {
		// Prevent deleting setup keys
		const key = keys.find((k: any) => k.id === keyId);
		if (key?.isSetupKey) {
			return;
		}
		deletingKeyId = keyId;
		showDeleteConfirm = true;
	}

	function closeDeleteConfirm() {
		deletingKeyId = null;
		showDeleteConfirm = false;
	}

	async function confirmDelete() {
		if (!deletingKeyId) return;

		try {
			const response = await fetch(`/api/admin/auth-keys/${deletingKeyId}`, {
				method: 'DELETE'
			});

			if (response.ok) {
				keys = keys.filter((k: any) => k.id !== deletingKeyId);
				closeDeleteConfirm();
			}
		} catch (error) {
			console.error('Failed to delete key:', error);
		}
	}

	function toggleKeyVisibility(keyId: string) {
		visibleKeys[keyId] = !visibleKeys[keyId];
	}

	function maskValue(value: string): string {
		return '••••••';
	}
</script>

<svelte:head>
	<title>Authentication Keys - Admin - NebulaKit</title>
</svelte:head>

<div class="auth-keys-page">
	<header class="page-header">
		<h1>Authentication Keys</h1>
		<p class="page-description">Manage OAuth providers and API keys for authentication services.</p>
	</header>

	<div class="page-actions">
		<button class="btn btn-primary" on:click={openAddForm}>
			<svg
				width="20"
				height="20"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<path d="M12 5v14m-7-7h14" />
			</svg>
			Add Key
		</button>
	</div>

	{#if keys.length === 0}
		<div class="empty-state">
			<svg
				width="64"
				height="64"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
			>
				<path
					d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"
				/>
			</svg>
			<h3>No authentication keys configured</h3>
			<p>Add your first authentication key to get started.</p>
		</div>
	{:else}
		<div class="keys-list">
			{#each keys as key (key.id)}
				<div class="key-card" class:setup-key={key.isSetupKey}>
					<div class="key-header">
						<div class="key-info">
							<div class="key-title-row">
								<h3>{key.name}</h3>
								{#if key.isSetupKey}
									<span class="setup-badge">Setup Key</span>
								{/if}
							</div>
							<span class="key-provider">{key.provider}</span>
						</div>
						<div class="key-actions">
							<button
								class="btn-icon"
								on:click={() => openEditForm(key)}
								aria-label={`Edit ${key.name}`}
								disabled={key.isSetupKey}
								title={key.isSetupKey ? 'Setup keys cannot be edited' : ''}
							>
								<svg
									width="20"
									height="20"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
								>
									<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
									<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
								</svg>
							</button>
							<button
								class="btn-icon btn-danger"
								on:click={() => openDeleteConfirm(key.id)}
								aria-label={`Delete ${key.name}`}
								disabled={key.isSetupKey}
								title={key.isSetupKey ? 'Setup keys cannot be deleted' : ''}
							>
								<svg
									width="20"
									height="20"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
								>
									<path
										d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
									/>
								</svg>
							</button>
						</div>
					</div>
					{#if key.clientId}
						<div class="key-field">
							<div class="label">Client ID</div>
							<div class="key-value">
								<span>{visibleKeys[key.id] ? key.clientId : maskValue(key.clientId)}</span>
								<button
									class="btn-icon-sm"
									on:click={() => toggleKeyVisibility(key.id)}
									aria-label={visibleKeys[key.id] ? 'Hide value' : 'Show value'}
								>
									{#if visibleKeys[key.id]}
										<svg
											width="16"
											height="16"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
										>
											<path
												d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22"
											/>
										</svg>
									{:else}
										<svg
											width="16"
											height="16"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
										>
											<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
											<circle cx="12" cy="12" r="3" />
										</svg>
									{/if}
								</button>
							</div>
						</div>
					{/if}
					<div class="key-meta">
						<span>Added {new Date(key.createdAt).toLocaleDateString()}</span>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

{#if showForm}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div class="modal-overlay" on:click={closeForm}>
		<!-- svelte-ignore a11y-click-events-have-key-events -->
		<!-- svelte-ignore a11y-no-static-element-interactions -->
		<div class="modal" on:click|stopPropagation>
			<div class="modal-header">
				<h2>{editingKey ? 'Edit Key' : 'Add New Key'}</h2>
				<button class="btn-close" on:click={closeForm} aria-label="Close">
					<svg
						width="24"
						height="24"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<path d="M18 6L6 18M6 6l12 12" />
					</svg>
				</button>
			</div>
			<div class="modal-body">
				<div class="form-group">
					<label for="key-name">Key Name</label>
					<input
						id="key-name"
						type="text"
						bind:value={formData.name}
						class:error={errors.name}
						placeholder="e.g., GitHub OAuth"
					/>
					{#if errors.name}
						<span class="error-message">{errors.name}</span>
					{/if}
				</div>

				<div class="form-group">
					<label for="provider">Provider</label>
					<select id="provider" bind:value={formData.provider}>
						{#each providers as provider}
							<option value={provider.value}>{provider.label}</option>
						{/each}
					</select>
				</div>

				<div class="form-group">
					<label for="client-id">Client ID</label>
					<input
						id="client-id"
						type="text"
						bind:value={formData.clientId}
						class:error={errors.clientId}
						placeholder="Enter client ID"
					/>
					{#if errors.clientId}
						<span class="error-message">{errors.clientId}</span>
					{/if}
				</div>

				<div class="form-group">
					<label for="client-secret">Client Secret</label>
					<input
						id="client-secret"
						type="password"
						bind:value={formData.clientSecret}
						class:error={errors.clientSecret}
						placeholder={editingKey ? 'Leave blank to keep existing' : 'Enter client secret'}
					/>
					{#if errors.clientSecret}
						<span class="error-message">{errors.clientSecret}</span>
					{/if}
				</div>

				{#if errors.submit}
					<div class="error-message">{errors.submit}</div>
				{/if}
			</div>
			<div class="modal-footer">
				<button class="btn btn-secondary" on:click={closeForm}>Cancel</button>
				<button class="btn btn-primary" on:click={saveKey}>Save Key</button>
			</div>
		</div>
	</div>
{/if}

{#if showDeleteConfirm}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div class="modal-overlay" on:click={closeDeleteConfirm}>
		<!-- svelte-ignore a11y-click-events-have-key-events -->
		<!-- svelte-ignore a11y-no-static-element-interactions -->
		<div class="modal modal-sm" on:click|stopPropagation>
			<div class="modal-header">
				<h2>Confirm Deletion</h2>
			</div>
			<div class="modal-body">
				<p>
					Are you sure you want to delete this authentication key? This action cannot be undone.
				</p>
			</div>
			<div class="modal-footer">
				<button class="btn btn-secondary" on:click={closeDeleteConfirm}>Cancel</button>
				<button class="btn btn-danger" on:click={confirmDelete}>Confirm</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.auth-keys-page {
		max-width: 1000px;
	}

	.page-header {
		margin-bottom: var(--spacing-2xl);
	}

	.page-header h1 {
		font-size: 2rem;
		font-weight: 700;
		color: var(--color-text);
		margin-bottom: var(--spacing-sm);
	}

	.page-description {
		color: var(--color-text-secondary);
		font-size: 1.125rem;
	}

	.page-actions {
		margin-bottom: var(--spacing-xl);
	}

	.btn {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-sm);
		padding: var(--spacing-sm) var(--spacing-md);
		border-radius: var(--radius-md);
		font-weight: 500;
		border: 1px solid transparent;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.btn-primary {
		background: var(--color-primary);
		color: var(--color-background);
	}

	.btn-primary:hover {
		opacity: 0.9;
	}

	.btn-secondary {
		background: var(--color-surface);
		color: var(--color-text);
		border-color: var(--color-border);
	}

	.btn-secondary:hover {
		background: var(--color-background);
	}

	.btn-danger {
		background: #ef4444;
		color: white;
	}

	.btn-danger:hover {
		background: #dc2626;
	}

	.btn-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border-radius: var(--radius-md);
		background: transparent;
		border: none;
		cursor: pointer;
		color: var(--color-text-secondary);
		transition: all var(--transition-fast);
	}

	.btn-icon:hover:not(:disabled) {
		background: var(--color-surface);
		color: var(--color-text);
	}

	.btn-icon.btn-danger:hover:not(:disabled) {
		background: #fef2f2;
		color: #ef4444;
	}

	.btn-icon:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.btn-icon-sm {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: var(--radius-sm);
		background: transparent;
		border: none;
		cursor: pointer;
		color: var(--color-text-secondary);
		transition: all var(--transition-fast);
	}

	.btn-icon-sm:hover {
		background: var(--color-surface);
		color: var(--color-text);
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: var(--spacing-4xl);
		text-align: center;
		color: var(--color-text-secondary);
	}

	.empty-state svg {
		margin-bottom: var(--spacing-lg);
		opacity: 0.5;
	}

	.empty-state h3 {
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--color-text);
		margin-bottom: var(--spacing-sm);
	}

	.keys-list {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-md);
	}

	.key-card {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: var(--spacing-lg);
	}

	.key-card.setup-key {
		border-color: var(--color-primary);
		border-width: 2px;
	}

	.key-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: var(--spacing-md);
	}

	.key-title-row {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		margin-bottom: var(--spacing-xs);
	}

	.key-info h3 {
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--color-text);
		margin-bottom: 0;
	}

	.setup-badge {
		display: inline-block;
		padding: 2px 8px;
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
		font-weight: 600;
		background: var(--color-primary);
		color: var(--color-background);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.key-provider {
		display: inline-block;
		padding: 2px 8px;
		border-radius: var(--radius-sm);
		font-size: 0.875rem;
		background: var(--color-background);
		color: var(--color-text-secondary);
		text-transform: capitalize;
	}

	.key-actions {
		display: flex;
		gap: var(--spacing-xs);
	}

	.key-field {
		margin-bottom: var(--spacing-md);
	}

	.key-field label,
	.key-field .label {
		display: block;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-text-secondary);
		margin-bottom: var(--spacing-xs);
	}

	.key-value {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		padding: var(--spacing-sm);
		background: var(--color-background);
		border-radius: var(--radius-md);
		font-family: monospace;
		font-size: 0.875rem;
	}

	.key-value span {
		flex: 1;
	}

	.key-meta {
		font-size: 0.875rem;
		color: var(--color-text-secondary);
	}

	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.modal {
		background: var(--color-surface);
		border-radius: var(--radius-lg);
		width: 90%;
		max-width: 500px;
		max-height: 90vh;
		overflow: auto;
	}

	.modal-sm {
		max-width: 400px;
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--spacing-lg);
		border-bottom: 1px solid var(--color-border);
	}

	.modal-header h2 {
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--color-text);
	}

	.btn-close {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: var(--radius-md);
		background: transparent;
		border: none;
		cursor: pointer;
		color: var(--color-text-secondary);
		transition: all var(--transition-fast);
	}

	.btn-close:hover {
		background: var(--color-background);
		color: var(--color-text);
	}

	.modal-body {
		padding: var(--spacing-lg);
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: var(--spacing-sm);
		padding: var(--spacing-lg);
		border-top: 1px solid var(--color-border);
	}

	.form-group {
		margin-bottom: var(--spacing-md);
	}

	.form-group label {
		display: block;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-text);
		margin-bottom: var(--spacing-xs);
	}

	.form-group input,
	.form-group select {
		width: 100%;
		padding: var(--spacing-sm);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-background);
		color: var(--color-text);
		font-size: 1rem;
	}

	.form-group input:focus,
	.form-group select:focus {
		outline: none;
		border-color: var(--color-primary);
	}

	.form-group input.error {
		border-color: #ef4444;
	}

	.error-message {
		display: block;
		margin-top: var(--spacing-xs);
		font-size: 0.875rem;
		color: #ef4444;
	}
</style>
