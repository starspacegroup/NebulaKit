<!--
	AspectRatio — keeps its slot at a fixed shape with CSS aspect-ratio, so an
	image, video or map holds its space before it loads and the page does not
	jump. `ratio` is a number (1.5) or a string ("16/9", "4:3").
-->
<script lang="ts">
	import { parseRatio } from './layout-logic';

	export let ratio: number | string = '16/9';

	$: value = parseRatio(ratio);
</script>

<div class="aspect-ratio" style="aspect-ratio: {value}">
	<slot />
</div>

<style>
	.aspect-ratio {
		position: relative;
		width: 100%;
		overflow: hidden;
	}

	/* Media fills the box and crops rather than stretching. */
	.aspect-ratio > :global(img),
	.aspect-ratio > :global(video),
	.aspect-ratio > :global(iframe) {
		display: block;
		width: 100%;
		height: 100%;
		border: 0;
		object-fit: cover;
	}
</style>
