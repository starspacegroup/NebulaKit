<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const keyName = (id: string | null) =>
		id ? (data.keys.find((k) => k.id === id)?.name ?? 'deleted key') : 'Ammoura (orchestrator)';
	function status(k: PageData['keys'][number]) {
		if (k.revokedAt) return 'Revoked';
		if (k.expiresAt && Date.parse(k.expiresAt) <= Date.now()) return 'Expired';
		return 'Active';
	}
</script>

<svelte:head><title>API keys</title></svelte:head>

<section class="api-keys">
	<header>
		<h1>API keys</h1>
		<p>
			Everything this site does is reachable through its API (<a href="/api/v1/openapi.json"
				>/api/v1/openapi.json</a
			>). A key is shown once when you create it and stored only as a hash.
		</p>
		<p class="orchestrator">
			Ammoura control room: {data.orchestratorConnected ? 'connected' : 'not connected'}.
		</p>
	</header>

	{#if form?.created}
		<div class="created" role="status">
			<strong>Copy the key for “{form.created.name}” now. It will not be shown again.</strong>
			<code>{form.created.key}</code>
		</div>
	{/if}
	{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}

	<form method="POST" action="?/create" use:enhance class="create">
		<h2>Create a key</h2>
		<label>Name <input name="name" required maxlength="100" placeholder="Mobile app" /></label>
		<fieldset>
			<legend>Scopes</legend>
			{#each data.scopes as scope (scope)}
				<label class="scope"><input type="checkbox" name="scopes" value={scope} /> {scope}</label>
			{/each}
		</fieldset>
		<label
			>Expires
			<select name="expiry">
				<option value="7">in 7 days</option>
				<option value="30">in 30 days</option>
				<option value="90" selected>in 90 days</option>
				<option value="365">in a year</option>
				<option value="never">never</option>
			</select>
		</label>
		<button type="submit">Create key</button>
	</form>

	<h2>Keys</h2>
	{#if data.keys.length === 0}
		<p>No keys yet.</p>
	{:else}
		<table>
			<thead>
				<tr
					><th>Name</th><th>Key</th><th>Scopes</th><th>Expires</th><th>Last used</th><th>Status</th
					><th></th></tr
				>
			</thead>
			<tbody>
				{#each data.keys as k (k.id)}
					<tr class:revoked={!!k.revokedAt}>
						<td>{k.name}</td>
						<td><code>{k.prefix}…</code></td>
						<td>{k.scopes.join(', ')}</td>
						<td>{k.expiresAt ? new Date(k.expiresAt).toLocaleDateString() : 'never'}</td>
						<td>{k.lastUsedAt ?? 'never'}</td>
						<td>{status(k)}</td>
						<td>
							{#if !k.revokedAt}
								<form method="POST" action="?/revoke" use:enhance>
									<input type="hidden" name="id" value={k.id} />
									<button type="submit" class="danger">Revoke</button>
								</form>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}

	<h2>Recent calls</h2>
	{#if data.calls.length === 0}
		<p>No calls yet.</p>
	{:else}
		<table>
			<thead><tr><th>When</th><th>Key</th><th>Call</th><th>Status</th></tr></thead>
			<tbody>
				{#each data.calls as c, i (i)}
					<tr>
						<td>{c.calledAt}</td>
						<td>{keyName(c.keyId)}</td>
						<td><code>{c.method} {c.path}</code></td>
						<td>{c.status}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</section>

<style>
	.api-keys {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		color: var(--color-text);
	}
	p {
		color: var(--color-text-secondary);
	}
	.create,
	.created {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
	}
	.created {
		border-color: var(--color-success);
	}
	.created code {
		word-break: break-all;
		font-family: var(--font-mono);
	}
	.error {
		color: var(--color-error);
	}
	fieldset {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	label.scope {
		flex-direction: row;
		align-items: center;
	}
	input,
	select {
		padding: 0.4rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-background);
		color: var(--color-text);
	}
	button {
		align-self: flex-start;
		padding: 0.5rem 1rem;
		border: none;
		border-radius: var(--radius-md);
		background: var(--color-primary-solid);
		color: var(--color-on-solid);
		cursor: pointer;
	}
	button.danger {
		background: var(--color-danger-solid);
	}
	button.danger:hover {
		background: var(--color-danger-solid-hover);
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9rem;
	}
	th,
	td {
		text-align: left;
		padding: 0.5rem;
		border-bottom: 1px solid var(--color-border);
	}
	tr.revoked td {
		color: var(--color-text-secondary);
	}
	@media (max-width: 700px) {
		table {
			display: block;
			overflow-x: auto;
		}
	}
</style>
