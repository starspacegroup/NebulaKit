<!--
	FileDrop — a dropzone for files that is also a real button: click it, or
	press Enter or Space on it, to open the file chooser, or drag files onto
	it. `accept`, `maxSize` and `multiple` are checked here, not just hinted
	to the browser; refused files are listed with the reason and reported
	with `on:reject`. Chosen files are listed with remove buttons. Bind
	`files`; `on:change` fires with the accepted list.
-->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { formatBytes, validateFiles, type FileRejection } from './form-logic';
	import { uid } from './logic';

	export let label: string;
	export let files: File[] = [];
	/** As the input's accept: ".pdf, image/*". Empty takes anything. */
	export let accept = '';
	/** In bytes. */
	export let maxSize = Infinity;
	export let multiple = false;
	export let hint = '';
	export let disabled = false;
	/** The call to action inside the zone. */
	export let prompt = '';

	const dispatch = createEventDispatcher<{
		change: { files: File[] };
		reject: { rejections: FileRejection<File>[] };
	}>();
	const id = uid('filedrop');
	let picker: HTMLInputElement;
	let zone: HTMLButtonElement;
	let dragging = false;
	let rejections: FileRejection<File>[] = [];
	let announcement = '';

	$: limits = [
		accept && `Accepts ${accept}`,
		Number.isFinite(maxSize) && `up to ${formatBytes(maxSize)}${multiple ? ' each' : ''}`
	]
		.filter(Boolean)
		.join(', ');
	$: describedBy =
		[limits && `${id}-limits`, hint && `${id}-hint`].filter(Boolean).join(' ') || undefined;
	$: callToAction =
		prompt || (multiple ? 'Drop files here or choose files' : 'Drop a file here or choose a file');

	function take(list: FileList | null | undefined) {
		if (disabled || !list) return;
		const result = validateFiles([...list], { accept, maxSize, multiple, existing: files });
		rejections = result.rejected;
		if (result.rejected.length > 0) dispatch('reject', { rejections: result.rejected });
		if (result.accepted.length > 0) {
			files = multiple ? [...files, ...result.accepted] : result.accepted;
			announcement = `Added ${result.accepted.map((f) => f.name).join(', ')}.`;
			dispatch('change', { files });
		}
	}

	function remove(index: number) {
		const gone = files[index];
		files = files.filter((_, i) => i !== index);
		announcement = `Removed ${gone.name}.`;
		dispatch('change', { files });
		zone?.focus();
	}

	function onPick() {
		take(picker.files);
		// Clear it, so choosing the same file again still fires.
		picker.value = '';
	}

	// Drag handlers. dragover must be cancelled for a drop to be allowed.
	// Enter and leave fire for every child crossed, so they are counted.
	function dropTarget(node: HTMLElement) {
		let depth = 0;
		const enter = (event: DragEvent) => {
			event.preventDefault();
			depth += 1;
			dragging = !disabled;
		};
		const over = (event: DragEvent) => {
			event.preventDefault();
			dragging = !disabled;
		};
		const leave = () => {
			depth = Math.max(0, depth - 1);
			if (depth === 0) dragging = false;
		};
		const drop = (event: DragEvent) => {
			event.preventDefault();
			depth = 0;
			dragging = false;
			take(event.dataTransfer?.files);
		};
		node.addEventListener('dragenter', enter);
		node.addEventListener('dragover', over);
		node.addEventListener('dragleave', leave);
		node.addEventListener('drop', drop);
		return {
			destroy() {
				node.removeEventListener('dragenter', enter);
				node.removeEventListener('dragover', over);
				node.removeEventListener('dragleave', leave);
				node.removeEventListener('drop', drop);
			}
		};
	}
</script>

<div class="filedrop">
	<span id="{id}-label" class="filedrop__label">{label}</span>
	<button
		bind:this={zone}
		type="button"
		class="filedrop__zone"
		class:filedrop__zone--dragging={dragging}
		aria-labelledby="{id}-label {id}-cta"
		aria-describedby={describedBy}
		{disabled}
		use:dropTarget
		on:click={() => picker.click()}
	>
		<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
			<path
				d="M12 16V4m0 0-4 4m4-4 4 4M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
		</svg>
		<span id="{id}-cta" class="filedrop__cta">{callToAction}</span>
		{#if limits}<span id="{id}-limits" class="filedrop__limits">{limits}</span>{/if}
	</button>
	<input
		bind:this={picker}
		class="filedrop__picker"
		type="file"
		tabindex="-1"
		aria-hidden="true"
		{accept}
		{multiple}
		{disabled}
		on:change={onPick}
	/>
	{#if hint}<p id="{id}-hint" class="filedrop__hint">{hint}</p>{/if}
	{#if rejections.length > 0}
		<ul class="filedrop__rejections" role="alert">
			{#each rejections as rejection}
				<li>{rejection.reason}</li>
			{/each}
		</ul>
	{/if}
	{#if files.length > 0}
		<ul class="filedrop__files" aria-label="Chosen files">
			{#each files as file, i}
				<li class="filedrop__file">
					<span class="filedrop__name">{file.name}</span>
					<span class="filedrop__size">{formatBytes(file.size)}</span>
					<button
						type="button"
						class="filedrop__remove"
						aria-label="Remove {file.name}"
						{disabled}
						on:click={() => remove(i)}
					>
						<span aria-hidden="true">×</span>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
	<span class="sr-only" role="status">{announcement}</span>
</div>

<style>
	.filedrop {
		display: grid;
		gap: var(--spacing-xs);
		min-width: 0;
	}

	.filedrop__label {
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--color-text);
	}

	.filedrop__zone {
		display: grid;
		justify-items: center;
		gap: var(--spacing-xs);
		width: 100%;
		padding: var(--spacing-xl) var(--spacing-md);
		border: 2px dashed var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		color: var(--color-text-secondary);
		font: inherit;
		text-align: center;
		cursor: pointer;
		transition:
			border-color var(--transition-fast),
			background-color var(--transition-fast);
	}

	.filedrop__zone:hover:not(:disabled),
	.filedrop__zone--dragging {
		border-color: var(--color-primary);
		background: var(--color-surface-hover);
	}

	.filedrop__zone--dragging {
		color: var(--color-primary);
	}

	.filedrop__zone:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.filedrop__zone:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.filedrop__cta {
		color: var(--color-text);
		font-weight: 600;
	}

	.filedrop__limits {
		font-size: 0.8125rem;
	}

	.filedrop__picker {
		display: none;
	}

	.filedrop__hint {
		margin: 0;
		font-size: 0.8125rem;
		color: var(--color-text-secondary);
	}

	.filedrop__rejections {
		margin: 0;
		padding-left: 1.25rem;
		color: var(--color-error);
		font-size: 0.8125rem;
		font-weight: 600;
	}

	.filedrop__files {
		display: grid;
		gap: var(--spacing-xs);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.filedrop__file {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		min-width: 0;
		padding: var(--spacing-xs) var(--spacing-xs) var(--spacing-xs) var(--spacing-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		color: var(--color-text);
	}

	.filedrop__name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.filedrop__size {
		flex-shrink: 0;
		color: var(--color-text-secondary);
		font-size: 0.8125rem;
		font-variant-numeric: tabular-nums;
	}

	.filedrop__remove {
		display: grid;
		place-items: center;
		width: 2rem;
		height: 2rem;
		flex-shrink: 0;
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-text-secondary);
		font-size: 1.125rem;
		cursor: pointer;
	}

	.filedrop__remove:hover:not(:disabled) {
		background: var(--color-surface-hover);
		color: var(--color-danger);
	}

	.filedrop__remove:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 1px;
	}

	@media (prefers-reduced-motion: reduce) {
		.filedrop__zone {
			transition: none;
		}
	}
</style>
