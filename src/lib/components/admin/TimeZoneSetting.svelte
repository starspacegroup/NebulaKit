<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { canonicalTimeZone, supportedTimeZones, TZ_AUTO } from '$lib/utils/timezone';

	/** The stored setting: an IANA name or 'auto'. */
	export let setting: string = TZ_AUTO;
	/** The zone in use right now, with its offset, for the line under the form. */
	export let label = '';
	/** Only the owner may change it; everyone else sees the value. */
	export let canEdit = false;
	/** What the control sets: the site's zone, or the signed-in user's own. */
	export let scope: 'site' | 'personal' = 'site';
	/** Where the zone in use comes from, in words ("your preference"). */
	export let sourceText = '';

	const endpoint = scope === 'personal' ? '/api/profile/timezone' : '/api/admin/settings/timezone';

	const zones = supportedTimeZones();

	let mode: 'auto' | 'fixed' = setting === TZ_AUTO ? 'auto' : 'fixed';
	let zone = setting === TZ_AUTO ? '' : setting;
	let saving = false;
	let message = '';
	let failed = false;

	$: zoneValid = canonicalTimeZone(zone) !== null;

	async function save() {
		message = '';
		failed = false;
		if (mode === 'fixed' && !zoneValid) {
			failed = true;
			message = 'Pick a zone from the list, for example Asia/Kolkata.';
			return;
		}
		saving = true;
		try {
			const res = await fetch(endpoint, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ timeZone: mode === 'auto' ? TZ_AUTO : zone })
			});
			if (!res.ok) {
				const err = (await res.json().catch(() => null)) as { message?: string } | null;
				failed = true;
				message = err?.message ?? 'Could not save the time zone.';
				return;
			}
			message = 'Saved.';
			await invalidateAll();
		} catch {
			failed = true;
			message = 'Could not reach the site. Nothing was saved.';
		} finally {
			saving = false;
		}
	}
</script>

<section
	id={scope === 'personal' ? 'time-zone' : undefined}
	class="tz-setting"
	aria-labelledby="tz-heading-{scope}"
	data-testid={scope === 'personal' ? 'personal-timezone-setting' : 'timezone-setting'}
>
	<h2 id="tz-heading-{scope}">{scope === 'personal' ? 'Time zone' : 'Admin time zone'}</h2>
	{#if scope === 'personal'}
		<p class="hint">
			Dates and times you see in the admin area, and the days and hours on the Dashboard charts, use
			this zone. It overrides the site's zone, for you only.
		</p>
	{:else}
		<p class="hint">
			Every date and time in the admin area, and the days and hours on the Dashboard charts, use
			this zone unless a user sets their own. Visitors and customers are not affected.
		</p>
	{/if}

	<fieldset disabled={!canEdit || saving}>
		<legend class="visually-hidden">Time zone</legend>
		<label class="choice">
			<input type="radio" bind:group={mode} value="auto" />
			{#if scope === 'personal'}
				No personal choice: use the site setting, else my browser's zone
			{:else}
				Automatic (browser). Each admin sees their own browser's zone, read without asking.
			{/if}
		</label>
		<label class="choice">
			<input type="radio" bind:group={mode} value="fixed" />
			{scope === 'personal' ? 'A zone of my own' : 'A fixed zone for everyone'}
		</label>
		{#if mode === 'fixed'}
			<label class="zone-field">
				Zone
				<input
					type="text"
					list="tz-zones-{scope}"
					bind:value={zone}
					placeholder="Search, e.g. Asia/Kolkata"
					autocomplete="off"
					spellcheck="false"
					maxlength="64"
					aria-invalid={zone !== '' && !zoneValid}
					data-testid="timezone-input"
				/>
			</label>
			<datalist id="tz-zones-{scope}">
				{#each zones as name (name)}<option value={name}></option>{/each}
			</datalist>
		{/if}
	</fieldset>

	<p class="now">
		Currently showing <strong data-testid="timezone-current">{label}</strong>{#if sourceText}
			<span data-testid="timezone-source">({sourceText})</span>{/if}.
	</p>

	{#if canEdit}
		<button type="button" class="save" on:click={save} disabled={saving}>Save time zone</button>
	{:else}
		<p class="hint">Only the owner can change this.</p>
	{/if}
	{#if message}
		<p class="msg" class:failed role={failed ? 'alert' : 'status'}>{message}</p>
	{/if}
</section>

<style>
	.tz-setting {
		display: grid;
		gap: var(--spacing-sm);
		padding: var(--spacing-lg);
		margin-bottom: var(--spacing-xl);
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}

	h2 {
		margin: 0;
		font-size: 1.5rem;
		font-weight: 600;
		color: var(--color-text);
	}

	.hint,
	.now {
		margin: 0;
		color: var(--color-text-secondary);
	}

	fieldset {
		display: grid;
		gap: var(--spacing-sm);
		border: 0;
		margin: 0;
		padding: 0;
		min-width: 0;
	}

	.choice {
		display: flex;
		align-items: flex-start;
		gap: var(--spacing-sm);
		color: var(--color-text);
	}

	.zone-field {
		display: grid;
		gap: var(--spacing-xs);
		font-weight: 600;
		color: var(--color-text);
		max-width: 28rem;
	}

	.zone-field input {
		min-height: 2.75rem;
		padding: 0 var(--spacing-sm);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-background);
		color: var(--color-text);
		font: inherit;
	}

	.save {
		justify-self: start;
		min-height: 2.75rem;
		padding: 0 var(--spacing-md);
		border: 1px solid transparent;
		border-radius: var(--radius-md);
		background: var(--color-primary);
		color: var(--color-background);
		font: inherit;
		font-weight: 500;
		cursor: pointer;
	}

	.save:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.msg {
		margin: 0;
		color: var(--color-text-secondary);
	}

	.msg.failed {
		color: var(--color-error, var(--color-text));
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
</style>
