<script lang="ts">
	import PageEditor from '@nebulakit/builder/PageEditor.svelte';
	import type { PageDocument, PageRevisionSummary } from '@nebulakit/builder';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	// svelte-ignore state_referenced_locally
	let document = $state<PageDocument>(data.page.document);
	// svelte-ignore state_referenced_locally
	let title = $state(data.page.title);
	// svelte-ignore state_referenced_locally
	let published = $state(data.page.published);
	// svelte-ignore state_referenced_locally
	let revisions = $state<PageRevisionSummary[]>(data.revisions);
	/** The revision whose Restore button was pressed once; a second press confirms. */
	let confirming = $state<string | null>(null);
	let saving = $state(false);
	let message = $state('');

	/** Resolves `false` when nothing was saved, so the editor keeps the page marked unsaved. */
	async function save(doc: PageDocument): Promise<boolean> {
		saving = true;
		message = '';
		try {
			const response = await fetch(`/api/v1/pages/${data.page.slug}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ title, document: doc, published })
			});
			const body = await response.json();
			message = response.ok ? 'Saved.' : [body.error, ...(body.details ?? [])].join(' — ');
			if (response.ok) await refreshRevisions();
			return response.ok;
		} catch {
			message = 'Could not reach the site. Nothing was saved.';
			return false;
		} finally {
			saving = false;
		}
	}

	async function refreshRevisions() {
		try {
			const response = await fetch(`/api/v1/pages/${data.page.slug}/revisions`);
			if (response.ok) revisions = (await response.json()).revisions;
		} catch {
			// The timeline is a convenience; a failed refresh leaves the old list.
		}
	}

	/** Put a revision back. Unsaved edits in the editor are replaced, hence the second press. */
	async function restore(id: string) {
		if (confirming !== id) {
			confirming = id;
			return;
		}
		confirming = null;
		message = '';
		try {
			const response = await fetch(`/api/v1/pages/${data.page.slug}/revisions/${id}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: '{}'
			});
			const body = await response.json();
			if (response.ok) {
				document = body.page.document;
				title = body.page.title;
				message = 'Revision restored.';
				await refreshRevisions();
			} else {
				message = body.error ?? 'Could not restore that revision.';
			}
		} catch {
			message = 'Could not reach the site. Nothing was restored.';
		}
	}

	const when = (stamp: string) =>
		new Date(stamp.replace(' ', 'T') + 'Z').toLocaleString(undefined, {
			dateStyle: 'medium',
			timeStyle: 'short'
		});
</script>

<svelte:head><title>Edit {title}</title></svelte:head>

<section class="page-editor">
	<header>
		<label>Title <input bind:value={title} maxlength="200" /></label>
		<label class="row"><input type="checkbox" bind:checked={published} /> Published</label>
		<a href="/p/{data.page.slug}" target="_blank" rel="noopener">View /p/{data.page.slug}</a>
		{#if message}<span role="status">{message}</span>{/if}
	</header>
	<PageEditor bind:document onsave={save} {saving} />
	<details class="history">
		<summary>History ({revisions.length})</summary>
		{#if revisions.length === 0}
			<p>No saved revisions yet.</p>
		{:else}
			<ol>
				{#each revisions as revision, index (revision.id)}
					<li>
						<span>
							<time datetime={revision.createdAt}>{when(revision.createdAt)}</time>
							· {revision.title} · {revision.blocks} block{revision.blocks === 1 ? '' : 's'}
							{#if revision.author}· {revision.author}{/if}
							{#if index === 0}<strong>(latest)</strong>{/if}
						</span>
						{#if index > 0}
							<button type="button" onclick={() => restore(revision.id)}>
								{confirming === revision.id ? 'Replace the page? Press again' : 'Restore'}
							</button>
						{/if}
					</li>
				{/each}
			</ol>
		{/if}
	</details>
</section>

<style>
	.page-editor {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		color: var(--color-text);
	}
	header {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		align-items: flex-end;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	label.row {
		flex-direction: row;
		align-items: center;
	}
	input:not([type='checkbox']) {
		padding: 0.4rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-background);
		color: var(--color-text);
	}
	span {
		color: var(--color-text-secondary);
	}
	.history summary {
		cursor: pointer;
		min-height: 2.75rem;
		display: flex;
		align-items: center;
		font-weight: 600;
	}
	.history ol {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.history li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.25rem 0;
		border-bottom: 1px solid var(--color-border);
	}
	.history button {
		min-height: 2.75rem;
		padding: 0 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-background);
		color: var(--color-text);
		font: inherit;
		cursor: pointer;
	}
</style>
