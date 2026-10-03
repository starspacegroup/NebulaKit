<!--
	Stack — the everyday layout primitive: a flex row or column with a gap
	from the spacing tokens, plus align, justify and wrap. Short names map to
	CSS: `justify="between"` is space-between, `align="start"` is flex-start.
	The class is `layout-stack`, not `stack`, so a page's own `.stack` helper
	cannot restyle it.
-->
<script lang="ts">
	import { flexValue, spaceValue } from './layout-logic';

	export let direction: 'row' | 'column' = 'column';
	export let gap: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' = 'md';
	export let align: 'start' | 'center' | 'end' | 'stretch' | 'baseline' = 'stretch';
	export let justify: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly' = 'start';
	export let wrap = false;
	export let as: 'div' | 'section' | 'ul' | 'ol' | 'nav' | 'header' | 'footer' = 'div';

	$: style = [
		`flex-direction: ${direction}`,
		`gap: ${spaceValue(gap)}`,
		`align-items: ${flexValue(align)}`,
		`justify-content: ${flexValue(justify)}`,
		`flex-wrap: ${wrap ? 'wrap' : 'nowrap'}`
	].join('; ');
</script>

<svelte:element this={as} class="layout-stack" {style}>
	<slot />
</svelte:element>

<style>
	.layout-stack {
		display: flex;
		min-width: 0;
		margin: 0;
		padding: 0;
		list-style: none;
	}
</style>
