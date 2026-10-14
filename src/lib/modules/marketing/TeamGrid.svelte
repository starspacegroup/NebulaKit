<!--
	TeamGrid — people with a picture (or initials), name, role and links.
	Link text names the person and the network, so "GitHub" is never read
	alone out of context. One column on a phone, two from 40rem, `columns`
	(default 3) from 64rem.
-->
<script lang="ts">
	import Avatar from '$lib/ui/Avatar.svelte';
	import { uid } from '$lib/ui/logic';

	export let members: {
		name: string;
		role: string;
		avatar?: string;
		bio?: string;
		links?: { label: string; href: string }[];
	}[] = [];
	export let title = '';
	export let level: 2 | 3 | 4 = 2;
	export let columns: 2 | 3 | 4 = 3;
	/** Builds the accessible name of a link. */
	export let linkName = (label: string, person: string) => `${person} on ${label}`;

	const titleId = uid('team');
</script>

<section class="team" aria-labelledby={title ? titleId : undefined}>
	{#if title}
		<svelte:element this={`h${level}`} id={titleId} class="team__title">{title}</svelte:element>
	{/if}
	<ul class="team__grid team__grid--{columns}">
		{#each members as person (person.name)}
			<li class="person">
				<Avatar name={person.name} src={person.avatar} size="lg" />
				<svelte:element this={`h${Math.min(level + 1, 6)}`} class="person__name"
					>{person.name}</svelte:element
				>
				<p class="person__role">{person.role}</p>
				{#if person.bio}<p class="person__bio">{person.bio}</p>{/if}
				{#if person.links && person.links.length > 0}
					<ul class="person__links">
						{#each person.links as link (link.href)}
							<li>
								<a href={link.href} aria-label={linkName(link.label, person.name)}>{link.label}</a>
							</li>
						{/each}
					</ul>
				{/if}
			</li>
		{/each}
	</ul>
</section>

<style>
	.team {
		min-width: 0;
	}

	.team__title {
		margin: 0 0 var(--spacing-lg);
		font-size: 1.75rem;
	}

	.team__grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.person {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		justify-items: center;
		align-content: start;
		gap: var(--spacing-xs);
		min-width: 0;
		padding: var(--spacing-lg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		text-align: center;
	}

	.person__name {
		margin: var(--spacing-sm) 0 0;
		font-size: 1.125rem;
	}

	.person__role,
	.person__bio {
		margin: 0;
		color: var(--color-text-secondary);
	}

	.person__bio {
		font-size: 0.9rem;
	}

	.person__links {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0 var(--spacing-md);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.person__links a {
		display: inline-flex;
		align-items: center;
		min-block-size: 2.75rem;
		color: var(--color-primary);
		font-weight: 600;
	}

	@media (min-width: 40rem) {
		.team__grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (min-width: 64rem) {
		.team__grid--3 {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}

		.team__grid--4 {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}
	}
</style>
