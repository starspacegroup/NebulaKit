<!--
	FormErrorSummary — the list of problems in a form, with a link to each field.
	Give it `errors` (field name to message) and `fields` (name, label and the
	id of the control, in page order). It renders nothing when there is nothing
	wrong. Call `focus()` after a failed submit: it moves focus to the summary
	so a screen reader reads it, and each link moves focus into the field.
-->
<script lang="ts">
	import { uid } from '$lib/ui';
	import type { FieldErrors } from './logic';

	export let errors: FieldErrors = {};
	export let fields: { name: string; label: string; id: string }[] = [];
	export let title = 'Please fix the following';
	/** Heading level for the title, so the summary fits the page's outline. */
	export let level: 2 | 3 | 4 | 5 | 6 = 3;

	const id = uid('error-summary');
	let root: HTMLElement;

	$: items = fields.filter((f) => Boolean(errors[f.name]));

	export function focus() {
		root?.focus();
	}

	function go(event: MouseEvent, target: string) {
		const el = document.getElementById(target);
		if (!el) return;
		event.preventDefault();
		el.focus();
	}
</script>

{#if items.length > 0}
	<section bind:this={root} class="summary" tabindex="-1" aria-labelledby="{id}-title">
		<svelte:element this={`h${level}`} id="{id}-title" class="summary__title">
			<span aria-hidden="true">! </span>{title}
		</svelte:element>
		<ul>
			{#each items as item (item.name)}
				<li>
					<a href="#{item.id}" on:click={(e) => go(e, item.id)}>{item.label}: {errors[item.name]}</a
					>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<style>
	.summary {
		min-width: 0;
		padding: var(--spacing-md);
		border: 2px solid var(--color-danger);
		border-radius: var(--radius-md);
		background: var(--color-background);
		color: var(--color-text);
	}

	.summary:focus-visible {
		outline: 3px solid var(--color-primary);
		outline-offset: 2px;
	}

	.summary__title {
		margin: 0 0 var(--spacing-sm);
		font-size: 1rem;
	}

	ul {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-xs);
		margin: 0;
		padding-inline-start: var(--spacing-lg);
	}

	a {
		display: inline-block;
		min-block-size: 1.5rem;
		color: var(--color-text);
		overflow-wrap: anywhere;
	}

	a:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}
</style>
