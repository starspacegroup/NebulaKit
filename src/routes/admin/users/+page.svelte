<script lang="ts">
	import type { PageData } from './$types';

	export let data: PageData;

	let users = data.users || [];
	let searchQuery = '';
	let searchResults: any[] = [];
	let isSearching = false;
	let showInviteModal = false;
	let selectedUser: any = null;
	let inviteEmail = '';
	let errors: Record<string, string> = {};
	let searchTimeout: any = null;

	// Debounced search
	async function handleSearch() {
		if (searchTimeout) {
			clearTimeout(searchTimeout);
		}

		if (searchQuery.length < 2) {
			searchResults = [];
			return;
		}

		searchTimeout = setTimeout(async () => {
			isSearching = true;
			try {
				const response = await fetch(
					`/api/admin/users/search?q=${encodeURIComponent(searchQuery)}`
				);
				if (response.ok) {
					const data = await response.json();
					searchResults = data.users || [];
				}
			} catch (error) {
				console.error('Search failed:', error);
			} finally {
				isSearching = false;
			}
		}, 300);
	}

	function openInviteModal(user: any) {
		selectedUser = user;
		inviteEmail = '';
		errors = {};
		showInviteModal = true;
	}

	function closeInviteModal() {
		showInviteModal = false;
		selectedUser = null;
		inviteEmail = '';
		errors = {};
	}

	async function inviteUser() {
		errors = {};

		if (!inviteEmail || !inviteEmail.includes('@')) {
			errors.email = 'Valid email is required';
			return;
		}

		if (!selectedUser) {
			return;
		}

		try {
			const response = await fetch('/api/admin/users', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					githubLogin: selectedUser.login,
					email: inviteEmail
				})
			});

			if (response.ok) {
				const result = await response.json();
				// Reload users
				const usersResponse = await fetch('/api/admin/users');
				if (usersResponse.ok) {
					const usersData = await usersResponse.json();
					users = usersData.users || [];
				}
				closeInviteModal();
				searchQuery = '';
				searchResults = [];
			} else {
				const errorData = await response.json();
				errors.general = errorData.message || 'Failed to invite user';
			}
		} catch (error) {
			console.error('Invite failed:', error);
			errors.general = 'Failed to invite user';
		}
	}

	async function toggleAdmin(userId: string, currentStatus: boolean) {
		if (!confirm(`Are you sure you want to ${currentStatus ? 'demote' : 'promote'} this user?`)) {
			return;
		}

		try {
			const response = await fetch(`/api/admin/users/${userId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ isAdmin: !currentStatus })
			});

			if (response.ok) {
				// Reload users
				const usersResponse = await fetch('/api/admin/users');
				if (usersResponse.ok) {
					const usersData = await usersResponse.json();
					users = usersData.users || [];
				}
			} else {
				const errorData = await response.json();
				alert(errorData.message || 'Failed to update user');
			}
		} catch (error) {
			console.error('Update failed:', error);
			alert('Failed to update user');
		}
	}

	async function deleteUser(userId: string, userName: string) {
		if (!confirm(`Are you sure you want to delete ${userName}? This action cannot be undone.`)) {
			return;
		}

		try {
			const response = await fetch(`/api/admin/users/${userId}`, {
				method: 'DELETE'
			});

			if (response.ok) {
				// Reload users
				const usersResponse = await fetch('/api/admin/users');
				if (usersResponse.ok) {
					const usersData = await usersResponse.json();
					users = usersData.users || [];
				}
			} else {
				const errorData = await response.json();
				alert(errorData.message || 'Failed to delete user');
			}
		} catch (error) {
			console.error('Delete failed:', error);
			alert('Failed to delete user');
		}
	}

	function formatDate(dateString: string) {
		return new Date(dateString).toLocaleDateString();
	}
</script>

<div class="users-page">
	<header class="page-header">
		<h1>User Management</h1>
		<p class="page-description">Manage users and their admin permissions.</p>
	</header>

	<div class="search-section">
		<div class="search-box">
			<label for="github-search">Invite GitHub User</label>
			<div class="search-input-wrapper">
				<svg
					class="search-icon"
					fill="none"
					height="20"
					stroke="currentColor"
					stroke-width="2"
					viewBox="0 0 24 24"
					width="20"
				>
					<circle cx="11" cy="11" r="8" />
					<path d="m21 21-4.35-4.35" />
				</svg>
				<input
					id="github-search"
					type="text"
					bind:value={searchQuery}
					on:input={handleSearch}
					placeholder="Search GitHub username..."
					class="search-input"
				/>
				{#if isSearching}
					<span class="loading-indicator">Searching...</span>
				{/if}
			</div>
		</div>

		{#if searchResults.length > 0}
			<div class="search-results">
				{#each searchResults as result}
					<button class="search-result-item" on:click={() => openInviteModal(result)}>
						<img src={result.avatar_url} alt={result.login} class="avatar" />
						<div class="user-info">
							<span class="username">{result.login}</span>
							<span class="user-id">ID: {result.id}</span>
						</div>
						<svg
							class="plus-icon"
							fill="none"
							height="20"
							stroke="currentColor"
							stroke-width="2"
							viewBox="0 0 24 24"
							width="20"
						>
							<path d="M12 5v14m-7-7h14" />
						</svg>
					</button>
				{/each}
			</div>
		{/if}
	</div>

	<div class="users-list">
		<h2>Registered Users ({users.length})</h2>

		{#if users.length === 0}
			<div class="empty-state">
				<svg
					fill="none"
					height="64"
					stroke="currentColor"
					stroke-width="1.5"
					viewBox="0 0 24 24"
					width="64"
				>
					<path
						d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2m7-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm8 0a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"
					/>
				</svg>
				<h3>No users yet</h3>
				<p>Invite users by searching for their GitHub username above.</p>
			</div>
		{:else}
			<div class="users-table">
				<table>
					<thead>
						<tr>
							<th>User</th>
							<th>GitHub</th>
							<th>Role</th>
							<th>Joined</th>
							<th>Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each users as user}
							<tr>
								<td>
									<div class="user-cell">
										{#if user.github_avatar_url}
											<img src={user.github_avatar_url} alt={user.name || 'User'} class="avatar" />
										{:else}
											<div class="avatar-placeholder">
												{(user.name || user.email).charAt(0).toUpperCase()}
											</div>
										{/if}
										<span>{user.name || 'Pending'}</span>
									</div>
								</td>
								<td>
									{#if user.github_login}
										<a
											href="https://github.com/{user.github_login}"
											target="_blank"
											rel="noopener noreferrer"
											class="github-link"
										>
											@{user.github_login}
										</a>
									{:else}
										<span class="pending-status">Not connected</span>
									{/if}
								</td>
								<td>
									{#if user.is_admin}
										<span class="badge badge-admin">Admin</span>
									{:else}
										<span class="badge badge-user">User</span>
									{/if}
								</td>
								<td>{formatDate(user.created_at)}</td>
								<td>
									<div class="actions">
										<button
											class="btn-icon"
											class:disabled={user.id === data.user.id}
											disabled={user.id === data.user.id}
											on:click={() => toggleAdmin(user.id, user.is_admin)}
											title={user.id === data.user.id
												? 'Cannot modify your own role'
												: user.is_admin
													? 'Demote from admin'
													: 'Promote to admin'}
											aria-label={user.is_admin ? 'Demote from admin' : 'Promote to admin'}
										>
											{#if user.is_admin}
												<svg
													fill="none"
													height="18"
													stroke="currentColor"
													stroke-width="2"
													viewBox="0 0 24 24"
													width="18"
												>
													<path d="M17 11l-5 5-5-5m5-7v12" />
												</svg>
											{:else}
												<svg
													fill="none"
													height="18"
													stroke="currentColor"
													stroke-width="2"
													viewBox="0 0 24 24"
													width="18"
												>
													<path d="M7 13l5-5 5 5m-5 7V8" />
												</svg>
											{/if}
										</button>
										<button
											class="btn-icon btn-danger"
											class:disabled={user.id === data.user.id}
											disabled={user.id === data.user.id}
											on:click={() => deleteUser(user.id, user.name || user.email)}
											title={user.id === data.user.id
												? 'Cannot delete your own account'
												: 'Delete user'}
											aria-label="Delete user"
										>
											<svg
												fill="none"
												height="18"
												stroke="currentColor"
												stroke-width="2"
												viewBox="0 0 24 24"
												width="18"
											>
												<path
													d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
												/>
											</svg>
										</button>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</div>

{#if showInviteModal}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div class="modal-overlay" on:click={closeInviteModal}>
		<!-- svelte-ignore a11y-click-events-have-key-events -->
		<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
		<div class="modal" on:click|stopPropagation role="dialog" aria-modal="true">
			<div class="modal-header">
				<h2>Invite GitHub User</h2>
				<button aria-label="Close" class="btn-close" on:click={closeInviteModal}>
					<svg
						fill="none"
						height="24"
						stroke="currentColor"
						stroke-width="2"
						viewBox="0 0 24 24"
						width="24"
					>
						<path d="M18 6L6 18M6 6l12 12" />
					</svg>
				</button>
			</div>

			<div class="modal-body">
				{#if selectedUser}
					<div class="selected-user">
						<img src={selectedUser.avatar_url} alt={selectedUser.login} class="avatar" />
						<div>
							<strong>@{selectedUser.login}</strong>
							<a
								href={selectedUser.html_url}
								target="_blank"
								rel="noopener noreferrer"
								class="github-link"
							>
								View on GitHub →
							</a>
						</div>
					</div>
				{/if}

				<div class="form-group">
					<label for="invite-email">Email Address</label>
					<input
						id="invite-email"
						type="email"
						bind:value={inviteEmail}
						placeholder="user@example.com"
						class:error={errors.email}
					/>
					{#if errors.email}
						<span class="error-message">{errors.email}</span>
					{/if}
				</div>

				{#if errors.general}
					<div class="error-banner">{errors.general}</div>
				{/if}
			</div>

			<div class="modal-footer">
				<button class="btn btn-secondary" on:click={closeInviteModal}>Cancel</button>
				<button class="btn btn-primary" on:click={inviteUser}>Send Invite</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.users-page {
		padding: var(--spacing-xl);
		max-width: 1400px;
		margin: 0 auto;
	}

	.page-header {
		margin-bottom: var(--spacing-xl);
	}

	.page-header h1 {
		font-size: 2rem;
		font-weight: 600;
		color: var(--color-text);
		margin: 0 0 var(--spacing-sm) 0;
	}

	.page-description {
		color: var(--color-text-secondary);
		margin: 0;
	}

	.search-section {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: var(--spacing-lg);
		margin-bottom: var(--spacing-xl);
	}

	.search-box label {
		display: block;
		font-weight: 500;
		margin-bottom: var(--spacing-sm);
		color: var(--color-text);
	}

	.search-input-wrapper {
		position: relative;
	}

	.search-icon {
		position: absolute;
		left: var(--spacing-md);
		top: 50%;
		transform: translateY(-50%);
		color: var(--color-text-secondary);
	}

	.search-input {
		width: 100%;
		padding: var(--spacing-md) var(--spacing-md) var(--spacing-md) 44px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		font-size: 1rem;
		background: var(--color-background);
		color: var(--color-text);
		transition: border-color var(--transition-fast);
	}

	.search-input:focus {
		outline: none;
		border-color: var(--color-primary);
	}

	.loading-indicator {
		position: absolute;
		right: var(--spacing-md);
		top: 50%;
		transform: translateY(-50%);
		color: var(--color-text-secondary);
		font-size: 0.875rem;
	}

	.search-results {
		margin-top: var(--spacing-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		overflow: hidden;
		background: var(--color-background);
	}

	.search-result-item {
		width: 100%;
		display: flex;
		align-items: center;
		gap: var(--spacing-md);
		padding: var(--spacing-md);
		border: none;
		background: transparent;
		cursor: pointer;
		transition: background-color var(--transition-fast);
		text-align: left;
		border-bottom: 1px solid var(--color-border);
	}

	.search-result-item:last-child {
		border-bottom: none;
	}

	.search-result-item:hover {
		background: var(--color-surface);
	}

	.avatar {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		object-fit: cover;
	}

	.user-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.username {
		font-weight: 500;
		color: var(--color-text);
	}

	.user-id {
		font-size: 0.875rem;
		color: var(--color-text-secondary);
	}

	.plus-icon {
		color: var(--color-primary);
	}

	.users-list {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: var(--spacing-lg);
	}

	.users-list h2 {
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--color-text);
		margin: 0 0 var(--spacing-lg) 0;
	}

	.empty-state {
		text-align: center;
		padding: var(--spacing-xxl) var(--spacing-lg);
		color: var(--color-text-secondary);
	}

	.empty-state svg {
		margin: 0 auto var(--spacing-lg);
		opacity: 0.5;
	}

	.empty-state h3 {
		font-size: 1.125rem;
		font-weight: 500;
		color: var(--color-text);
		margin: 0 0 var(--spacing-sm) 0;
	}

	.empty-state p {
		margin: 0;
	}

	.users-table {
		overflow-x: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
	}

	thead {
		background: var(--color-background);
		border-bottom: 1px solid var(--color-border);
	}

	th {
		text-align: left;
		padding: var(--spacing-md);
		font-weight: 500;
		color: var(--color-text-secondary);
		font-size: 0.875rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	td {
		padding: var(--spacing-md);
		border-bottom: 1px solid var(--color-border);
		color: var(--color-text);
	}

	tr:last-child td {
		border-bottom: none;
	}

	.user-cell {
		display: flex;
		align-items: center;
		gap: var(--spacing-md);
	}

	.avatar-placeholder {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: var(--color-primary);
		color: var(--color-background);
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 600;
	}

	.github-link {
		color: var(--color-primary);
		text-decoration: none;
		transition: opacity var(--transition-fast);
	}

	.github-link:hover {
		opacity: 0.8;
	}

	.pending-status {
		color: var(--color-text-secondary);
		font-style: italic;
	}

	.badge {
		display: inline-block;
		padding: 4px 12px;
		border-radius: var(--radius-sm);
		font-size: 0.875rem;
		font-weight: 500;
	}

	.badge-admin {
		background: var(--color-primary);
		color: var(--color-background);
	}

	.badge-user {
		background: var(--color-surface);
		color: var(--color-text);
		border: 1px solid var(--color-border);
	}

	.actions {
		display: flex;
		gap: var(--spacing-sm);
	}

	.btn-icon {
		padding: var(--spacing-sm);
		border: none;
		background: transparent;
		cursor: pointer;
		color: var(--color-text);
		border-radius: var(--radius-sm);
		transition: background-color var(--transition-fast);
	}

	.btn-icon:hover {
		background: var(--color-background);
	}

	.btn-danger {
		color: var(--color-danger, #dc3545);
	}

	.btn-danger:hover {
		background: rgba(220, 53, 69, 0.1);
	}

	.btn-icon:disabled,
	.btn-icon.disabled {
		opacity: 0.4;
		cursor: not-allowed;
		pointer-events: none;
	}

	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: var(--spacing-lg);
	}

	.modal {
		background: var(--color-surface);
		border-radius: var(--radius-lg);
		width: 100%;
		max-width: 500px;
		box-shadow: var(--shadow-lg);
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--spacing-lg);
		border-bottom: 1px solid var(--color-border);
	}

	.modal-header h2 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--color-text);
	}

	.btn-close {
		padding: var(--spacing-sm);
		border: none;
		background: transparent;
		cursor: pointer;
		color: var(--color-text-secondary);
		border-radius: var(--radius-sm);
		transition: background-color var(--transition-fast);
	}

	.btn-close:hover {
		background: var(--color-background);
	}

	.modal-body {
		padding: var(--spacing-lg);
	}

	.selected-user {
		display: flex;
		align-items: center;
		gap: var(--spacing-md);
		padding: var(--spacing-md);
		background: var(--color-background);
		border-radius: var(--radius-md);
		margin-bottom: var(--spacing-lg);
	}

	.selected-user div {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.form-group {
		margin-bottom: var(--spacing-lg);
	}

	.form-group label {
		display: block;
		font-weight: 500;
		margin-bottom: var(--spacing-sm);
		color: var(--color-text);
	}

	.form-group input {
		width: 100%;
		padding: var(--spacing-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		font-size: 1rem;
		background: var(--color-background);
		color: var(--color-text);
		transition: border-color var(--transition-fast);
	}

	.form-group input:focus {
		outline: none;
		border-color: var(--color-primary);
	}

	.form-group input.error {
		border-color: var(--color-danger, #dc3545);
	}

	.error-message {
		display: block;
		margin-top: var(--spacing-xs);
		color: var(--color-danger, #dc3545);
		font-size: 0.875rem;
	}

	.error-banner {
		padding: var(--spacing-md);
		background: rgba(220, 53, 69, 0.1);
		border: 1px solid var(--color-danger, #dc3545);
		border-radius: var(--radius-md);
		color: var(--color-danger, #dc3545);
		margin-bottom: var(--spacing-lg);
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: var(--spacing-md);
		padding: var(--spacing-lg);
		border-top: 1px solid var(--color-border);
	}

	.btn {
		padding: var(--spacing-md) var(--spacing-lg);
		border: none;
		border-radius: var(--radius-md);
		font-size: 1rem;
		font-weight: 500;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.btn-secondary {
		background: var(--color-background);
		color: var(--color-text);
		border: 1px solid var(--color-border);
	}

	.btn-secondary:hover {
		background: var(--color-surface);
	}

	.btn-primary {
		background: var(--color-primary);
		color: var(--color-background);
	}

	.btn-primary:hover {
		opacity: 0.9;
	}
</style>
