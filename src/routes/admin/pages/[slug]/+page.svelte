<script lang="ts">
	import PageEditor from '@nebulakit/builder/PageEditor.svelte';
	import type { PageDocument } from '@nebulakit/builder';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	// svelte-ignore state_referenced_locally
	let document = $state<PageDocument>(data.page.document);
	// svelte-ignore state_referenced_locally
	let title = $state(data.page.title);
	// svelte-ignore state_referenced_locally
	let published = $state(data.page.published);
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
			return response.ok;
		} catch {
			message = 'Could not reach the site. Nothing was saved.';
			return false;
		} finally {
			saving = false;
		}
	}
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
</style>
