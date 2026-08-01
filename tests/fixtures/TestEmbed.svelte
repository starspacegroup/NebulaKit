<!-- Stand-in for a project-registered embed, used by CmsContent tests. -->
<script lang="ts">
	export let tone = 'neutral';
	export let label = 'untitled';
</script>

<aside data-testid="test-embed" data-tone={tone}>{label}</aside>
