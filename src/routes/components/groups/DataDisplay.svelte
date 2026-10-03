<!-- /components demos: Data display. -->
<script lang="ts">
	import { Avatar, Badge, Button, Card, EmptyState, Kbd, Table } from '$lib/ui';
	import CatalogItem from '../CatalogItem.svelte';

	const deploys = [
		{ branch: 'main', status: 'Live', minutes: 2.4 },
		{ branch: 'feature/search', status: 'Preview', minutes: 3.1 },
		{ branch: 'fix/login', status: 'Failed', minutes: 0.8 },
		{ branch: 'docs', status: 'Preview', minutes: 1.2 }
	];
</script>

<CatalogItem id="card">
	<div class="cards">
		<Card title="Pro plan">
			Everything in Free, plus custom domains and priority support.
			<svelte:fragment slot="header"><Badge tone="info">Popular</Badge></svelte:fragment>
			<svelte:fragment slot="footer"><Button size="sm">Upgrade</Button></svelte:fragment>
		</Card>
		<Card title="A whole-card link" href="#card">The entire card is one link target.</Card>
	</div>
</CatalogItem>
<CatalogItem id="table">
	<div class="stack">
		<Table
			caption="Recent deploys"
			rows={deploys}
			columns={[
				{ key: 'branch', label: 'Branch', sortable: true },
				{ key: 'status', label: 'Status', sortable: true },
				{ key: 'minutes', label: 'Minutes', sortable: true, align: 'end' }
			]}
		/>
	</div>
</CatalogItem>
<CatalogItem id="avatar">
	<Avatar name="Ada Lovelace" size="sm" />
	<Avatar name="Grace Hopper" />
	<Avatar name="Alan Turing" size="lg" />
</CatalogItem>
<CatalogItem id="kbd">
	<Kbd keys={['Ctrl', 'K']} />
	<Kbd keys={['⌘', 'Shift', 'P']} />
	<Kbd>Esc</Kbd>
</CatalogItem>
<CatalogItem id="empty-state">
	<div class="stack">
		<EmptyState icon="✨" title="No projects yet" description="Projects you create show up here.">
			<Button size="sm">New project</Button>
		</EmptyState>
	</div>
</CatalogItem>
