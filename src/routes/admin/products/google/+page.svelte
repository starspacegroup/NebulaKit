<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const feed = $derived(data.feedUrls);
	const audit = $derived(data.audit);
	const siteIssues = $derived(audit.site);
	const settings = $derived(data.settings);

	/** A fixed UTC rendering: no viewer locale, so every admin reads the same time. */
	function utc(iso: string | null | undefined): string {
		return iso ? `${iso.slice(0, 16).replace('T', ' ')} UTC` : 'never';
	}
</script>

<svelte:head><title>Google listings</title></svelte:head>

<section class="google-page">
	<h1>Google listings</h1>
	<p>
		Your shop is eligible for free listings and Shopping ads when Merchant Center reads the feed
		below with no products rejected. <a href="/admin/products">Back to products</a>.
	</p>

	<div role="status" aria-live="polite">
		{#if form?.message}<p class="ok">{form.message}</p>{/if}
		{#if form?.problems}
			<ul class="error" role="alert">
				{#each form.problems as problem (problem)}<li>{problem}</li>{/each}
			</ul>
		{/if}
	</div>

	<div class="card" aria-labelledby="feed-heading">
		<h2 id="feed-heading">Feed address</h2>
		<p>
			Paste this into Merchant Center as a scheduled fetch (Products, Data sources, Add a product
			source, Scheduled fetch).
		</p>
		<p><code data-testid="feed-url">{feed.rss}</code></p>
		<p class="muted">
			Same data, tab-separated: <code>{feed.tsv}</code>. Last fetched by anything:
			<strong data-testid="last-fetched">{utc(data.lastFetched?.at)}</strong>
			{#if data.lastFetched?.by}<span class="muted">({data.lastFetched.by})</span>{/if}
		</p>
	</div>

	<div class="card" aria-labelledby="health-heading">
		<h2 id="health-heading">Feed health</h2>
		<ul class="counts">
			<li><strong data-testid="count-valid">{audit.valid}</strong> in the feed</li>
			<li><strong data-testid="count-invalid">{audit.invalid}</strong> left out (errors)</li>
			<li><strong data-testid="count-warnings">{audit.withWarnings}</strong> with warnings</li>
			<li><strong>{audit.checked}</strong> checked</li>
		</ul>
		{#if audit.capped}
			<p class="muted">Only the first {audit.checked} products were checked.</p>
		{/if}
		{#if siteIssues.length}
			<h3>Whole shop</h3>
			<ul class="problems">
				{#each siteIssues as p (p.message)}
					<li class={p.severity}><span class="tag">{p.severity}</span> {p.message}</li>
				{/each}
			</ul>
		{/if}
		<h3>Products</h3>
		{#if audit.problems.length === 0}
			<p>Nothing to fix.</p>
		{:else}
			<p class="muted">
				First {data.problemLimit} problems, errors first. Products with an error are not in the feed.
			</p>
			<ul class="problems" aria-label="Product problems">
				{#each audit.problems as p (p.productId + p.attribute + p.message)}
					<li class={p.severity}>
						<span class="tag">{p.severity}</span>
						<a href={`/admin/products#product-${p.productId}`}>{p.name}</a>
						<span class="muted">{p.attribute}</span>: {p.message}
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<form
		method="POST"
		action="?/settings"
		use:enhance
		class="card"
		aria-labelledby="settings-heading"
	>
		<h2 id="settings-heading">Shipping, returns and brand</h2>
		<p class="muted">
			Used in the feed and in each product page's structured data. A section left blank is not
			claimed anywhere.
		</p>
		<div class="fields">
			<label>
				Default brand
				<input name="defaultBrand" maxlength="70" value={settings.defaultBrand} />
			</label>
			<label>
				Content language
				<input name="contentLanguage" maxlength="2" value={settings.contentLanguage} />
			</label>
			<label class="wide">
				Ship-to countries (two-letter codes, comma separated)
				<input name="shipCountries" placeholder="US, CA" value={settings.shipCountries} />
			</label>
			<label>
				Handling days, from
				<input name="handlingDaysMin" inputmode="numeric" value={settings.handlingDaysMin} />
			</label>
			<label>
				Handling days, to
				<input name="handlingDaysMax" inputmode="numeric" value={settings.handlingDaysMax} />
			</label>
			<label>
				Transit days, from
				<input name="transitDaysMin" inputmode="numeric" value={settings.transitDaysMin} />
			</label>
			<label>
				Transit days, to
				<input name="transitDaysMax" inputmode="numeric" value={settings.transitDaysMax} />
			</label>
			<label>
				Return policy
				<select name="returnCategory">
					<option value="" selected={settings.returnCategory === ''}>Not stated</option>
					<option value="finite" selected={settings.returnCategory === 'finite'}
						>Returns within a window</option
					>
					<option value="unlimited" selected={settings.returnCategory === 'unlimited'}
						>Returns any time</option
					>
					<option value="none" selected={settings.returnCategory === 'none'}>No returns</option>
				</select>
			</label>
			<label>
				Return window (days)
				<input name="returnDays" inputmode="numeric" value={settings.returnDays} />
			</label>
			<label>
				Return costs
				<select name="returnFees">
					<option value="free" selected={settings.returnFees === 'free'}>Free returns</option>
					<option value="customer" selected={settings.returnFees === 'customer'}
						>Customer pays</option
					>
					<option value="shipping_fee" selected={settings.returnFees === 'shipping_fee'}
						>Flat return shipping fee</option
					>
				</select>
			</label>
			<label>
				Return shipping fee
				<input name="returnFeeAmount" inputmode="decimal" value={settings.returnFeeAmount} />
			</label>
			<label class="wide">
				Returns apply in (blank means the ship-to countries)
				<input name="returnCountries" value={settings.returnCountries} />
			</label>
		</div>
		<fieldset class="methods">
			<legend>Return methods</legend>
			{#each [['mail', 'By mail'], ['store', 'In store'], ['kiosk', 'At a kiosk']] as [value, label] (value)}
				<label class="check"
					><input
						type="checkbox"
						name="returnMethods"
						{value}
						checked={settings.returnMethods.includes(value as 'mail')}
					/>
					{label}</label
				>
			{/each}
		</fieldset>
		<button type="submit">Save</button>
	</form>

	<div class="card" aria-labelledby="sync-heading">
		<h2 id="sync-heading">Merchant API sync (optional)</h2>
		<p class="muted">
			Off by default. The feed above needs no credentials and is enough for most shops. This sends
			changes to Merchant Center every ten minutes instead of waiting for its next fetch, using a
			service-account key kept encrypted in KV.
			{#if data.merchant.lastRun}
				Last run {utc(data.merchant.lastRun.at)}: sent {data.merchant.lastRun.sent}, deleted
				{data.merchant.lastRun.deleted}, failed {data.merchant.lastRun
					.failed}{#if data.merchant.lastRun.error}
					({data.merchant.lastRun.error}){/if}.
			{/if}
		</p>
		{#if !data.isOwner}
			<p>Only the owner can change the sync.</p>
		{:else}
			<form method="POST" action="?/key" use:enhance class="stack">
				<label>
					Service-account key file (JSON)
					<textarea name="serviceAccountJson" rows="3" autocomplete="off" spellcheck="false"
					></textarea>
				</label>
				<p class="muted">
					{#if data.serviceAccount.configured}A key is stored for {data.serviceAccount.clientEmail}.
						It is never shown again.{:else}No key stored.{/if}
				</p>
				<div class="actions">
					<button type="submit">Store key</button>
					{#if data.serviceAccount.configured}
						<button type="submit" formaction="?/clearKey" class="secondary">Remove key</button>
					{/if}
				</div>
			</form>
			<form method="POST" action="?/sync" use:enhance class="stack">
				<div class="fields">
					<label>
						Merchant Center account id
						<input name="accountId" inputmode="numeric" value={data.merchant.accountId} />
					</label>
					<label>
						API data source id
						<input name="dataSourceId" inputmode="numeric" value={data.merchant.dataSourceId} />
					</label>
					<label>
						Feed label (target market)
						<input
							name="feedLabel"
							placeholder="US"
							maxlength="20"
							value={data.merchant.feedLabel}
						/>
					</label>
				</div>
				<label class="check"
					><input type="checkbox" name="enabled" checked={data.merchant.enabled} /> Send changes to Merchant
					Center</label
				>
				<button type="submit">Save sync settings</button>
			</form>
		{/if}
	</div>
</section>

<style>
	.google-page {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		color: var(--color-text);
	}
	p,
	.muted {
		color: var(--color-text-secondary);
	}
	.card {
		padding: 1rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	h2,
	h3 {
		margin: 0;
		font-size: 1.1rem;
	}
	h3 {
		font-size: 1rem;
	}
	code {
		overflow-wrap: anywhere;
		color: var(--color-text);
	}
	.counts {
		display: flex;
		flex-wrap: wrap;
		gap: 1.5rem;
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.problems {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.problems li {
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
	}
	.tag {
		display: inline-block;
		margin-right: 0.5rem;
		padding: 0.05rem 0.5rem;
		border: 1px solid currentColor;
		border-radius: 999px;
		font-size: 0.75rem;
		text-transform: uppercase;
	}
	li.error .tag {
		color: var(--color-error);
	}
	li.warning .tag {
		color: var(--color-text-secondary);
	}
	.fields {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.75rem;
	}
	@media (min-width: 40rem) {
		.fields {
			grid-template-columns: repeat(2, 1fr);
		}
	}
	@media (min-width: 64rem) {
		.fields {
			grid-template-columns: repeat(4, 1fr);
		}
	}
	.wide {
		grid-column: 1 / -1;
	}
	.stack {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	label.check {
		flex-direction: row;
		align-items: center;
		gap: 0.5rem;
	}
	fieldset.methods {
		display: flex;
		flex-wrap: wrap;
		gap: 1.5rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
	}
	input,
	select,
	textarea {
		min-height: 2.75rem;
		padding: 0.5rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-background);
		color: var(--color-text);
		font: inherit;
	}
	input[type='checkbox'] {
		min-height: 0;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	button {
		align-self: flex-start;
		min-height: 2.75rem;
		padding: 0 1rem;
		border: 0;
		border-radius: var(--radius-md);
		background: var(--color-primary-solid);
		color: var(--color-on-solid);
		font: inherit;
		cursor: pointer;
	}
	button.secondary {
		border: 1px solid var(--color-border);
		background: transparent;
		color: var(--color-text);
	}
	.ok {
		color: var(--color-success);
	}
	.error {
		margin: 0;
		padding-left: 1.25rem;
		color: var(--color-error);
	}
</style>
