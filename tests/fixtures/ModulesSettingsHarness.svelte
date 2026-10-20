<!--
	Renders the settings modules with bound state, so tests can read it back
	from `data-testid="state"` and hear events through `onEvent`.
-->
<script lang="ts">
	import {
		ApiKeysManager,
		AppearanceSettings,
		CookieConsent,
		IntegrationsList,
		LanguageRegionSettings,
		NotificationPreferences,
		PrivacyControls,
		SettingsLayout,
		WebhooksManager
	} from '$lib/modules/settings';

	export let which:
		| 'appearance'
		| 'notifications'
		| 'keys'
		| 'webhooks'
		| 'cookies'
		| 'privacy'
		| 'region'
		| 'integrations'
		| 'layout';
	export let props: Record<string, unknown> = {};
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	export let value: any = undefined;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	export let quiet: any = {};
	export let active = '';
	export let visible = true;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	export let onEvent: (name: string, detail: any) => void = () => {};

	// Lets a test feed new props in later, the way an app answers a request.
	let later: Record<string, unknown> = {};
	export function update(patch: Record<string, unknown>) {
		later = { ...later, ...patch };
	}

	function ev(name: string) {
		return (e: CustomEvent) => onEvent(name, e.detail);
	}
</script>

{#if which === 'appearance'}
	<AppearanceSettings bind:value {...props} on:change={ev('change')} />
{:else if which === 'notifications'}
	<NotificationPreferences bind:value bind:quietHours={quiet} {...props} on:change={ev('change')} />
{:else if which === 'keys'}
	<ApiKeysManager
		{...props}
		on:create={ev('create')}
		on:revoke={ev('revoke')}
		on:secretdismiss={ev('secretdismiss')}
		on:copy={ev('copy')}
	/>
{:else if which === 'webhooks'}
	<WebhooksManager
		{...props}
		on:save={ev('save')}
		on:toggle={ev('toggle')}
		on:remove={ev('remove')}
	/>
{:else if which === 'cookies'}
	<button type="button">Before</button>
	<CookieConsent
		bind:visible
		placement="inline"
		{...props}
		on:accept={ev('accept')}
		on:reject={ev('reject')}
		on:save={ev('save')}
	/>
{:else if which === 'privacy'}
	<PrivacyControls
		{...props}
		{...later}
		on:exportrequest={ev('exportrequest')}
		on:deleterequest={ev('deleterequest')}
		on:cancelrequest={ev('cancelrequest')}
	/>
{:else if which === 'region'}
	<LanguageRegionSettings bind:value {...props} on:change={ev('change')} />
{:else if which === 'integrations'}
	<IntegrationsList
		{...props}
		on:connect={ev('connect')}
		on:reconnect={ev('reconnect')}
		on:disconnect={ev('disconnect')}
	/>
{:else if which === 'layout'}
	<SettingsLayout bind:active {...props} on:change={ev('change')} let:active={current}>
		<p data-testid="panel-body">Panel {current}</p>
	</SettingsLayout>
{/if}
<span data-testid="state">{JSON.stringify({ value, quiet, active, visible })}</span>
