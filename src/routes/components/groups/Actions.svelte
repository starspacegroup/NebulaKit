<!-- /components demos: Actions. -->
<script lang="ts">
	import { Button, Menu, toast } from '$lib/ui';
	import CatalogItem from '../CatalogItem.svelte';

	let loading = false;
	let lastAction = '';

	function fakeSave() {
		loading = true;
		setTimeout(() => {
			loading = false;
			toast.success('Saved');
		}, 1200);
	}
</script>

<CatalogItem id="button">
	<Button on:click={fakeSave} {loading}>Save</Button>
	<Button variant="secondary">Cancel</Button>
	<Button variant="ghost">Skip</Button>
	<Button variant="danger" size="sm">Delete</Button>
	<Button href="#button" size="lg">A link</Button>
	<Button disabled>Disabled</Button>
</CatalogItem>
<CatalogItem id="menu">
	<Menu
		label="Actions"
		items={[
			{ id: 'edit', label: 'Edit' },
			{ id: 'duplicate', label: 'Duplicate' },
			{ id: 'archive', label: 'Archive', disabled: true },
			{ id: 'delete', label: 'Delete', danger: true }
		]}
		on:select={(e) => (lastAction = e.detail.id)}
	/>
	<span class="note" aria-live="polite">{lastAction ? `Picked: ${lastAction}` : ''}</span>
</CatalogItem>
