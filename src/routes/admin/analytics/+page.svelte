<script lang="ts">
	import SharingMeta from '$lib/components/SharingMeta.svelte';
	import { fieldName } from '$lib/utils/form-fields';
	import { parseMeasurementId, type AnalyticsConfig } from '$lib/utils/analytics';
	import type { PageData } from './$types';

	export let data: PageData;

	let config: AnalyticsConfig | null = data.config;
	$: config = data.config;

	let input = '';
	let saving = false;
	let toggling = false;
	let disconnecting = false;
	let errorMessage = '';
	let successMessage = '';

	// Live preview of what the parser will take from the field, so pasting the
	// whole snippet shows the extracted ID before anything is saved.
	$: preview = input.trim() ? parseMeasurementId(input) : null;

	function formatUpdated(iso: string): string {
		if (!iso) return 'unknown';
		const date = new Date(iso);
		return Number.isNaN(date.getTime()) ? 'unknown' : date.toLocaleString();
	}

	async function send(body: Record<string, unknown>, method: 'POST' | 'DELETE' = 'POST') {
		errorMessage = '';
		successMessage = '';

		const response = await fetch('/api/admin/settings/analytics', {
			method,
			headers: { 'Content-Type': 'application/json' },
			body: method === 'DELETE' ? undefined : JSON.stringify(body)
		});

		const payload = await response.json().catch(() => ({}));
		if (!response.ok) {
			throw new Error(payload.message || 'Request failed');
		}
		config = payload.config ?? null;
	}

	async function save() {
		saving = true;
		try {
			await send({ measurementId: input, enabled: true });
			input = '';
			successMessage = 'Google Analytics connected. New page views start on the next visit.';
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Failed to save';
		} finally {
			saving = false;
		}
	}

	async function toggleEnabled() {
		if (!config) return;
		toggling = true;
		try {
			await send({ enabled: !config.enabled });
			successMessage = config?.enabled ? 'Tracking resumed.' : 'Tracking paused.';
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Failed to update';
		} finally {
			toggling = false;
		}
	}

	async function disconnect() {
		disconnecting = true;
		try {
			await send({}, 'DELETE');
			successMessage = 'Disconnected. The tag no longer loads on any page.';
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Failed to disconnect';
		} finally {
			disconnecting = false;
		}
	}
</script>

<SharingMeta title="Analytics" noindex={true} />

<div class="admin-analytics">
	<header class="page-header">
		<h1>Analytics</h1>
		<p>
			Connect a Google Analytics 4 property. This is optional and additive — the built-in
			<a href="/admin/stats">Stats</a> page keeps working either way.
		</p>
	</header>

	<div class="cards">
		<section class="card">
			<h2>
				<svg
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<line x1="18" y1="20" x2="18" y2="10" />
					<line x1="12" y1="20" x2="12" y2="4" />
					<line x1="6" y1="20" x2="6" y2="14" />
				</svg>
				Google Analytics
			</h2>

			{#if config}
				<div class="info-row">
					<span class="label">Measurement ID</span>
					<span class="value mono">{config.measurementId}</span>
				</div>
				<div class="info-row">
					<span class="label">Last changed</span>
					<span class="value">{formatUpdated(config.updatedAt)}</span>
				</div>
				<div class="setting-row">
					<div class="setting-info">
						<span class="setting-label">Load the tag</span>
						<span class="setting-description">
							{config.enabled ? 'Running on public pages' : 'Paused — the tag loads nowhere'}
						</span>
					</div>
					<button
						class="toggle-btn"
						class:active={config.enabled}
						on:click={toggleEnabled}
						disabled={toggling}
						aria-label={config.enabled ? 'Pause Google Analytics' : 'Resume Google Analytics'}
					>
						<span class="toggle-slider"></span>
					</button>
				</div>

				<div
					class="status"
					class:status-success={config.enabled}
					class:status-muted={!config.enabled}
				>
					{config.enabled ? 'Connected' : 'Connected, paused'}
				</div>
			{:else}
				<div class="status status-muted">Not connected</div>
				<p class="hint">
					No third-party tag loads on this site until you add a Measurement ID here.
				</p>
			{/if}

			<div class="field">
				<label for={fieldName('ga-measurement-id')}>
					{config ? 'Replace the Measurement ID' : 'Measurement ID'}
				</label>
				<textarea
					id={fieldName('ga-measurement-id')}
					name={fieldName('ga-measurement-id')}
					rows="3"
					bind:value={input}
					spellcheck="false"
					autocomplete="off"
					placeholder="G-ABCD123456 — or paste the whole gtag.js snippet"></textarea>
				<p class="field-hint">
					Google shows this under <strong>Admin → Data streams → your web stream</strong>. Paste
					either the ID on its own or the entire
					<code>&lt;script&gt;</code> block; the ID is read out of it.
				</p>

				{#if preview}
					{#if preview.ok}
						<p class="preview ok">Will save <code>{preview.measurementId}</code></p>
					{:else}
						<p class="preview bad">{preview.reason}</p>
					{/if}
				{/if}
			</div>

			{#if errorMessage}
				<p class="error-text">{errorMessage}</p>
			{/if}
			{#if successMessage}
				<p class="success-text">{successMessage}</p>
			{/if}

			<div class="actions">
				<button class="btn primary" on:click={save} disabled={saving || !preview?.ok}>
					{saving ? 'Saving…' : config ? 'Replace' : 'Connect'}
				</button>
				{#if config}
					<button class="btn danger" on:click={disconnect} disabled={disconnecting}>
						{disconnecting ? 'Disconnecting…' : 'Disconnect'}
					</button>
				{/if}
			</div>
		</section>

		<section class="card">
			<h2>
				<svg
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<circle cx="12" cy="12" r="10" />
					<line x1="12" y1="16" x2="12" y2="12" />
					<line x1="12" y1="8" x2="12.01" y2="8" />
				</svg>
				What changes when you connect
			</h2>
			<ul class="notes">
				<li>
					The tag loads on public pages only. <code>/admin</code>, <code>/api</code>, and
					<code>/setup</code> are excluded, so your own admin traffic stays out of the numbers.
				</li>
				<li>
					Page views are sent by the app on every client-side navigation, not by gtag's own
					automatic tracking — otherwise only the first page of a visit would be counted.
				</li>
				<li>
					Google Analytics sets cookies and collects per-visitor data. That is a different privacy
					posture from the built-in stats, so review your privacy policy and add a consent banner
					where your jurisdiction requires one.
				</li>
				<li>Only the owner can change this. Reports are read in Google's own console.</li>
			</ul>
		</section>
	</div>
</div>

<style>
	.admin-analytics {
		padding: var(--spacing-xl);
	}

	.page-header h1 {
		font-size: 2rem;
		font-weight: 700;
		color: var(--color-text);
		margin-bottom: var(--spacing-sm);
	}

	.page-header p {
		color: var(--color-text-secondary);
		font-size: 1.05rem;
		max-width: 60ch;
	}

	.page-header a {
		color: var(--color-primary);
	}

	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
		gap: var(--spacing-lg);
		margin-top: var(--spacing-xl);
		align-items: start;
	}

	.card {
		background-color: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		padding: var(--spacing-lg);
	}

	.card h2 {
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--color-text);
		margin-bottom: var(--spacing-md);
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
	}

	.card h2 svg {
		color: var(--color-primary);
	}

	.info-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--spacing-md);
		padding: var(--spacing-sm) 0;
		border-bottom: 1px solid var(--color-border);
	}

	.label {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-text-secondary);
	}

	.value {
		font-size: 0.875rem;
		color: var(--color-text);
		font-weight: 500;
	}

	.mono {
		font-family: 'Courier New', monospace;
	}

	.setting-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--spacing-md);
		padding: var(--spacing-md) 0;
	}

	.setting-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.setting-label {
		font-size: 0.9rem;
		font-weight: 500;
		color: var(--color-text);
	}

	.setting-description {
		font-size: 0.8rem;
		color: var(--color-text-secondary);
	}

	.toggle-btn {
		position: relative;
		flex-shrink: 0;
		width: 48px;
		height: 26px;
		background: var(--color-border);
		border: none;
		border-radius: 13px;
		cursor: pointer;
		transition: background var(--transition-fast);
	}

	.toggle-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.toggle-btn.active {
		background: var(--color-primary);
	}

	.toggle-slider {
		position: absolute;
		top: 3px;
		left: 3px;
		width: 20px;
		height: 20px;
		background: white;
		border-radius: 50%;
		transition: transform var(--transition-fast);
	}

	.toggle-btn.active .toggle-slider {
		transform: translateX(22px);
	}

	.status {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-xs);
		margin-top: var(--spacing-sm);
		padding: var(--spacing-xs) var(--spacing-sm);
		border-radius: var(--radius-sm);
		font-size: 0.875rem;
		font-weight: 500;
	}

	.status-success {
		background-color: color-mix(in srgb, var(--color-success) 14%, transparent);
		color: var(--color-success);
		border: 1px solid color-mix(in srgb, var(--color-success) 45%, var(--color-border));
	}

	.status-muted {
		background-color: var(--color-surface-hover);
		color: var(--color-text-secondary);
		border: 1px solid var(--color-border);
	}

	.hint {
		font-size: 0.875rem;
		color: var(--color-text-secondary);
		margin-top: var(--spacing-sm);
	}

	.field {
		margin-top: var(--spacing-lg);
	}

	.field label {
		display: block;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-text);
		margin-bottom: var(--spacing-xs);
	}

	.field textarea {
		width: 100%;
		font-family: 'Courier New', monospace;
		font-size: 0.85rem;
		padding: var(--spacing-sm);
		color: var(--color-text);
		background: var(--color-background);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		resize: vertical;
	}

	.field textarea:focus {
		outline: 2px solid var(--color-primary);
		outline-offset: 1px;
	}

	.field-hint {
		font-size: 0.8rem;
		color: var(--color-text-secondary);
		margin-top: var(--spacing-xs);
	}

	.preview {
		font-size: 0.85rem;
		margin-top: var(--spacing-xs);
	}

	.preview.ok {
		color: var(--color-success);
	}

	.preview.bad {
		color: var(--color-error);
	}

	.notes {
		margin: 0;
		padding-left: 1.1rem;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-sm);
		color: var(--color-text-secondary);
		font-size: 0.9rem;
		line-height: 1.5;
	}

	.actions {
		display: flex;
		gap: var(--spacing-sm);
		margin-top: var(--spacing-lg);
		flex-wrap: wrap;
	}

	.btn {
		padding: var(--spacing-sm) var(--spacing-lg);
		border-radius: var(--radius-sm);
		border: 1px solid var(--color-border);
		background: var(--color-background);
		color: var(--color-text);
		font-size: 0.9rem;
		font-weight: 600;
		cursor: pointer;
		transition: opacity var(--transition-fast);
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn.primary {
		background: var(--color-primary);
		border-color: var(--color-primary);
		color: var(--color-background);
	}

	.btn.danger {
		color: var(--color-error);
		border-color: var(--color-error);
	}

	.error-text {
		color: var(--color-error);
		font-size: 0.85rem;
		margin-top: var(--spacing-sm);
	}

	.success-text {
		color: var(--color-success);
		font-size: 0.85rem;
		margin-top: var(--spacing-sm);
	}
</style>
