<!--
	AvatarGroup — a few overlapping avatars and a "+N" for the rest. It is a
	list, labelled, so a screen reader hears how many people and who; the
	"+N" says how many more and names them.

	<AvatarGroup label="Reviewers" people={[{ name: 'Ada Lovelace' }, { name: 'Alan Turing', src }]} max={3} />
-->
<script lang="ts">
	import Avatar from './Avatar.svelte';
	import { avatarOverflow } from './data-logic';

	export let people: { name: string; src?: string }[] = [];
	/** Avatars drawn before the rest fold into "+N". 0 draws them all. */
	export let max = 4;
	export let size: 'sm' | 'md' | 'lg' = 'md';
	export let label = 'People';

	$: fit = avatarOverflow(people.length, max);
	$: rest = people.slice(fit.shown);
</script>

<ul class="avatars avatars--{size}" aria-label={label}>
	{#each people.slice(0, fit.shown) as person, i (i)}
		<li><Avatar name={person.name} src={person.src} {size} /></li>
	{/each}
	{#if fit.rest > 0}
		<li>
			<span
				class="avatars__more"
				role="img"
				aria-label="{fit.rest} more: {rest.map((p) => p.name).join(', ')}"
				title={rest.map((p) => p.name).join(', ')}
			>
				<span aria-hidden="true">+{fit.rest}</span>
			</span>
		</li>
	{/if}
</ul>

<style>
	.avatars {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		margin: 0;
		padding: 0 0 0 var(--overlap);
		list-style: none;
	}

	.avatars--sm {
		--overlap: 0.5rem;
		--size: 2rem;
		font-size: 0.75rem;
	}

	.avatars--md {
		--overlap: 0.75rem;
		--size: 2.75rem;
		font-size: 0.875rem;
	}

	.avatars--lg {
		--overlap: 1rem;
		--size: 4rem;
		font-size: 1.125rem;
	}

	li {
		display: flex;
		margin-left: calc(var(--overlap) * -1);
		border-radius: 50%;
		box-shadow: 0 0 0 2px var(--color-background);
	}

	.avatars__more {
		display: inline-grid;
		place-items: center;
		width: var(--size);
		height: var(--size);
		border-radius: 50%;
		background: var(--color-surface-hover);
		color: var(--color-text);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
</style>
