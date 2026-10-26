<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';

	export let data: PageData;

	const HEALTH_LABEL: Record<string, string> = {
		'never-run': 'Never run',
		running: 'Running',
		stalled: 'Stalled',
		succeeded: 'Succeeded',
		failed: 'Failed',
		timed_out: 'Timed out'
	};

	/** Run rows carry unix seconds; the page shows the viewer's own time. */
	function when(seconds: number | null): string {
		return seconds === null ? '—' : new Date(seconds * 1000).toLocaleString();
	}

	function iso(seconds: number): string {
		return new Date(seconds * 1000).toISOString();
	}

	function took(start: number, end: number | null): string {
		return end === null ? '—' : `${Math.max(0, end - start)}s`;
	}

	let runningId: string | null = null;
	let message: string | null = null;
	let failed = false;

	async function runNow(jobId: string) {
		runningId = jobId;
		message = null;
		failed = false;
		try {
			const response = await fetch('/api/admin/scheduled-jobs/run', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ jobId })
			});
			if (!response.ok) throw new Error(`Run failed (${response.status})`);
			const result = (await response.json()) as { outcome: string; error?: string };
			failed = result.outcome === 'failed' || result.outcome === 'timed_out';
			message =
				result.outcome === 'skipped'
					? `${jobId} was skipped: it is already running, or already ran this minute.`
					: `${jobId} ${result.outcome.replace('_', ' ')}${result.error ? `: ${result.error}` : ''}.`;
			await invalidateAll();
		} catch (cause) {
			failed = true;
			message = cause instanceof Error ? cause.message : 'Run failed';
		} finally {
			runningId = null;
		}
	}
</script>

<svelte:head><title>Scheduled Jobs — Admin</title></svelte:head>

<div class="jobs-admin">
	<header class="page-header">
		<h1>Scheduled jobs</h1>
		<p class="lede">
			Background work that the cron Worker in <code>cron-worker/</code> triggers on a schedule. Times
			are shown in your local time zone; schedules are in UTC.
		</p>
	</header>

	<div class="live" role="status" aria-live="polite">
		{#if message}
			<p class="notice" class:bad={failed}>{message}</p>
		{/if}
	</div>

	<table class="jobs">
		<caption class="sr-only">Registered scheduled jobs</caption>
		<thead>
			<tr>
				<th scope="col">Job</th>
				<th scope="col">Schedule (UTC)</th>
				<th scope="col">Last run</th>
				<th scope="col">Status</th>
				<th scope="col">Next expected</th>
				<th scope="col"><span class="sr-only">Actions</span></th>
			</tr>
		</thead>
		<tbody>
			{#each data.jobs as job (job.id)}
				<tr>
					<th scope="row">
						<code>{job.id}</code>
						<span class="desc">{job.description}</span>
					</th>
					<td><code>{job.cron}</code></td>
					<td>
						{#if job.lastRun}
							<time datetime={iso(job.lastRun.started_at)}>{when(job.lastRun.started_at)}</time>
						{:else}
							—
						{/if}
					</td>
					<td>
						<span class="status {job.health}">{HEALTH_LABEL[job.health]}</span>
						{#if job.lastRun?.error}
							<span class="error">{job.lastRun.error}</span>
						{/if}
					</td>
					<td>
						{#if job.nextRunAt}
							<time datetime={job.nextRunAt}>{new Date(job.nextRunAt).toLocaleString()}</time>
						{:else}
							—
						{/if}
					</td>
					<td>
						<button
							type="button"
							class="run"
							on:click={() => runNow(job.id)}
							disabled={runningId !== null}
							aria-label={`Run ${job.id} now`}
						>
							{runningId === job.id ? 'Running…' : 'Run now'}
						</button>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>

	<h2>Recent runs</h2>
	{#if data.history.length === 0}
		<p class="empty">
			No runs yet. Press <strong>Run now</strong>, or deploy the cron Worker (see
			<code>docs/SCHEDULED_JOBS.md</code>).
		</p>
	{:else}
		<table class="jobs">
			<caption class="sr-only">Most recent job runs, newest first</caption>
			<thead>
				<tr>
					<th scope="col">Job</th>
					<th scope="col">Started</th>
					<th scope="col">Trigger</th>
					<th scope="col">Status</th>
					<th scope="col">Attempts</th>
					<th scope="col">Took</th>
				</tr>
			</thead>
			<tbody>
				{#each data.history as run (run.id)}
					<tr>
						<th scope="row"><code>{run.job_id}</code></th>
						<td><time datetime={iso(run.started_at)}>{when(run.started_at)}</time></td>
						<td>{run.trigger}</td>
						<td><span class="status {run.status}">{HEALTH_LABEL[run.status]}</span></td>
						<td class="num">{run.attempts}</td>
						<td class="num">{took(run.started_at, run.finished_at)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</div>

<style>
	.jobs-admin {
		max-width: var(--layout-page-max-width);
		margin: 0 auto;
	}

	.page-header {
		margin-bottom: var(--spacing-xl);
	}

	h1 {
		margin: 0 0 var(--spacing-xs);
		font-size: 1.75rem;
		font-weight: 700;
	}

	h2 {
		margin: var(--spacing-xl) 0 var(--spacing-md);
		font-size: 1.25rem;
	}

	.lede {
		margin: 0;
		max-width: 60ch;
		color: var(--color-text-secondary);
		line-height: 1.6;
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

	.notice.bad {
		border-color: color-mix(in srgb, var(--color-error) 55%, transparent);
	}

	.jobs {
		width: 100%;
		border-collapse: collapse;
	}

	.jobs th,
	.jobs td {
		padding: var(--spacing-sm) var(--spacing-md);
		border-bottom: 1px solid var(--color-border);
		text-align: left;
		vertical-align: top;
	}

	.jobs thead th {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-text-secondary);
	}

	.jobs tbody th[scope='row'] {
		font-weight: 600;
	}

	.desc {
		display: block;
		margin-top: 0.15rem;
		font-size: 0.8125rem;
		font-weight: 400;
		color: var(--color-text-secondary);
		max-width: 44ch;
	}

	.num {
		font-variant-numeric: tabular-nums;
	}

	/* The label is the value; colour only reinforces it. */
	.status {
		display: inline-block;
		padding: 0.15rem 0.5rem;
		border-radius: var(--radius-sm);
		font-size: 0.8125rem;
		font-weight: 600;
		border: 1px solid var(--color-border);
	}

	.status.succeeded {
		background: color-mix(in srgb, var(--color-success) 16%, transparent);
	}

	.status.running {
		background: color-mix(in srgb, var(--color-primary) 16%, transparent);
	}

	.status.stalled {
		background: color-mix(in srgb, var(--color-warning) 22%, transparent);
	}

	.status.failed,
	.status.timed_out {
		background: color-mix(in srgb, var(--color-error) 18%, transparent);
	}

	.error {
		display: block;
		margin-top: 0.25rem;
		font-size: 0.8125rem;
		color: var(--color-error);
		max-width: 40ch;
		overflow-wrap: anywhere;
	}

	.run {
		padding: 0.45rem 0.9rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-text);
		font-weight: 600;
		cursor: pointer;
		white-space: nowrap;
	}

	.run:hover:not(:disabled) {
		border-color: var(--color-primary);
		color: var(--color-primary);
	}

	.run:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.run:disabled {
		opacity: 0.6;
		cursor: progress;
	}

	@media (max-width: 48rem) {
		.jobs-admin {
			overflow-x: auto;
		}
	}
</style>
