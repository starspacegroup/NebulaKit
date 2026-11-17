<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const snap = $derived(data.snapshot);

	const STAGE: Record<string, string> = {
		investigating: 'Investigating',
		identified: 'Identified',
		monitoring: 'Monitoring',
		resolved: 'Resolved'
	};
	const IMPACT: Record<string, string> = {
		minor: 'Minor',
		major: 'Major',
		critical: 'Critical',
		maintenance: 'Planned maintenance'
	};
	const LABEL: Record<string, string> = {
		operational: 'Operational',
		degraded: 'Slow',
		down: 'Down'
	};

	function when(sql: string | null | undefined): string {
		if (!sql) return '';
		const d = new Date(sql.includes('T') ? sql : sql.replace(' ', 'T') + 'Z');
		return Number.isNaN(d.getTime())
			? ''
			: d.toLocaleString('en-GB', {
					timeZone: 'UTC',
					day: 'numeric',
					month: 'short',
					hour: '2-digit',
					minute: '2-digit',
					hour12: false
				}) + ' UTC';
	}
	const nameOf = (id: string) => data.components.find((c) => c.id === id)?.name ?? id;
	const mine = (incident: number) =>
		form && 'incident' in form && form.incident === incident ? form : null;
</script>

<svelte:head><title>Status page</title></svelte:head>

<section class="admin-status">
	<h1>Status page</h1>
	<p>
		<a href="/status">The public page</a> checks the website and database every minute and opens and closes
		its own incidents. Post here for what the checks cannot see, like a provider outage or planned maintenance.
		Anything you post is public the moment you save it, in plain text.
	</p>

	<div role="status" aria-live="polite">
		{#if form?.message}<p class="ok">{form.message}</p>{/if}
		{#if form && 'problems' in form && form.problems && !('incident' in form)}
			<ul class="error" role="alert">
				{#each form.problems as problem (problem)}<li>{problem}</li>{/each}
			</ul>
		{/if}
	</div>

	{#if snap}
		<h2>Right now</h2>
		<ul class="now" aria-label="Component status">
			{#each snap.components as c (c.id)}
				<li>
					<span class="name">{c.name}</span>
					<span class="state state-{c.status}">{LABEL[c.status]}</span>
					<span class="detail">{c.detail ?? 'Not checked yet.'}</span>
				</li>
			{/each}
		</ul>
		<p class="hint">
			{#if snap.stale}
				The newest check is {snap.lastChecked ? `from ${when(snap.lastChecked)}` : 'missing'}. Check
				that the cron Worker is deployed (see docs/STATUS_PAGE.md).
			{:else}
				Last checked {when(snap.lastChecked)}.
			{/if}
		</p>
	{/if}

	<form method="POST" action="?/create" use:enhance class="card" aria-labelledby="post-heading">
		<h2 id="post-heading">Post an incident</h2>
		<label>
			Title
			<input name="title" required maxlength="120" />
		</label>
		<div class="row">
			<label>
				Impact
				<select name="impact">
					{#each data.impacts as impact (impact)}
						<option value={impact}>{IMPACT[impact]}</option>
					{/each}
				</select>
			</label>
			<label>
				Stage
				<select name="status">
					{#each data.statuses as status (status)}
						<option value={status}>{STAGE[status]}</option>
					{/each}
				</select>
			</label>
		</div>
		<fieldset>
			<legend>Affects</legend>
			{#each data.components as c (c.id)}
				<label class="check"
					><input type="checkbox" name="components" value={c.id} /> {c.name}</label
				>
			{/each}
		</fieldset>
		<label>
			What is happening
			<textarea name="message" rows="3" maxlength="2000"></textarea>
		</label>
		<button type="submit">Post to the status page</button>
	</form>

	<h2>Open incidents</h2>
	{#if !snap || snap.openIncidents.length === 0}
		<p class="hint">None open.</p>
	{:else}
		<ul class="list" aria-label="Open incidents">
			{#each snap.openIncidents as incident (incident.id)}
				<li>
					<div class="head">
						<h3>{incident.title}</h3>
						<span class="pill">{IMPACT[incident.impact]}</span>
						<span class="pill">{STAGE[incident.status]}</span>
						{#if incident.auto}<span class="pill">Opened by the checks</span>{/if}
					</div>
					<p class="hint">
						Started {when(incident.startedAt)}
						{#if incident.components.length}· Affects {incident.components
								.map(nameOf)
								.join(', ')}{/if}
					</p>
					<ol class="updates">
						{#each incident.updates as update (update.id)}
							<li>
								<strong>{STAGE[update.status]}</strong> · {when(update.createdAt)}
								<p>{update.body}</p>
							</li>
						{/each}
					</ol>
					<form method="POST" action="?/update" use:enhance class="update">
						<input type="hidden" name="incident_id" value={incident.id} />
						{#if mine(incident.id)?.problems}
							<ul class="error" role="alert">
								{#each mine(incident.id)?.problems ?? [] as problem (problem)}<li>
										{problem}
									</li>{/each}
							</ul>
						{/if}
						<label>
							Stage
							<select name="status">
								{#each data.statuses as status (status)}
									<option value={status} selected={status === incident.status}>
										{STAGE[status]}
									</option>
								{/each}
							</select>
						</label>
						<label>
							Add an update
							<textarea name="message" rows="2" maxlength="2000" required></textarea>
						</label>
						<button type="submit">Post update</button>
					</form>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.admin-status {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		color: var(--color-text);
	}
	p,
	.hint,
	.detail {
		color: var(--color-text-secondary);
	}
	h2,
	h3 {
		margin: 0;
	}
	h2 {
		font-size: 1.1rem;
	}
	h3 {
		font-size: 1rem;
		overflow-wrap: anywhere;
	}
	.card,
	.list > li {
		padding: 1rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
	}
	.card,
	.update {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.row {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
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
	fieldset {
		margin: 0;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
	}
	input:not([type='checkbox']),
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
	button {
		min-height: 2.75rem;
		padding: 0 1rem;
		border: 0;
		border-radius: var(--radius-md);
		background: var(--color-primary-solid);
		color: var(--color-on-solid);
		font: inherit;
		cursor: pointer;
	}
	.now,
	.list,
	.updates {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.now li {
		display: grid;
		grid-template-columns: minmax(8rem, 12rem) auto 1fr;
		gap: 0.5rem 1rem;
		align-items: baseline;
	}
	@media (max-width: 40rem) {
		.now li {
			grid-template-columns: 1fr;
		}
	}
	.name {
		font-weight: 600;
	}
	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.5rem;
	}
	.pill {
		padding: 0.1rem 0.5rem;
		border: 1px solid var(--color-border);
		border-radius: 999px;
		color: var(--color-text-secondary);
		font-size: 0.75rem;
	}
	.updates p {
		margin: 0.125rem 0 0;
		overflow-wrap: anywhere;
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
