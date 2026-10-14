<!-- /modules demos: Settings. Fake local data only; nothing is saved or sent. -->
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
		WebhooksManager,
		DEFAULT_APPEARANCE,
		DEFAULT_REGION,
		createMatrix,
		formatApiKeySecret,
		type ApiKey,
		type Appearance,
		type Integration,
		type NotificationMatrix,
		type PrivacyRequest,
		type QuietHours,
		type RegionPrefs,
		type Webhook
	} from '$lib/modules/settings';
	import ModuleItem from '../ModuleItem.svelte';

	// A fixed "now" keeps every relative date in the demos stable.
	const NOW = '2026-06-15T12:00:00Z';

	let appearance: Appearance = { ...DEFAULT_APPEARANCE };

	const events = [
		{ id: 'comment', label: 'New comment', description: 'Someone replies to you' },
		{ id: 'invoice', label: 'Invoice paid', description: 'A customer pays' },
		{ id: 'security', label: 'Security alert', description: 'A sign-in from a new device' }
	];
	const channels = [
		{ id: 'email', label: 'Email', quietHours: true },
		{ id: 'push', label: 'Push', quietHours: true },
		{ id: 'sms', label: 'SMS' }
	];
	let matrix: NotificationMatrix = createMatrix(
		events.map((e) => e.id),
		channels.map((c) => c.id),
		{ comment: { email: true }, security: { email: true, push: true, sms: true } }
	);
	let quiet: Record<string, QuietHours> = {
		email: { enabled: true, start: '22:00', end: '07:00' }
	};

	const scopes = [
		{ value: 'projects:read', label: 'Read projects', hint: 'List and view projects' },
		{ value: 'projects:write', label: 'Write projects', hint: 'Create, edit and delete' },
		{ value: 'billing:read', label: 'Read billing' }
	];
	let keys: ApiKey[] = [
		{
			id: 'k1',
			name: 'CI deploy',
			prefix: 'nk_live_',
			last4: 'a91f',
			scopes: ['projects:read', 'projects:write'],
			createdAt: '2026-04-02T09:00:00Z',
			lastUsedAt: '2026-06-14T18:30:00Z',
			expiresAt: '2026-06-20T00:00:00Z'
		},
		{
			id: 'k2',
			name: 'Reporting script',
			prefix: 'nk_live_',
			last4: '03cc',
			scopes: ['billing:read'],
			createdAt: '2026-01-12T09:00:00Z',
			lastUsedAt: null,
			expiresAt: null
		}
	];
	let createdSecret = '';
	let createdName = '';

	function createKey(detail: { name: string; scopes: string[]; expiresAt: string | null }) {
		const bytes = new Uint8Array(16);
		crypto.getRandomValues(bytes);
		const secret = formatApiKeySecret(bytes);
		keys = [
			...keys,
			{
				id: `k${keys.length + 1}-${secret.slice(-4)}`,
				name: detail.name,
				prefix: secret.slice(0, 8),
				last4: secret.slice(-4),
				scopes: detail.scopes,
				createdAt: NOW,
				lastUsedAt: null,
				expiresAt: detail.expiresAt
			}
		];
		createdName = detail.name;
		createdSecret = secret;
	}

	const hookEvents = [
		{ value: 'invoice.paid', label: 'Invoice paid' },
		{ value: 'project.created', label: 'Project created' },
		{ value: 'user.invited', label: 'User invited' }
	];
	let endpoints: Webhook[] = [
		{
			id: 'h1',
			url: 'https://example.com/hooks/billing',
			events: ['invoice.paid'],
			enabled: true,
			deliveries: [
				{ id: 'd1', event: 'invoice.paid', status: 200, at: '2026-06-15T09:00:00Z' },
				{ id: 'd2', event: 'invoice.paid', status: 500, at: '2026-06-14T09:00:00Z' },
				{ id: 'd3', event: 'invoice.paid', status: 200, at: '2026-06-13T09:00:00Z' }
			]
		},
		{
			id: 'h2',
			url: 'https://ops.example.org/nebula',
			events: ['project.created', 'user.invited'],
			enabled: false,
			deliveries: []
		}
	];

	function saveHook(detail: {
		id: string | null;
		url: string;
		events: string[];
		enabled: boolean;
	}) {
		if (detail.id) {
			endpoints = endpoints.map((e) =>
				e.id === detail.id ? { ...e, url: detail.url, events: detail.events } : e
			);
		} else {
			endpoints = [
				...endpoints,
				{
					id: `h${endpoints.length + 1}`,
					url: detail.url,
					events: detail.events,
					enabled: true,
					deliveries: []
				}
			];
		}
	}

	let consentVisible = true;
	let consentNote = 'No choice made yet.';

	let exportRequest: PrivacyRequest = { status: 'idle' };
	let deleteRequest: PrivacyRequest = { status: 'idle' };
	function startExport() {
		exportRequest = { status: 'pending', requestedAt: NOW };
		setTimeout(() => (exportRequest = { status: 'processing', requestedAt: NOW }), 1200);
		setTimeout(
			() =>
				(exportRequest = {
					status: 'ready',
					requestedAt: NOW,
					downloadUrl: 'data:text/plain,Demo%20export',
					expiresAt: '2026-06-22T12:00:00Z'
				}),
			2800
		);
	}
	function startDelete() {
		deleteRequest = { status: 'pending', requestedAt: NOW, expiresAt: '2026-07-15T12:00:00Z' };
	}
	function cancelRequest(kind: 'export' | 'delete') {
		if (kind === 'export') exportRequest = { status: 'cancelled' };
		else deleteRequest = { status: 'cancelled' };
	}

	let region: RegionPrefs = { ...DEFAULT_REGION, timeZone: 'America/New_York' };

	let integrations: Integration[] = [
		{
			id: 'slack',
			name: 'Slack',
			description: 'Post project updates to a channel.',
			status: 'connected',
			account: 'acme.slack.com',
			permissions: ['Read channel names', 'Post messages as NebulaKit']
		},
		{
			id: 'github',
			name: 'GitHub',
			description: 'Link repositories to projects.',
			status: 'disconnected',
			permissions: ['Read repository metadata', 'Receive push events']
		},
		{
			id: 'drive',
			name: 'Google Drive',
			description: 'Attach files from Drive.',
			status: 'error',
			account: 'dana@example.com',
			permissions: ['See file names', 'Download files you pick']
		},
		{
			id: 'stripe',
			name: 'Stripe',
			description: 'Show payments beside customers.',
			status: 'disconnected',
			permissions: []
		}
	];
	let busyId = '';
	function setStatus(id: string, status: Integration['status']) {
		busyId = id;
		setTimeout(() => {
			integrations = integrations.map((i) => (i.id === id ? { ...i, status } : i));
			busyId = '';
		}, 700);
	}

	const sections = [
		{ id: 'profile', label: 'Profile', description: 'How you appear to others.' },
		{ id: 'notifications', label: 'Notifications', description: 'What reaches you, and when.' },
		{ id: 'security', label: 'Security', description: 'Keep your account yours.' },
		{ id: 'billing', label: 'Billing' }
	];
	let active = 'profile';
</script>

<ModuleItem id="appearance-settings">
	<AppearanceSettings bind:value={appearance} level={4} />
</ModuleItem>

<ModuleItem id="notification-preferences">
	<NotificationPreferences
		{events}
		{channels}
		bind:value={matrix}
		bind:quietHours={quiet}
		level={4}
	/>
</ModuleItem>

<ModuleItem id="api-keys-manager">
	<ApiKeysManager
		{keys}
		{scopes}
		{createdSecret}
		{createdName}
		now={NOW}
		level={4}
		on:create={(e) => createKey(e.detail)}
		on:revoke={(e) => (keys = keys.filter((k) => k.id !== e.detail.id))}
		on:secretdismiss={() => (createdSecret = '')}
	/>
</ModuleItem>

<ModuleItem id="webhooks-manager">
	<WebhooksManager
		{endpoints}
		events={hookEvents}
		level={4}
		allowLocalHttp
		on:save={(e) => saveHook(e.detail)}
		on:toggle={(e) =>
			(endpoints = endpoints.map((x) =>
				x.id === e.detail.id ? { ...x, enabled: e.detail.enabled } : x
			))}
		on:remove={(e) => (endpoints = endpoints.filter((x) => x.id !== e.detail.id))}
	/>
</ModuleItem>

<ModuleItem id="cookie-consent">
	<CookieConsent
		bind:visible={consentVisible}
		placement="inline"
		policyHref="/documentation"
		level={4}
		on:accept={() => (consentNote = 'You accepted all cookies.')}
		on:reject={() => (consentNote = 'You rejected optional cookies.')}
		on:save={(e) =>
			(consentNote = `Saved: ${Object.entries(e.detail)
				.filter(([, on]) => on)
				.map(([id]) => id)
				.join(', ')}.`)}
	/>
	<p aria-live="polite">{consentNote}</p>
</ModuleItem>

<ModuleItem id="privacy-controls">
	<PrivacyControls
		{exportRequest}
		{deleteRequest}
		now={NOW}
		level={4}
		on:exportrequest={startExport}
		on:deleterequest={startDelete}
		on:cancelrequest={(e) => cancelRequest(e.detail.kind)}
	/>
</ModuleItem>

<ModuleItem id="language-region-settings">
	<LanguageRegionSettings bind:value={region} now={NOW} level={4} />
</ModuleItem>

<ModuleItem id="integrations-list">
	<IntegrationsList
		{integrations}
		{busyId}
		level={4}
		on:connect={(e) => setStatus(e.detail.id, 'connected')}
		on:reconnect={(e) => setStatus(e.detail.id, 'connected')}
		on:disconnect={(e) => setStatus(e.detail.id, 'disconnected')}
	/>
</ModuleItem>

<ModuleItem id="settings-layout">
	<SettingsLayout
		{sections}
		bind:active
		title="Account settings"
		level={4}
		syncHash={false}
		let:active={current}
	>
		<p>
			This is the <strong>{current}</strong> panel. Put any module here, for example the notification
			matrix or the privacy controls.
		</p>
	</SettingsLayout>
</ModuleItem>
