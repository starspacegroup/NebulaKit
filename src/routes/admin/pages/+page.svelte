<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head><title>Pages</title></svelte:head>

<section class="pages">
	<h1>Pages</h1>
	<p>
		Pages built with drag and drop. They are stored as data, so editing them never changes the
		site's code.
	</p>

	<form method="POST" action="?/create" use:enhance class="create">
		<label>Title <input name="title" required maxlength="200" placeholder="About us" /></label>
		<label
			>Address <span class="slug"
				>/p/<input name="slug" required pattern="[a-z0-9-]+" placeholder="about" /></span
			></label
		>
		<button type="submit">New page</button>
	</form>
	{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}

	{#if data.pages.length === 0}
		<p>No pages yet.</p>
	{:else}
		<ul>
			{#each data.pages as p (p.id)}
				<li>
					<a href="/admin/pages/{p.slug}">{p.title}</a>
					<code>/p/{p.slug}</code>
					<span>{p.published ? 'Published' : 'Draft'}</span>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.pages {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		color: var(--color-text);
	}
	p,
	li span,
	code {
		color: var(--color-text-secondary);
	}
	.create {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		align-items: flex-end;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.slug {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}
	input {
		padding: 0.4rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-background);
		color: var(--color-text);
	}
	button {
		padding: 0.5rem 1rem;
		border: none;
		border-radius: var(--radius-md);
		background: var(--color-primary-solid);
		color: var(--color-on-solid);
		cursor: pointer;
	}
	.error {
		color: var(--color-error);
	}
	ul {
		list-style: none;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	li {
		display: flex;
		gap: 1rem;
		padding: 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
	}
</style>
