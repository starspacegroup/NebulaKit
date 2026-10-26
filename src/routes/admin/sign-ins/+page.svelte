<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head><title>Sign-ins</title></svelte:head>

<section class="sign-ins">
	<header>
		<h1>Sign-ins</h1>
		<p>Who is signed in, and (if you turn it on) where each sign-in came from.</p>
	</header>

	{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
	{#if form?.saved}<p class="note" role="status">Sign-in tracking is now {form.saved}.</p>{/if}
	{#if form?.revoked}<p class="note" role="status">Session signed out.</p>{/if}
	{#if form && 'cleared' in form}<p class="note" role="status">
			Deleted {form.cleared} recorded sign-ins.
		</p>{/if}

	<form method="POST" action="?/tracking" use:enhance class="card">
		<h2>Sign-in tracking</h2>
		<p>
			Off by default, because this is the one place the site stores an IP address. When you turn it
			on, each sign-in attempt, failures included, is recorded with:
		</p>
		<ul>
			<li>the method (password, sign-up, GitHub or Discord) and whether it worked;</li>
			<li>the IP address, shown masked here unless you reveal personal data;</li>
			<li>a rough device label such as “Chrome on macOS” (the full browser string is not kept);</li>
			<li>the country your host reports, and when a live session was last used.</li>
		</ul>
		<p>
			Passwords and typed email addresses are never stored. Attempts are deleted after {data.retentionDays}
			days. Visitors who are not signing in are never recorded, whatever this is set to.
		</p>
		<label class="switch">
			<input type="checkbox" name="enabled" checked={data.tracking.enabled} />
			Record sign-ins on this site
		</label>
		<button type="submit">Save</button>
		<p class="status">
			Currently <strong>{data.tracking.enabled ? 'on' : 'off'}</strong>{data.tracking.updatedAt
				? `, changed ${data.tracking.updatedAt.slice(0, 10)}`
				: ''}.
		</p>
	</form>

	<section class="card" aria-labelledby="live-h">
		<h2 id="live-h">Signed in now ({data.sessions.length})</h2>
		{#if data.sessions.length === 0}
			<p>Nobody has a live session.</p>
		{:else}
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<div class="scroll" role="region" aria-label="Live sessions" tabindex="0">
				<table>
					<thead>
						<tr>
							<th scope="col">Account</th>
							<th scope="col">Started</th>
							<th scope="col">Last seen</th>
							<th scope="col">Expires</th>
							<th scope="col"><span class="sr-only">Action</span></th>
						</tr>
					</thead>
					<tbody>
						{#each data.sessions as s (s.id)}
							<tr>
								<td>{s.email ?? 'Unknown account'}{s.own ? ' (you)' : ''}</td>
								<td>{s.createdAt ?? '—'}</td>
								<td>{s.lastSeenAt ?? (data.tracking.enabled ? '—' : 'not recorded')}</td>
								<td>{s.expiresAt.slice(0, 16).replace('T', ' ')}</td>
								<td>
									<form method="POST" action="?/revoke" use:enhance>
										<input type="hidden" name="id" value={s.id} />
										<button type="submit"
											>Sign out<span class="sr-only"> {s.email ?? 'this session'}</span></button
										>
									</form>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</section>

	<section class="card" aria-labelledby="recent-h">
		<h2 id="recent-h">Recent attempts</h2>
		<p>
			Last 24 hours: {data.summary.last24h.success} worked, {data.summary.last24h.failure} failed. Last
			7 days: {data.summary.last7d.success} worked, {data.summary.last7d.failure} failed.
		</p>
		{#if data.events.length === 0}
			<p>
				{data.tracking.enabled
					? 'Nothing recorded yet.'
					: 'Nothing is recorded while tracking is off.'}
			</p>
		{:else}
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<div class="scroll" role="region" aria-label="Recent sign-in attempts" tabindex="0">
				<table>
					<thead>
						<tr>
							<th scope="col">When (UTC)</th>
							<th scope="col">Result</th>
							<th scope="col">Method</th>
							<th scope="col">Account</th>
							<th scope="col">IP</th>
							<th scope="col">Device</th>
							<th scope="col">Country</th>
						</tr>
					</thead>
					<tbody>
						{#each data.events as e (e.id)}
							<tr>
								<td>{e.at.slice(0, 16).replace('T', ' ')}</td>
								<td>{e.success ? 'Worked' : `Failed${e.reason ? `: ${e.reason}` : ''}`}</td>
								<td>{e.method}</td>
								<td>{e.email ?? '—'}</td>
								<td>{e.ip ?? '—'}</td>
								<td>{e.device ?? '—'}</td>
								<td>{e.country ?? '—'}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
		<form method="POST" action="?/clear" use:enhance>
			<button type="submit" class="danger">Delete all recorded sign-ins</button>
		</form>
	</section>
</section>

<style>
	.sign-ins {
		display: grid;
		gap: var(--spacing-lg);
	}

	h1,
	h2,
	p,
	ul {
		margin: 0;
	}

	.card {
		display: grid;
		gap: var(--spacing-sm);
		padding: var(--spacing-lg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
	}

	ul {
		padding-inline-start: var(--spacing-lg);
	}

	.switch {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-sm);
		min-height: 2.75rem;
		font-weight: 600;
	}

	.switch input {
		width: 1.5rem;
		height: 1.5rem;
		accent-color: var(--color-primary-solid);
	}

	button {
		justify-self: start;
		min-height: 2.75rem;
		padding: 0 var(--spacing-lg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-text);
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}

	button:focus-visible,
	.scroll:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.danger {
		color: var(--color-danger);
	}

	.status,
	header p {
		color: var(--color-text-secondary);
	}

	.error {
		color: var(--color-danger);
	}

	.scroll {
		overflow-x: auto;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}

	table {
		width: 100%;
		min-width: 38rem;
		border-collapse: collapse;
	}

	th,
	td {
		padding: var(--spacing-sm) var(--spacing-md);
		border-bottom: 1px solid var(--color-border);
		text-align: start;
	}

	th {
		white-space: nowrap;
	}
</style>
