<!--
  Content Proof Panel

  Shows the provable-timestamping evidence for a prediction: the canonical
  content hash, a downloadable RFC 3161 timestamp token (.tsr), instructions
  for independently verifying it with openssl, and a Wayback Machine snapshot
  link. Shared between the public item page and the admin editor.
-->
<script lang="ts">
	import type { ContentItemParsed } from '$lib/cms/types';

	export let item: ContentItemParsed;

	let copied = false;

	function copyHash() {
		if (!item.timestampProofHash) return;
		navigator.clipboard.writeText(item.timestampProofHash);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}

	$: tsrHref = item.timestampProofTsr
		? `data:application/timestamp-reply;base64,${item.timestampProofTsr}`
		: null;
	$: verifyCommand = item.timestampProofHash
		? `openssl ts -verify -digest ${item.timestampProofHash} -in ${item.slug}.tsr -CAfile cacert.pem`
		: '';
</script>

<div class="proof-panel">
	<h2 class="proof-heading">Proof of timestamp</h2>

	{#if !item.timestampProofRequestedAt}
		<p class="proof-pending">Timestamp proof is being requested — check back shortly.</p>
	{:else if item.timestampProofHash}
		<div class="proof-row">
			<span class="proof-label">SHA-256 hash</span>
			<div class="proof-hash-wrap">
				<code class="proof-hash">{item.timestampProofHash}</code>
				<button type="button" class="proof-copy" on:click={copyHash}>
					{copied ? 'Copied' : 'Copy'}
				</button>
			</div>
		</div>

		{#if tsrHref}
			<div class="proof-row">
				<a class="proof-download" href={tsrHref} download="{item.slug}.tsr">
					Download timestamp token (.tsr)
				</a>
			</div>
			<div class="proof-row">
				<span class="proof-label">Verify independently</span>
				<pre class="proof-command"><code>{verifyCommand}</code></pre>
				<p class="proof-note">
					Requires FreeTSA's CA certificate (<a
						href="https://www.freetsa.org/files/cacert.pem"
						target="_blank"
						rel="noopener noreferrer">cacert.pem</a
					>) and <code>openssl</code>. This confirms the hash of this prediction's exact content was
					registered with an independent timestamp authority at the time shown below.
				</p>
			</div>
		{:else if item.timestampProofError}
			<p class="proof-error">
				Timestamp authority request failed: {item.timestampProofError}. The content hash above was
				still recorded at first publish.
			</p>
		{/if}

		{#if item.timestampProofRequestedAt}
			<div class="proof-row">
				<span class="proof-label">Requested at</span>
				<time datetime={item.timestampProofRequestedAt}>
					{new Date(item.timestampProofRequestedAt).toISOString()}
				</time>
			</div>
		{/if}
	{/if}

	<div class="proof-row">
		<span class="proof-label">Wayback Machine</span>
		{#if item.waybackSnapshotUrl}
			<a href={item.waybackSnapshotUrl} target="_blank" rel="noopener noreferrer">
				View archived snapshot
			</a>
		{:else}
			<span class="proof-pending">Snapshot capture pending.</span>
		{/if}
	</div>
</div>

<style>
	.proof-panel {
		margin-top: var(--spacing-xl);
		padding: var(--spacing-lg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
	}

	.proof-heading {
		font-size: 1.125rem;
		font-weight: 600;
		margin-bottom: var(--spacing-md);
	}

	.proof-row {
		margin-bottom: var(--spacing-md);
	}

	.proof-row:last-child {
		margin-bottom: 0;
	}

	.proof-label {
		display: block;
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--color-text-secondary);
		margin-bottom: var(--spacing-xs);
	}

	.proof-hash-wrap {
		display: flex;
		align-items: flex-start;
		gap: var(--spacing-sm);
	}

	.proof-hash {
		flex: 1;
		min-width: 0;
		font-family: 'Fira Code', 'Consolas', monospace;
		font-size: 0.8125rem;
		word-break: break-all;
	}

	.proof-copy {
		flex-shrink: 0;
		font-size: 0.75rem;
		padding: var(--spacing-xs) var(--spacing-sm);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-surface);
		color: var(--color-text);
		cursor: pointer;
	}

	.proof-copy:hover {
		background: var(--color-surface-hover);
	}

	.proof-download {
		color: var(--color-primary);
		text-decoration: underline;
	}

	.proof-command {
		font-family: 'Fira Code', 'Consolas', monospace;
		font-size: 0.75rem;
		background: var(--color-bg, var(--color-surface));
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		padding: var(--spacing-sm);
		overflow-x: auto;
		white-space: pre-wrap;
		word-break: break-all;
	}

	.proof-note {
		font-size: 0.8125rem;
		color: var(--color-text-secondary);
		margin-top: var(--spacing-xs);
	}

	.proof-pending {
		font-size: 0.875rem;
		color: var(--color-text-secondary);
		font-style: italic;
	}

	.proof-error {
		font-size: 0.875rem;
		color: var(--color-text-secondary);
	}
</style>
