<script lang="ts">
	import type { PageData } from './$types';

	export let data: PageData;

	const CATEGORIES = [
		{ key: 'performance', label: 'Performance' },
		{ key: 'accessibility', label: 'Accessibility' },
		{ key: 'best_practices', label: 'Best practices' },
		{ key: 'seo', label: 'SEO' }
	] as const;

	/** Lighthouse's own bands, so a number here means what it means in a report. */
	function band(score: number | null): string {
		if (score === null) return 'none';
		if (score >= 90) return 'good';
		if (score >= 50) return 'average';
		return 'poor';
	}

	/** Findings for one audited page, so each row can show its own problems. */
	$: findingsFor = (path: string, strategy: string) =>
		data.findings.filter((f) => f.path === path && f.strategy === strategy);

	$: worstFirst = data.audits;
	$: lastRun = data.audits.reduce<string | null>(
		(latest, a) => (!latest || a.fetched_at > latest ? a.fetched_at : latest),
		null
	);

	let running = false;
	let message: string | null = null;

	async function runNow() {
		running = true;
		message = null;
		try {
			const response = await fetch('/api/admin/lighthouse', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ strategy: 'mobile' })
			});
			if (!response.ok) throw new Error(`Run failed (${response.status})`);
			const result = (await response.json()) as { audited: number; failed: number };
			message = `Audited ${result.audited} pages, ${result.failed} could not be reached. Reload to see the results.`;
		} catch (cause) {
			// Surfaced rather than swallowed: a sweep can take a minute and the
			// reader needs to know whether it finished or died.
			message = cause instanceof Error ? cause.message : 'Run failed';
		} finally {
			running = false;
		}
	}
</script>

<svelte:head><title>Lighthouse — Admin</title></svelte:head>

<div class="lh-admin">
	<header class="page-header">
		<div>
			<h1>Lighthouse</h1>
			<p class="lede">
				Scores for this app's own public pages, measured by
				<a
					href="https://developer.chrome.com/docs/lighthouse/overview"
					target="_blank"
					rel="noopener noreferrer">Lighthouse</a
				>
				through Google's PageSpeed Insights.
				{#if lastRun}
					Last run <time datetime={lastRun}>{new Date(lastRun).toLocaleString()}</time>.
				{/if}
			</p>
		</div>
		<button type="button" class="run" on:click={runNow} disabled={running}>
			{running ? 'Running…' : 'Run now'}
		</button>
	</header>

	{#if message}
		<p class="notice" role="status">{message}</p>
	{/if}

	{#if data.urlLooksPlaceholder}
		<p class="notice warn">
			<strong>Nothing to audit yet.</strong> PageSpeed Insights can only reach a public URL, and
			<code>site.url</code> is still <code>{data.siteUrl}</code>. Set it to your deployed address in
			<code>src/lib/site.config.ts</code> and run again.
		</p>
	{/if}

	{#if worstFirst.length === 0}
		<p class="empty">
			No audit stored yet. Press <strong>Run now</strong>, or schedule
			<code>POST /api/cron/lighthouse</code> with your <code>CRON_SECRET</code>.
		</p>
	{:else}
		<table class="audits">
			<caption class="sr-only">Lighthouse scores per page, worst first</caption>
			<thead>
				<tr>
					<th scope="col">Page</th>
					{#each CATEGORIES as category (category.key)}
						<th scope="col">{category.label}</th>
					{/each}
					<th scope="col">Issues</th>
				</tr>
			</thead>
			<tbody>
				{#each worstFirst as audit (audit.path + audit.strategy)}
					{@const issues = findingsFor(audit.path, audit.strategy)}
					<tr>
						<th scope="row">
							<code>{audit.path}</code>
							<span class="strategy">{audit.strategy}</span>
						</th>
						{#if audit.error}
							<td class="error" colspan={CATEGORIES.length}>{audit.error}</td>
						{:else}
							{#each CATEGORIES as category (category.key)}
								<td>
									<span class="score {band(audit[category.key])}">
										{audit[category.key] ?? '—'}
									</span>
								</td>
							{/each}
						{/if}
						<td class="issue-count">{issues.length || '—'}</td>
					</tr>
					{#if issues.length}
						<tr class="issues-row">
							<td colspan={CATEGORIES.length + 2}>
								<ul class="issues">
									{#each issues as issue (issue.audit_id)}
										<li>
											<span class="issue-score {band(issue.score)}">{issue.score ?? 0}</span>
											<div>
												<p class="issue-title">
													{issue.title}
													<span class="issue-cat">{issue.category}</span>
													{#if issue.display_value}
														<span class="issue-value">{issue.display_value}</span>
													{/if}
												</p>
												{#if issue.description}
													<p class="issue-desc">{issue.description}</p>
												{/if}
											</div>
										</li>
									{/each}
								</ul>
							</td>
						</tr>
					{/if}
				{/each}
			</tbody>
		</table>
	{/if}
</div>

<style>
	.lh-admin {
		max-width: var(--layout-page-max-width);
		margin: 0 auto;
	}

	.page-header {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--spacing-md);
		margin-bottom: var(--spacing-xl);
	}

	h1 {
		margin: 0 0 var(--spacing-xs);
		font-size: 1.75rem;
		font-weight: 700;
	}

	.lede {
		margin: 0;
		max-width: 60ch;
		color: var(--color-text-secondary);
		line-height: 1.6;
	}

	.lede a {
		color: var(--color-primary);
	}

	.run {
		padding: 0.55rem 1.1rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-text);
		font-weight: 600;
		cursor: pointer;
	}

	.run:hover:not(:disabled) {
		border-color: var(--color-primary);
		color: var(--color-primary);
	}

	.run:disabled {
		opacity: 0.6;
		cursor: progress;
	}

	.notice,
	.empty {
		margin: 0 0 var(--spacing-lg);
		padding: var(--spacing-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-text-secondary);
		line-height: 1.6;
	}

	.notice.warn {
		border-color: color-mix(in srgb, var(--color-warning) 55%, transparent);
	}

	.audits {
		width: 100%;
		border-collapse: collapse;
	}

	.audits th,
	.audits td {
		padding: var(--spacing-sm) var(--spacing-md);
		border: 0;
		border-bottom: 1px solid var(--color-border);
		text-align: center;
		vertical-align: middle;
	}

	.audits thead th {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-text-secondary);
	}

	.audits tbody th[scope='row'] {
		text-align: left;
		font-weight: 600;
		width: 99%;
	}

	.strategy {
		display: inline-block;
		margin-left: var(--spacing-sm);
		font-size: 0.6875rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-text-secondary);
	}

	.score {
		display: inline-block;
		min-width: 2.5rem;
		padding: 0.15rem 0.5rem;
		border-radius: var(--radius-sm);
		font-variant-numeric: tabular-nums;
		font-weight: 700;
	}

	/* Colour is never the only carrier — the number is the value, and the column
	   header names the category. */
	.score.good,
	.issue-score.good {
		background: color-mix(in srgb, var(--color-success) 16%, transparent);
	}

	.score.average,
	.issue-score.average {
		background: color-mix(in srgb, var(--color-warning) 22%, transparent);
	}

	.score.poor,
	.issue-score.poor {
		background: color-mix(in srgb, var(--color-error) 18%, transparent);
	}

	.error {
		color: var(--color-error);
		text-align: left;
	}

	.issue-count {
		font-variant-numeric: tabular-nums;
		color: var(--color-text-secondary);
	}

	.issues-row td {
		padding-top: 0;
		text-align: left;
		background: var(--color-surface);
	}

	.issues {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-sm);
	}

	.issues li {
		display: flex;
		gap: var(--spacing-md);
		align-items: flex-start;
	}

	.issue-score {
		flex: none;
		min-width: 2.25rem;
		padding: 0.1rem 0.4rem;
		border-radius: var(--radius-sm);
		font-size: 0.8125rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		text-align: center;
	}

	.issue-title {
		margin: 0;
		font-size: 0.9375rem;
		font-weight: 600;
	}

	.issue-cat,
	.issue-value {
		margin-left: var(--spacing-sm);
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--color-text-secondary);
	}

	.issue-desc {
		margin: 0.15rem 0 0;
		font-size: 0.8125rem;
		line-height: 1.55;
		color: var(--color-text-secondary);
		max-width: 80ch;
	}
</style>
