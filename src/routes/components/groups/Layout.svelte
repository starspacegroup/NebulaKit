<!-- /components demos: Layout. -->
<script lang="ts">
	import {
		AspectRatio,
		Button,
		Collapsible,
		Container,
		Resizable,
		ScrollArea,
		Separator,
		Stack,
		TextInput
	} from '$lib/ui';
	import CatalogItem from '../CatalogItem.svelte';

	let split = 35;
	let advanced = false;
	let webhook = '';
	const releases = [
		{ version: '2.4.0', note: 'Command palette: fuzzy search across every page and action.' },
		{ version: '2.3.2', note: 'Fixed the dark theme’s focus ring on outline buttons.' },
		{ version: '2.3.0', note: 'Widgets can now be resized from the keyboard.' },
		{ version: '2.2.1', note: 'Faster cold starts on Cloudflare Workers.' },
		{ version: '2.2.0', note: 'Toasts stack and pause while hovered.' },
		{ version: '2.1.0', note: 'Tables sort by any column, numbers as numbers.' },
		{ version: '2.0.0', note: 'A new UI kit, themed entirely with CSS variables.' }
	];
</script>

<CatalogItem id="container">
	<div class="frame">
		<Container size="sm">
			<p class="note">
				A <code>sm</code> container: 40rem at most, centred, with gutters that widen on bigger screens.
			</p>
		</Container>
	</div>
</CatalogItem>
<CatalogItem id="stack">
	<Stack gap="md">
		<Stack direction="row" gap="sm" justify="between" align="center" wrap>
			<strong>Projects</strong>
			<Button size="sm">New project</Button>
		</Stack>
		<Stack direction="row" gap="xs" wrap>
			{#each ['Svelte', 'Workers', 'D1', 'KV', 'R2'] as tag (tag)}
				<span class="chip">{tag}</span>
			{/each}
		</Stack>
	</Stack>
</CatalogItem>
<CatalogItem id="separator">
	<div class="stack">
		<p class="note">Signed in as ada@example.com</p>
		<Separator />
		<Button variant="secondary" block>Continue with GitHub</Button>
		<Separator label="or" decorative={false} />
		<Button variant="secondary" block>Continue with email</Button>
		<Stack direction="row" align="center" gap="none">
			<a href="/documentation">Docs</a>
			<Separator orientation="vertical" />
			<a href="/components">Components</a>
			<Separator orientation="vertical" />
			<a href="/">Home</a>
		</Stack>
	</div>
</CatalogItem>
<CatalogItem id="aspect-ratio">
	<AspectRatio ratio="16/9">
		<div class="placeholder">16 : 9</div>
	</AspectRatio>
</CatalogItem>
<CatalogItem id="scroll-area">
	<ScrollArea label="Release notes" maxHeight="12rem">
		<Stack gap="sm">
			{#each releases as release (release.version)}
				<div>
					<strong>{release.version}</strong>
					<p class="note">{release.note}</p>
				</div>
			{/each}
		</Stack>
	</ScrollArea>
</CatalogItem>
<CatalogItem id="resizable">
	<div class="stack">
		<Resizable bind:size={split} min={20} max={80} label="Resize file list">
			<div slot="first" class="pane">
				<strong>Files</strong>
				<p class="note">src/<br />routes/<br />lib/</p>
			</div>
			<div slot="second" class="pane">
				<strong>Editor</strong>
				<p class="note">Drag the divider, or focus it and use the arrow keys.</p>
			</div>
		</Resizable>
		<p class="note">File list: {Math.round(split)}%</p>
	</div>
</CatalogItem>
<CatalogItem id="collapsible">
	<div class="stack">
		<Collapsible label="Show advanced options" bind:open={advanced}>
			<TextInput label="Webhook URL" type="url" bind:value={webhook} hint="Called on deploy." />
		</Collapsible>
		<p class="note">{advanced ? 'Open' : 'Closed'}</p>
	</div>
</CatalogItem>

<style>
	.frame {
		border: 1px dashed var(--color-border);
		border-radius: var(--radius-md);
	}

	.chip {
		padding: 0.125rem 0.625rem;
		border: 1px solid var(--color-border);
		border-radius: 999px;
		color: var(--color-text-secondary);
		font-size: 0.8125rem;
	}

	.placeholder {
		display: grid;
		place-items: center;
		height: 100%;
		border-radius: var(--radius-md);
		background: var(--color-surface-hover);
		color: var(--color-text-secondary);
		font-weight: 600;
	}

	.pane {
		padding: var(--spacing-md);
	}
</style>
