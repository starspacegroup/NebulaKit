<!--
	Timeline — events in order, top to bottom, on a line. Each has a time (a
	real <time datetime> when you give one), a title, an optional description,
	and a dot coloured by tone. Fill the `icon` slot to put an icon in the dot.
	It is an ordered list, so a screen reader hears how many events there are.

	<Timeline items={[{ time: '9:41', datetime: '2026-10-03T09:41', title: 'Deployed', tone: 'success' }]} />
-->
<script lang="ts">
	type Event = {
		/** What the reader sees: "Today, 9:41", "March". */
		time: string;
		/** Machine-readable form for <time datetime>: "2026-10-03T09:41". */
		datetime?: string;
		title: string;
		description?: string;
		tone?: 'default' | 'success' | 'warning' | 'danger';
	};

	export let items: Event[] = [];
	export let label = '';
</script>

<ol class="timeline" aria-label={label || undefined}>
	{#each items as item, i (i)}
		<li class="timeline__event timeline__event--{item.tone ?? 'default'}">
			<span class="timeline__dot" class:timeline__dot--icon={$$slots.icon} aria-hidden="true">
				<slot name="icon" {item} index={i} />
			</span>
			<div class="timeline__body">
				{#if item.datetime}
					<time class="timeline__time" datetime={item.datetime}>{item.time}</time>
				{:else}
					<span class="timeline__time">{item.time}</span>
				{/if}
				<p class="timeline__title">{item.title}</p>
				{#if item.description}
					<p class="timeline__description">{item.description}</p>
				{/if}
				<slot {item} index={i} />
			</div>
		</li>
	{/each}
</ol>

<style>
	.timeline {
		--dot: 0.75rem;
		--dot-icon: 1.75rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.timeline__event {
		--tone: var(--color-text-secondary);
		position: relative;
		display: grid;
		grid-template-columns: var(--dot-icon) 1fr;
		gap: var(--spacing-md);
		padding-bottom: var(--spacing-lg);
	}

	.timeline__event:last-child {
		padding-bottom: 0;
	}

	/* The line runs from this dot down to the next. */
	.timeline__event:not(:last-child)::before {
		content: '';
		position: absolute;
		top: 0.5rem;
		bottom: -0.5rem;
		left: calc(var(--dot-icon) / 2 - 1px);
		width: 2px;
		background: var(--color-border);
	}

	.timeline__event--success {
		--tone: var(--color-success);
	}

	.timeline__event--warning {
		--tone: var(--color-warning);
	}

	.timeline__event--danger {
		--tone: var(--color-danger);
	}

	.timeline__dot {
		position: relative;
		display: grid;
		place-items: center;
		justify-self: center;
		width: var(--dot);
		height: var(--dot);
		margin-top: 0.3rem;
		border: 2px solid var(--tone);
		border-radius: 50%;
		box-sizing: border-box;
		background: var(--color-background);
	}

	.timeline__event--success .timeline__dot,
	.timeline__event--warning .timeline__dot,
	.timeline__event--danger .timeline__dot {
		background: var(--tone);
	}

	.timeline__dot--icon {
		width: var(--dot-icon);
		height: var(--dot-icon);
		margin-top: -0.125rem;
		background: var(--color-background) !important;
		color: var(--tone);
		font-size: 0.875rem;
	}

	.timeline__body {
		min-width: 0;
	}

	.timeline__time {
		display: block;
		color: var(--color-text-secondary);
		font-size: 0.8125rem;
		font-variant-numeric: tabular-nums;
	}

	.timeline__title {
		margin: 0.125rem 0 0;
		color: var(--color-text);
		font-weight: 600;
		overflow-wrap: anywhere;
	}

	.timeline__description {
		margin: 0.25rem 0 0;
		color: var(--color-text-secondary);
		font-size: 0.9375rem;
		line-height: 1.5;
	}
</style>
