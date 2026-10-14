<!--
	ProductGallery — a large image with a thumbnail strip. Previous / next
	buttons and the arrow keys (Home and End too) move between images; there is
	no swipe to learn. Thumbnails are buttons marked aria-current; the caption
	"Image 2 of 5" is a polite live region. The strip scrolls inside itself.
-->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { galleryIndex } from './logic';

	export let images: { src: string; alt: string; thumb?: string }[] = [];
	/** Index of the shown image. Bind it. */
	export let index = 0;
	export let wrap = true;
	export let labels: Partial<typeof defaults> = {};

	const defaults = {
		region: 'Product images',
		previous: 'Previous image',
		next: 'Next image',
		caption: 'Image {n} of {total}',
		show: 'Show image {n}: {alt}',
		empty: 'No images'
	};

	const dispatch = createEventDispatcher<{ change: { index: number } }>();
	let root: HTMLElement;

	$: t = { ...defaults, ...labels };
	$: total = images.length;
	$: current = images[Math.min(index, Math.max(0, total - 1))];

	function go(to: number, focusThumb = false) {
		if (to === index) return;
		index = to;
		dispatch('change', { index });
		if (focusThumb) {
			// After render, keep the keyboard on the thumbnail that is now current.
			queueMicrotask(() =>
				root?.querySelector<HTMLElement>('[data-thumb][aria-current="true"]')?.focus()
			);
		}
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.altKey || event.ctrlKey || event.metaKey) return;
		const rtl = root && getComputedStyle(root).direction === 'rtl';
		const onThumb = (event.target as HTMLElement).hasAttribute('data-thumb');
		let to: number | null = null;
		if (event.key === 'ArrowRight') to = galleryIndex(index, rtl ? -1 : 1, total, wrap);
		else if (event.key === 'ArrowLeft') to = galleryIndex(index, rtl ? 1 : -1, total, wrap);
		else if (event.key === 'Home') to = 0;
		else if (event.key === 'End') to = total - 1;
		if (to === null || total === 0) return;
		event.preventDefault();
		go(to, onThumb);
	}
</script>

<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<section
	bind:this={root}
	class="gallery"
	role="group"
	aria-roledescription="gallery"
	aria-label={t.region}
	on:keydown={onKeydown}
>
	{#if total === 0}
		<p class="gallery__empty">{t.empty}</p>
	{:else}
		<figure class="gallery__stage">
			<img class="gallery__img" src={current.src} alt={current.alt} />
			<div class="gallery__nav">
				<button
					type="button"
					class="nav"
					aria-label={t.previous}
					disabled={!wrap && index === 0}
					on:click={() => go(galleryIndex(index, -1, total, wrap))}
					><span aria-hidden="true">‹</span></button
				>
				<button
					type="button"
					class="nav"
					aria-label={t.next}
					disabled={!wrap && index === total - 1}
					on:click={() => go(galleryIndex(index, 1, total, wrap))}
					><span aria-hidden="true">›</span></button
				>
			</div>
			<figcaption class="gallery__caption" aria-live="polite">
				{t.caption.replace('{n}', String(index + 1)).replace('{total}', String(total))}
			</figcaption>
		</figure>
		{#if total > 1}
			<ul class="thumbs">
				{#each images as image, i (i)}
					<li>
						<button
							type="button"
							class="thumb"
							data-thumb
							aria-current={i === index ? 'true' : undefined}
							aria-label={t.show.replace('{n}', String(i + 1)).replace('{alt}', image.alt)}
							on:click={() => go(i)}
						>
							<img src={image.thumb ?? image.src} alt="" loading="lazy" />
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
</section>

<style>
	.gallery {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-sm);
		min-width: 0;
		color: var(--color-text);
	}

	.gallery__stage {
		position: relative;
		margin: 0;
		overflow: hidden;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface-hover);
	}

	.gallery__img {
		display: block;
		width: 100%;
		aspect-ratio: 4 / 3;
		object-fit: contain;
	}

	.gallery__nav {
		position: absolute;
		inset-inline: var(--spacing-sm);
		inset-block-start: 50%;
		display: flex;
		justify-content: space-between;
		transform: translateY(-50%);
		pointer-events: none;
	}

	.nav {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		place-items: center;
		width: 2.75rem;
		height: 2.75rem;
		border: 1px solid var(--color-border);
		border-radius: 50%;
		background: var(--color-background);
		color: var(--color-text);
		font-size: 1.5rem;
		line-height: 1;
		pointer-events: auto;
	}

	.nav:hover:not(:disabled) {
		background: var(--color-surface-hover);
	}

	.nav:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	:global([dir='rtl']) .nav span {
		display: inline-block;
		transform: scaleX(-1);
	}

	.gallery__caption {
		padding: var(--spacing-xs) var(--spacing-md);
		color: var(--color-text-secondary);
		font-size: 0.8125rem;
		text-align: center;
	}

	.gallery__empty {
		margin: 0;
		padding: var(--spacing-xl);
		border: 1px dashed var(--color-border);
		border-radius: var(--radius-lg);
		color: var(--color-text-secondary);
		text-align: center;
	}

	.thumbs {
		display: flex;
		gap: var(--spacing-sm);
		margin: 0;
		padding: var(--spacing-xs);
		overflow-x: auto;
		list-style: none;
	}

	.thumb {
		display: block;
		width: 4rem;
		height: 4rem;
		padding: 0;
		overflow: hidden;
		border: 2px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface-hover);
	}

	.thumb[aria-current='true'] {
		border-color: var(--color-primary);
		outline: 1px solid var(--color-primary);
	}

	.thumb img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
</style>
