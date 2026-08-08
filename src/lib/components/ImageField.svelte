<!--
  ImageField — CMS field editor for image-type fields.
  A URL input (external URLs still allowed) plus an Upload button that
  stores the file in R2 and fills in the /media/... URL, with a preview.
-->
<script lang="ts">
	import { extractImageFiles, uploadImage } from '$lib/cms/richtext-utils';

	export let value = '';
	export let placeholder = 'https://… or upload';

	let fileInput: HTMLInputElement | null = null;
	let uploading = false;
	let uploadError = '';

	async function handleFilePick(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const [file] = extractImageFiles({ files: input.files ?? [] });
		input.value = '';
		if (!file) return;

		uploading = true;
		uploadError = '';
		const result = await uploadImage(file);
		if (result.ok) {
			value = result.url;
		} else {
			uploadError = result.error;
		}
		uploading = false;
	}
</script>

<div class="image-field">
	<div class="image-field-row">
		<input type="text" bind:value {placeholder} aria-label="Image URL" />
		<button
			type="button"
			class="image-field-upload"
			disabled={uploading}
			on:click={() => fileInput?.click()}
		>
			{uploading ? 'Uploading…' : 'Upload'}
		</button>
	</div>
	{#if uploadError}
		<p class="image-field-error" role="alert">{uploadError}</p>
	{/if}
	{#if value}
		<img class="image-field-preview" src={value} alt="Preview" />
	{/if}
	<input
		type="file"
		accept="image/png,image/jpeg,image/gif,image/webp"
		class="image-field-file"
		bind:this={fileInput}
		on:change={handleFilePick}
		aria-label="Upload image file"
	/>
</div>

<style>
	.image-field {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.image-field-row {
		display: flex;
		gap: 0.375rem;
	}

	.image-field-row input[type='text'] {
		flex: 1;
		padding: 0.5rem 0.75rem;
		background: var(--color-background);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		color: var(--color-text);
		font-size: 0.875rem;
	}

	.image-field-upload {
		padding: 0.5rem 0.875rem;
		background: var(--color-background);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		color: var(--color-text);
		font-size: 0.8125rem;
		cursor: pointer;
		flex: none;
	}

	.image-field-upload:hover:not(:disabled) {
		border-color: var(--color-primary);
	}

	.image-field-upload:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.image-field-error {
		color: var(--color-danger, #ef4444);
		font-size: 0.8125rem;
		margin: 0;
	}

	.image-field-preview {
		max-width: 240px;
		max-height: 140px;
		object-fit: cover;
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
	}

	.image-field-file {
		display: none;
	}
</style>
