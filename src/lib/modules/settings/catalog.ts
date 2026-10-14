import type { ModuleEntry } from '../types';

export const settingsModules: ModuleEntry[] = [
	{
		id: 'appearance-settings',
		name: 'AppearanceSettings',
		group: 'Settings',
		summary:
			'Theme (light, dark, system as radio cards), density, text size, reduce motion, and a live preview. It emits changes and stores nothing.',
		a11y: 'The theme choice is a real radio group in a fieldset, so arrow keys move between cards and the selected card carries a check mark as well as a border. The slider and switch are native controls with labels and hints; the preview is a labelled group and its animation stops with reduce motion or the OS setting.',
		code: `import { AppearanceSettings } from '$lib/modules';

let appearance = { theme: 'system', density: 'comfortable', textSize: 100, reduceMotion: false };

<AppearanceSettings bind:value={appearance} on:change={(e) => save(e.detail)} />`
	},
	{
		id: 'notification-preferences',
		name: 'NotificationPreferences',
		group: 'Settings',
		summary:
			'A matrix of events by channels with select-all for every row, every column and the whole grid, mixed states, and quiet hours per channel.',
		a11y: 'A real table with row and column headers inside a keyboard-scrollable region. Every checkbox has a name that includes its event and channel; select-all boxes use the native indeterminate state for "some". Quiet hours validate with messages tied to the fields, and the on-count is a polite status.',
		code: `import { NotificationPreferences } from '$lib/modules';

<NotificationPreferences
  events={[{ id: 'comment', label: 'New comment' }]}
  channels={[{ id: 'email', label: 'Email', quietHours: true }, { id: 'push', label: 'Push' }]}
  bind:value
  bind:quietHours
  on:change={(e) => save(e.detail)}
/>`
	},
	{
		id: 'api-keys-manager',
		name: 'ApiKeysManager',
		group: 'Settings',
		summary:
			'Create keys with scopes and an expiry, show the secret once with a copy button, list keys masked with last use and expiry, and revoke with a confirmation.',
		a11y: 'The create dialog is a native modal with a validation summary (role alert) and per-field errors. Focus moves to the one-time secret when it appears, back to the create button when it is dismissed, and to the heading after a revoke. Copy results are announced; revoking uses an alert dialog where Cancel has focus first.',
		code: `import { ApiKeysManager } from '$lib/modules';

<ApiKeysManager
  {keys}
  scopes={[{ value: 'users:read', label: 'Read users' }, { value: 'users:write', label: 'Write users' }]}
  {createdSecret}
  on:create={(e) => createKey(e.detail)}
  on:revoke={(e) => revokeKey(e.detail.id)}
  on:secretdismiss={() => (createdSecret = '')}
/>`
	},
	{
		id: 'webhooks-manager',
		name: 'WebhooksManager',
		group: 'Settings',
		summary:
			'Webhook endpoints with an add and edit dialog (URL validation, event multi-select), an enable switch, a health badge and recent deliveries.',
		a11y: 'Switches, edit and delete buttons name their endpoint. The dialog shows a summary of errors as an alert and ties each message to its field. Delivery results are words ("Delivered 200", "Failed 500"), never colour alone, and the log is a disclosure list.',
		code: `import { WebhooksManager } from '$lib/modules';

<WebhooksManager
  {endpoints}
  events={[{ value: 'invoice.paid', label: 'Invoice paid' }]}
  on:save={(e) => save(e.detail)}
  on:toggle={(e) => setEnabled(e.detail)}
  on:remove={(e) => remove(e.detail.id)}
/>`
	},
	{
		id: 'cookie-consent',
		name: 'CookieConsent',
		group: 'Settings',
		summary:
			'A cookie banner with Accept all, Reject all and Preferences at equal weight, and a preferences dialog with per-category switches. Necessary cookies are locked on.',
		a11y: 'The banner is a labelled region, not a modal: it never traps focus or hides the page. Reject is as easy as accept. The locked switch is disabled and says "Always on". After a decision made by keyboard, focus returns to where it was; the decision is announced.',
		code: `import { CookieConsent } from '$lib/modules';

<CookieConsent
  bind:visible
  policyHref="/privacy"
  on:save={(e) => storeChoices(e.detail)}
  on:accept={(e) => storeChoices(e.detail)}
  on:reject={(e) => storeChoices(e.detail)}
/>`
	},
	{
		id: 'privacy-controls',
		name: 'PrivacyControls',
		group: 'Settings',
		summary:
			'Request an export of your data or its deletion, with each request moving through requested, in progress, ready, failed and cancelled.',
		a11y: 'Status is text in a status region, not just a colour. Deletion needs a typed phrase in a dialog and the confirm button stays off until it matches. When the app answers a request the person made, focus moves to that status; updates that arrive on their own never steal focus.',
		code: `import { PrivacyControls } from '$lib/modules';

<PrivacyControls
  {exportRequest}
  {deleteRequest}
  on:exportrequest={startExport}
  on:deleterequest={startDelete}
  on:cancelrequest={(e) => cancel(e.detail.kind)}
/>`
	},
	{
		id: 'language-region-settings',
		name: 'LanguageRegionSettings',
		group: 'Settings',
		summary:
			'Language, a searchable time zone combobox, date style, clock, number format and currency, with a live preview formatted by Intl.',
		a11y: 'Every field is labelled; the time zone is an ARIA combobox with type-ahead on city names and a result count. The preview is a labelled group that updates politely, and dates are formatted for an explicit time zone so the output never depends on the viewer.',
		code: `import { LanguageRegionSettings } from '$lib/modules';

<LanguageRegionSettings bind:value={region} now={new Date().toISOString()} on:change={(e) => save(e.detail)} />`
	},
	{
		id: 'integrations-list',
		name: 'IntegrationsList',
		group: 'Settings',
		summary:
			'Cards for each service with a status badge, a permissions disclosure, and connect, reconnect or disconnect buttons. Disconnecting asks first.',
		a11y: 'Each card is a list item with a heading at the next level. Status is a word in a badge. Buttons carry the service name for screen readers, the permissions disclosure is a native details element, and disconnect uses an alert dialog with Cancel focused first.',
		code: `import { IntegrationsList } from '$lib/modules';

<IntegrationsList
  {integrations}
  busyId={pending}
  on:connect={(e) => connect(e.detail.id)}
  on:disconnect={(e) => disconnect(e.detail.id)}
/>`
	},
	{
		id: 'settings-layout',
		name: 'SettingsLayout',
		group: 'Settings',
		summary:
			'The shell of a settings page: a sticky side nav on wide screens, a select on narrow ones. One section shows at a time through the default slot.',
		a11y: 'The nav is a labelled landmark whose current link has aria-current="page"; arrow keys, Home and End move between links. Choosing a section moves focus to its panel, which is a named region. The hash deep-links to a section, and the mobile select is a native control.',
		code: `import { SettingsLayout } from '$lib/modules';

<SettingsLayout sections={[{ id: 'profile', label: 'Profile' }, { id: 'alerts', label: 'Notifications' }]} bind:active let:active>
  {#if active === 'profile'}<ProfileForm />{:else}<NotificationPreferences ... />{/if}
</SettingsLayout>`
	}
];
