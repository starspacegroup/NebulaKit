<script lang="ts">
	// Dumb display wrapper for server-masked PII. The value is already masked
	// (or real) by the +page.server.ts load — this component does NOT mask; it
	// just renders the string it's handed, with an N/A fallback.
	export let value: string | null | undefined = undefined;
</script>

<span>{value ?? 'N/A'}</span>
