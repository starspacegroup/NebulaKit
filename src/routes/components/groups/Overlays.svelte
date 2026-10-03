<!-- /components demos: Overlays. -->
<script lang="ts">
	import { Button, Dialog, Tooltip, toast } from '$lib/ui';
	import CatalogItem from '../CatalogItem.svelte';

	let dialogOpen = false;
</script>

<CatalogItem id="dialog">
	<Button variant="danger" on:click={() => (dialogOpen = true)}>Delete project…</Button>
	<Dialog
		bind:open={dialogOpen}
		title="Delete project?"
		description="The project and its deploys go for good. This cannot be undone."
	>
		<svelte:fragment slot="actions">
			<Button variant="secondary" on:click={() => (dialogOpen = false)}>Cancel</Button>
			<Button
				variant="danger"
				on:click={() => {
					dialogOpen = false;
					toast.danger('Project deleted (not really)');
				}}>Delete</Button
			>
		</svelte:fragment>
	</Dialog>
</CatalogItem>
<CatalogItem id="tooltip">
	<Tooltip text="Copies the link to your clipboard">
		<Button variant="secondary">Copy link</Button>
	</Tooltip>
	<Tooltip text="Below, for controls near the top of the page" placement="bottom">
		<Button variant="ghost">Below</Button>
	</Tooltip>
</CatalogItem>
