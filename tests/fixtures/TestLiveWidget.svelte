<!-- Stand-in for a widget with a value that changes on a timer. -->
<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';

	export let value = 'tick';
	const dispatch = createEventDispatcher<{ live: string }>();

	let mounted = false;
	onMount(() => (mounted = true));

	// A parent's `on:live` is attached after construction, so wait for mount.
	$: if (mounted) dispatch('live', value);
</script>

<p data-testid="test-live-widget">{value}</p>
