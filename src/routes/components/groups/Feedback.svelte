<!-- /components demos: Feedback. -->
<script lang="ts">
	import { Alert, Badge, Button, Progress, Skeleton, Spinner, toast } from '$lib/ui';
	import CatalogItem from '../CatalogItem.svelte';

	const volume = 40;
</script>

<CatalogItem id="alert">
	<div class="stack">
		<Alert tone="info" title="Heads up">A new version is available.</Alert>
		<Alert tone="success">Your changes were saved.</Alert>
		<Alert tone="warning" title="Trial ends soon" dismissible>Three days left.</Alert>
		<Alert tone="danger" title="Payment failed">Check your card details.</Alert>
	</div>
</CatalogItem>
<CatalogItem id="toaster">
	<Button variant="secondary" on:click={() => toast.info('Heads up')}>Info</Button>
	<Button variant="secondary" on:click={() => toast.success('Saved')}>Success</Button>
	<Button variant="secondary" on:click={() => toast.warning('Almost full')}>Warning</Button>
	<Button variant="secondary" on:click={() => toast.danger('Could not connect', 0)}>
		Sticky error
	</Button>
</CatalogItem>
<CatalogItem id="badge">
	<Badge>Draft</Badge>
	<Badge tone="info">Preview</Badge>
	<Badge tone="success">Live</Badge>
	<Badge tone="warning">Degraded</Badge>
	<Badge tone="danger">Failed</Badge>
</CatalogItem>
<CatalogItem id="progress">
	<div class="stack">
		<Progress label="Uploading" value={volume} />
		<Progress label="Quota" value={92} tone="warning" />
		<Progress label="Working on it" />
	</div>
</CatalogItem>
<CatalogItem id="spinner">
	<Spinner size="sm" />
	<Spinner />
	<Spinner size="lg" label="Loading the report" />
</CatalogItem>
<CatalogItem id="skeleton">
	<div class="row">
		<Skeleton shape="circle" height="3rem" />
		<div class="grow"><Skeleton lines={3} /></div>
	</div>
</CatalogItem>
