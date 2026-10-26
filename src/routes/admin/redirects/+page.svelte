<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const statuses = [
		[301, '301 Moved permanently'],
		[302, '302 Found (temporary)'],
		[307, '307 Temporary, keep method'],
		[308, '308 Permanent, keep method']
	] as const;
</script>

<svelte:head><title>Redirects</title></svelte:head>

<section class="redirects">
	<h1>Redirects</h1>
	<p>
		Send an old address to a new one. A redirect applies only where the site would otherwise show
		"not found", so it can never hide a live page. The new address is a path on this site or an
		https address on an allowed host.
	</p>

	<form method="POST" action="?/create" use:enhance class="create" aria-labelledby="add-heading">
		<h2 id="add-heading">Add a redirect</h2>
		<label>
			Old address
			<input
				name="from_path"
				required
				maxlength="500"
				placeholder="/old-page"
				value={form?.action === 'create' ? (form.values?.fromPath ?? '') : ''}
			/>
		</label>
		<label>
			New address
			<input
				name="to_path"
				required
				maxlength="500"
				placeholder="/new-page"
				value={form?.action === 'create' ? (form.values?.toPath ?? '') : ''}
			/>
		</label>
		<label>
			Status
			<select name="status">
				{#each statuses as [code, label] (code)}
					<option value={code}>{label}</option>
				{/each}
			</select>
		</label>
		<button type="submit">Add redirect</button>
	</form>

	<div role="status" aria-live="polite">
		{#if form?.message}<p class="ok">{form.message}</p>{/if}
		{#if form?.problem}<p class="error" role="alert">{form.problem}</p>{/if}
	</div>

	{#if data.redirects.length === 0}
		<p>No redirects yet.</p>
	{:else}
		<ul class="list" aria-label="Redirects">
			{#each data.redirects as redirect (redirect.id)}
				<li>
					<form method="POST" action="?/update" use:enhance class="row">
						<input type="hidden" name="id" value={redirect.id} />
						<label>
							Old address
							<input name="from_path" value={redirect.fromPath} required maxlength="500" />
						</label>
						<label>
							New address
							<input name="to_path" value={redirect.toPath} required maxlength="500" />
						</label>
						<label>
							Status
							<select name="status">
								{#each statuses as [code, label] (code)}
									<option value={code} selected={code === redirect.status}>{label}</option>
								{/each}
							</select>
						</label>
						<span class="hits">{redirect.hits} {redirect.hits === 1 ? 'hit' : 'hits'}</span>
						<button type="submit">Save</button>
						<button
							type="submit"
							formaction="?/delete"
							class="danger"
							aria-label="Delete redirect from {redirect.fromPath}">Delete</button
						>
					</form>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.redirects {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		color: var(--color-text);
	}
	p {
		color: var(--color-text-secondary);
	}
	.create,
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		align-items: flex-end;
	}
	.create h2 {
		flex-basis: 100%;
		margin: 0;
		font-size: 1.1rem;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	input,
	select {
		min-height: 2.75rem;
		padding: 0 0.5rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-background);
		color: var(--color-text);
		font: inherit;
	}
	button {
		min-height: 2.75rem;
		padding: 0 1rem;
		border: 0;
		border-radius: var(--radius-md);
		background: var(--color-primary-solid);
		color: var(--color-on-solid);
		font: inherit;
		cursor: pointer;
	}
	button.danger {
		background: var(--color-danger-solid);
		color: var(--color-on-solid);
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.list li {
		padding: 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
	}
	.hits {
		align-self: center;
		color: var(--color-text-secondary);
	}
	.ok {
		color: var(--color-success);
	}
	.error {
		color: var(--color-error);
	}
</style>
