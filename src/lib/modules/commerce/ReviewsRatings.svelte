<!--
	ReviewsRatings — the average, a bar for each star count, a sortable list of
	reviews with "helpful" buttons, and (optionally) a form to write one with a
	star-rating radio group. Bars carry their numbers in text. Sorting is
	announced. "Helpful" is a toggle (aria-pressed); the count is adjusted here
	and reported as an event, so apps persist it.
-->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Button from '$lib/ui/Button.svelte';
	import Field from '$lib/ui/Field.svelte';
	import { uid } from '$lib/ui/logic';
	import RatingStars from './RatingStars.svelte';
	import {
		averageFromCounts,
		formatCommerceDate,
		ratingDistribution,
		sortReviews,
		type Review,
		type ReviewSort
	} from './logic';

	export let reviews: Review[] = [];
	/** Counts for one to five stars, if the list is only a sample of all reviews. */
	export let counts: number[] | undefined = undefined;
	export let sort: ReviewSort = 'newest';
	export let canWrite = false;
	export let submitting = false;
	export let locale = 'en-US';
	export let timeZone = 'UTC';
	export let heading = 'Customer reviews';
	export let level: 2 | 3 | 4 = 2;
	export let labels: Partial<typeof defaults> = {};

	const defaults = {
		based: 'Based on {count} reviews',
		basedOne: 'Based on 1 review',
		none: 'No reviews yet. Be the first to write one.',
		starsRow: '{stars} stars',
		starsRowOne: '1 star',
		rowText: '{percent}% ({count})',
		sortLabel: 'Sort reviews',
		newest: 'Newest',
		oldest: 'Oldest',
		highest: 'Highest rated',
		lowest: 'Lowest rated',
		helpful: 'Most helpful',
		sorted: 'Sorted by {sort}.',
		helpfulButton: 'Helpful',
		helpfulCount: 'Helpful ({count})',
		helpfulFor: 'Mark review by {author} as helpful',
		rated: '{rating} out of 5 stars',
		write: 'Write a review',
		rating: 'Your rating',
		ratingRequired: 'Choose a rating from 1 to 5 stars.',
		title: 'Title (optional)',
		body: 'Your review',
		bodyRequired: 'Write a few words about it.',
		submit: 'Submit review',
		thanks: 'Thanks. Your review was submitted.'
	};

	const dispatch = createEventDispatcher<{
		helpful: { id: string; pressed: boolean };
		submit: { rating: number; title: string; body: string };
		sort: { sort: ReviewSort };
	}>();
	const id = uid('reviews');

	let pressed: Record<string, boolean> = {};
	let sortStatus = '';
	let rating = 0;
	let title = '';
	let body = '';
	let tried = false;
	let sent = false;

	$: t = { ...defaults, ...labels };
	$: tally =
		counts ?? [1, 2, 3, 4, 5].map((n) => reviews.filter((r) => Math.round(r.rating) === n).length);
	$: total = tally.reduce((a, b) => a + b, 0);
	$: average = averageFromCounts(tally);
	$: rows = ratingDistribution(tally);
	$: sorted = sortReviews(reviews, sort);
	$: ratingError = tried && rating === 0 ? t.ratingRequired : '';
	$: bodyError = tried && !body.trim() ? t.bodyRequired : '';

	const sortKeys: ReviewSort[] = ['newest', 'oldest', 'highest', 'lowest', 'helpful'];

	function onSort(event: Event) {
		sort = (event.currentTarget as HTMLSelectElement).value as ReviewSort;
		sortStatus = t.sorted.replace('{sort}', t[sort].toLowerCase());
		dispatch('sort', { sort });
	}

	function toggle(review: Review) {
		pressed = { ...pressed, [review.id]: !pressed[review.id] };
		dispatch('helpful', { id: review.id, pressed: pressed[review.id] });
	}

	function submit() {
		tried = true;
		sent = false;
		if (rating === 0 || !body.trim()) {
			const el = document.getElementById(rating === 0 ? `${id}-rating` : `${id}-body`);
			(el?.querySelector<HTMLElement>('input') ?? el)?.focus();
			return;
		}
		dispatch('submit', { rating, title: title.trim(), body: body.trim() });
		sent = true;
		tried = false;
		rating = 0;
		title = '';
		body = '';
	}
</script>

<section class="reviews" aria-labelledby="{id}-h">
	<svelte:element this={`h${level}`} class="reviews__title" id="{id}-h">{heading}</svelte:element>

	<div class="summary">
		<div class="summary__avg">
			<p class="summary__num">{total ? average.toFixed(1) : '–'}</p>
			<RatingStars value={average} count={total} />
			<p class="summary__based">
				{total === 1 ? t.basedOne : t.based.replace('{count}', String(total))}
			</p>
		</div>
		<ul class="bars">
			{#each rows as row (row.stars)}
				<li class="bar">
					<span class="bar__label"
						>{row.stars === 1
							? t.starsRowOne
							: t.starsRow.replace('{stars}', String(row.stars))}</span
					>
					<span class="bar__track" aria-hidden="true"
						><span class="bar__fill" style:width="{row.percent}%"></span></span
					>
					<span class="bar__value"
						>{t.rowText
							.replace('{percent}', String(row.percent))
							.replace('{count}', String(row.count))}</span
					>
				</li>
			{/each}
		</ul>
	</div>

	{#if reviews.length === 0}
		<p class="reviews__none">{t.none}</p>
	{:else}
		<div class="toolbar">
			<label class="toolbar__sort">
				<span>{t.sortLabel}</span>
				<select value={sort} on:change={onSort}>
					{#each sortKeys as key (key)}
						<option value={key} selected={key === sort}>{t[key]}</option>
					{/each}
				</select>
			</label>
		</div>
		<p class="sr-only" role="status">{sortStatus}</p>
		<ul class="list">
			{#each sorted as review}
				<li>
					<article class="review">
						<header class="review__head">
							<RatingStars value={review.rating} size="sm" textTemplate={t.rated} />
							{#if review.title}<h3 class="review__title">{review.title}</h3>{/if}
						</header>
						<p class="review__meta">
							{review.author} ·
							<time datetime={review.date}>{formatCommerceDate(review.date, locale, timeZone)}</time
							>
						</p>
						<p class="review__body">{review.body}</p>
						<button
							type="button"
							class="helpful"
							aria-pressed={pressed[review.id] ? 'true' : 'false'}
							aria-label={t.helpfulFor.replace('{author}', review.author)}
							on:click={() => toggle(review)}
						>
							<span aria-hidden="true"
								>{pressed[review.id] ? '👍 ' : ''}{t.helpfulCount.replace(
									'{count}',
									String(review.helpful + (pressed[review.id] ? 1 : 0))
								)}</span
							>
						</button>
					</article>
				</li>
			{/each}
		</ul>
	{/if}

	{#if canWrite}
		<form class="write" novalidate on:submit|preventDefault={submit} aria-labelledby="{id}-w">
			<h3 id="{id}-w" class="write__title">{t.write}</h3>
			<div id="{id}-rating" tabindex="-1" class="write__rating">
				<RatingStars
					variant="input"
					label={t.rating}
					bind:value={rating}
					required
					error={ratingError}
					size="lg"
				/>
			</div>
			<Field label={t.title} id="{id}-title" let:describedBy>
				<input
					id="{id}-title"
					type="text"
					autocomplete="off"
					bind:value={title}
					aria-describedby={describedBy}
				/>
			</Field>
			<Field label={t.body} error={bodyError} required id="{id}-body" let:describedBy let:invalid>
				<!-- prettier-ignore -->
				<textarea
					id="{id}-body"
					rows="4"
					bind:value={body}
					required
					aria-describedby={describedBy}
					aria-invalid={invalid || undefined}></textarea>
			</Field>
			<Button type="submit" loading={submitting}>{t.submit}</Button>
			<p class="sr-only" role="status">{sent ? t.thanks : ''}</p>
			{#if sent}<p class="write__thanks" aria-hidden="true"><span>✓</span> {t.thanks}</p>{/if}
		</form>
	{/if}
</section>

<style>
	.reviews {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-lg);
		min-width: 0;
		color: var(--color-text);
	}

	.reviews__title {
		margin: 0;
		font-size: 1.25rem;
	}

	.summary {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-lg);
	}

	.summary__avg {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		justify-items: start;
		gap: var(--spacing-xs);
	}

	.summary__num {
		margin: 0;
		font-size: 2.5rem;
		font-weight: 700;
		line-height: 1;
	}

	.summary__based,
	.reviews__none {
		margin: 0;
		color: var(--color-text-secondary);
		font-size: 0.875rem;
	}

	.bars {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-xs);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.bar {
		display: grid;
		grid-template-columns: 4.5rem minmax(0, 1fr) 5.5rem;
		align-items: center;
		gap: var(--spacing-sm);
		font-size: 0.875rem;
	}

	.bar__track {
		display: block;
		height: 0.625rem;
		overflow: hidden;
		border: 1px solid var(--color-border);
		border-radius: 999px;
		background: var(--color-surface-hover);
	}

	.bar__fill {
		display: block;
		height: 100%;
		background: var(--color-warning);
	}

	.bar__value {
		color: var(--color-text-secondary);
		font-variant-numeric: tabular-nums;
		text-align: end;
	}

	.toolbar__sort {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--spacing-sm);
		font-weight: 600;
	}

	.toolbar select {
		min-height: 2.75rem;
	}

	.list {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.review {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-xs);
		padding: var(--spacing-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
	}

	.review__head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--spacing-sm);
	}

	.review__title {
		margin: 0;
		font-size: 1rem;
	}

	.review__meta {
		margin: 0;
		color: var(--color-text-secondary);
		font-size: 0.8125rem;
	}

	.review__body {
		margin: 0;
		overflow-wrap: anywhere;
	}

	.helpful {
		justify-self: start;
		min-height: 2.75rem;
		padding: 0 var(--spacing-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-background);
		color: var(--color-text);
		font-size: 0.875rem;
		font-weight: 600;
	}

	.helpful[aria-pressed='true'] {
		border-color: var(--color-primary);
		background: color-mix(in srgb, var(--color-primary) 12%, var(--color-background));
	}

	.write {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
		max-width: 32rem;
		padding-top: var(--spacing-lg);
		border-top: 1px solid var(--color-border);
	}

	.write__title {
		margin: 0;
		font-size: 1.125rem;
	}

	.write__rating:focus {
		outline: none;
	}

	.write :global(input[type='text']),
	.write :global(textarea) {
		width: 100%;
		min-height: 2.75rem;
		box-sizing: border-box;
	}

	.write__thanks {
		margin: 0;
		color: var(--color-text);
		font-weight: 600;
	}

	.write :global(.btn) {
		justify-self: start;
		min-height: 2.75rem;
	}

	@media (min-width: 40rem) {
		.summary {
			grid-template-columns: auto minmax(0, 1fr);
			align-items: center;
		}
	}
</style>
