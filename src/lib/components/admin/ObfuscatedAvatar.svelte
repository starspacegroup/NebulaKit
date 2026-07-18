<script lang="ts">
	// Renders an avatar image, or a redacted silhouette when the URL is absent
	// (the server passes `src=null` while PII is hidden) or fails to load.
	export let src: string | null | undefined = undefined;
	export let alt = '';
	export let size = 40;

	let imgError = false;
</script>

{#if src && !imgError}
	<img
		{src}
		{alt}
		class="avatar"
		style="width:{size}px;height:{size}px"
		on:error={() => (imgError = true)}
		loading="lazy"
	/>
{:else}
	<div class="avatar-redacted" style="width:{size}px;height:{size}px" aria-label="[hidden]">
		<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
			<path
				d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
			/>
		</svg>
	</div>
{/if}

<style>
	.avatar {
		border-radius: 50%;
		object-fit: cover;
		flex-shrink: 0;
	}

	.avatar-redacted {
		border-radius: 50%;
		background: var(--color-border);
		color: var(--color-text-secondary);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.avatar-redacted svg {
		width: 60%;
		height: 60%;
	}
</style>
