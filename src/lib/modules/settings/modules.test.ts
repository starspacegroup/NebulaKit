import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { tick } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import Harness from '../../../../tests/fixtures/ModulesSettingsHarness.svelte';
import { DEFAULT_APPEARANCE, DEFAULT_REGION } from './logic';
import '../test-env';

type Which =
	| 'appearance'
	| 'notifications'
	| 'keys'
	| 'webhooks'
	| 'cookies'
	| 'privacy'
	| 'region'
	| 'integrations'
	| 'layout';

const NOW = '2026-03-15T12:00:00Z';

const settle = async () => {
	await tick();
	await tick();
	await new Promise((resolve) => setTimeout(resolve, 0));
};

function mount(which: Which, extra: Record<string, unknown> = {}) {
	const onEvent = vi.fn();
	const result = render(Harness, { props: { which, onEvent, ...extra } });
	const state = () => JSON.parse(screen.getByTestId('state').textContent ?? '{}');
	return { ...result, onEvent, state };
}

describe('AppearanceSettings', () => {
	it('shows theme as radio cards and emits normalized changes', async () => {
		const { onEvent, state } = mount('appearance', {
			value: { ...DEFAULT_APPEARANCE },
			props: { systemPrefersDark: true }
		});
		const group = screen.getByRole('group', { name: 'Theme' });
		expect(within(group).getAllByRole('radio')).toHaveLength(3);
		expect((screen.getByRole('radio', { name: /System/ }) as HTMLInputElement).checked).toBe(true);

		await fireEvent.click(screen.getByRole('radio', { name: /^Dark/ }));
		expect(onEvent).toHaveBeenLastCalledWith('change', expect.objectContaining({ theme: 'dark' }));
		expect(state().value.theme).toBe('dark');

		await fireEvent.click(screen.getByRole('radio', { name: /Compact/ }));
		expect(state().value.density).toBe('compact');
		await fireEvent.click(screen.getByRole('switch', { name: 'Reduce motion' }));
		expect(state().value.reduceMotion).toBe(true);
	});

	it('changes text size from the slider, clamped, and previews it', async () => {
		const { state } = mount('appearance', { value: { ...DEFAULT_APPEARANCE } });
		const slider = screen.getByRole('slider', { name: /Text size/ });
		await fireEvent.input(slider, { target: { value: '120' } });
		expect(state().value.textSize).toBe(120);
		const preview = screen.getByRole('group', { name: 'Preview' });
		expect(preview.getAttribute('style')).toMatch(/font-size:\s*120%/);
		await fireEvent.change(slider, { target: { value: '149' } });
		expect(state().value.textSize).toBe(150);
	});

	it('resolves the preview theme and stops the sample animation with reduce motion', async () => {
		mount('appearance', {
			value: { ...DEFAULT_APPEARANCE, theme: 'system', reduceMotion: true },
			props: { systemPrefersDark: true }
		});
		const preview = screen.getByRole('group', { name: 'Preview' });
		expect(preview.getAttribute('data-theme')).toBe('dark');
		expect(preview.getAttribute('data-reduce-motion')).toBe('true');
		expect(preview.textContent).toContain('stopped');
	});

	it('reads the system preference from matchMedia when not told', async () => {
		const original = window.matchMedia;
		const listeners: ((e: { matches: boolean }) => void)[] = [];
		window.matchMedia = ((query: string) => ({
			matches: true,
			media: query,
			addEventListener: (_: string, fn: (e: { matches: boolean }) => void) => listeners.push(fn),
			removeEventListener: () => {}
		})) as unknown as typeof window.matchMedia;
		try {
			const { unmount } = mount('appearance', { value: { ...DEFAULT_APPEARANCE } });
			await tick();
			expect(screen.getByRole('group', { name: 'Preview' }).getAttribute('data-theme')).toBe(
				'dark'
			);
			listeners.forEach((fn) => fn({ matches: false }));
			await tick();
			expect(screen.getByRole('group', { name: 'Preview' }).getAttribute('data-theme')).toBe(
				'light'
			);
			unmount();
		} finally {
			window.matchMedia = original;
		}
	});

	it('works without matchMedia', async () => {
		const original = window.matchMedia;
		// @ts-expect-error simulate an old browser
		window.matchMedia = undefined;
		try {
			mount('appearance', { value: { ...DEFAULT_APPEARANCE } });
			await tick();
			expect(screen.getByRole('group', { name: 'Preview' }).getAttribute('data-theme')).toBe(
				'light'
			);
		} finally {
			window.matchMedia = original;
		}
	});

	it('takes copy overrides and a heading level', () => {
		mount('appearance', {
			value: { ...DEFAULT_APPEARANCE },
			props: { level: 3, copy: { title: 'Look' } }
		});
		expect(screen.getByRole('heading', { level: 3, name: 'Look' })).toBeTruthy();
	});
});

const events = [
	{ id: 'comment', label: 'New comment', description: 'Someone replies' },
	{ id: 'invoice', label: 'Invoice paid' }
];
const channels = [
	{ id: 'email', label: 'Email', quietHours: true },
	{ id: 'push', label: 'Push' }
];

describe('NotificationPreferences', () => {
	it('renders a labelled table of checkboxes', () => {
		mount('notifications', { value: {}, props: { events, channels } });
		expect(screen.getByRole('table')).toBeTruthy();
		expect(screen.getByRole('checkbox', { name: 'New comment: Email' })).toBeTruthy();
		expect(screen.getByRole('rowheader', { name: /New comment/ })).toBeTruthy();
		expect(screen.getByText('Someone replies')).toBeTruthy();
		expect(
			screen.getByRole('region', { name: /Choose how you hear/ }).getAttribute('tabindex')
		).toBe('0');
	});

	it('toggles a cell and shows mixed states on the row and column', async () => {
		const { state, onEvent } = mount('notifications', { value: {}, props: { events, channels } });
		await fireEvent.click(screen.getByRole('checkbox', { name: 'New comment: Email' }));
		expect(state().value.comment.email).toBe(true);
		expect(onEvent).toHaveBeenCalledWith(
			'change',
			expect.objectContaining({ value: expect.anything() })
		);
		const rowAll = screen.getByRole('checkbox', {
			name: 'All channels for New comment'
		}) as HTMLInputElement;
		expect(rowAll.indeterminate).toBe(true);
		expect(rowAll.checked).toBe(false);
		const colAll = screen.getByRole('checkbox', {
			name: 'All events on Email'
		}) as HTMLInputElement;
		expect(colAll.indeterminate).toBe(true);
		const everything = screen.getByRole('checkbox', {
			name: 'Select every notification'
		}) as HTMLInputElement;
		expect(everything.indeterminate).toBe(true);
		expect(screen.getByRole('status', { name: '' }).textContent).toContain('1 / 4');
	});

	it('selects whole rows, columns and everything, then clears them', async () => {
		const { state } = mount('notifications', { value: {}, props: { events, channels } });
		await fireEvent.click(screen.getByRole('checkbox', { name: 'All channels for New comment' }));
		expect(state().value.comment).toEqual({ email: true, push: true });
		expect(
			(screen.getByRole('checkbox', { name: 'All channels for New comment' }) as HTMLInputElement)
				.checked
		).toBe(true);
		await fireEvent.click(screen.getByRole('checkbox', { name: 'All events on Push' }));
		expect(state().value.invoice.push).toBe(true);
		await fireEvent.click(screen.getByRole('checkbox', { name: 'Select every notification' }));
		expect(
			Object.values(state().value).every((r) => Object.values(r as object).every(Boolean))
		).toBe(true);
		await fireEvent.click(screen.getByRole('checkbox', { name: 'Select every notification' }));
		expect(
			Object.values(state().value).every((r) => Object.values(r as object).every((v) => !v))
		).toBe(true);
	});

	it('disables everything when disabled', () => {
		mount('notifications', { value: {}, props: { events, channels, disabled: true } });
		expect(
			(screen.getByRole('checkbox', { name: 'New comment: Email' }) as HTMLInputElement).disabled
		).toBe(true);
	});

	it('offers quiet hours only for channels that support them, and validates', async () => {
		const { state } = mount('notifications', { value: {}, props: { events, channels } });
		expect(screen.getAllByRole('group', { name: /Email|Push/ })).toHaveLength(1);
		await fireEvent.click(
			screen.getByRole('switch', { name: /Pause during quiet hours \(Email\)/ })
		);
		expect(state().quiet.email.enabled).toBe(true);
		const from = screen.getByLabelText('From (Email)') as HTMLInputElement;
		const to = screen.getByLabelText('Until (Email)') as HTMLInputElement;
		expect(from.value).toBe('22:00');
		expect(screen.getByText(/Quiet from 22:00 to 07:00 \(9 h\)/)).toBeTruthy();

		await fireEvent.input(to, { target: { value: '22:00' } });
		expect(state().quiet.email.end).toBe('22:00');
		expect(screen.getByText('Start and end must be different times.')).toBeTruthy();
		expect(from.getAttribute('aria-invalid')).toBe('true');
		expect(from.getAttribute('aria-describedby')).toBeTruthy();
		expect(screen.queryByText(/Quiet from/)).toBeNull();

		await fireEvent.input(from, { target: { value: '23:00' } });
		expect(state().quiet.email.start).toBe('23:00');
		expect(screen.queryByText('Start and end must be different times.')).toBeNull();
	});

	it('shows existing quiet hours and heading levels', () => {
		mount('notifications', {
			value: {},
			quiet: { email: { enabled: true, start: '09:00', end: '17:00' } },
			props: { events, channels, level: 3 }
		});
		expect((screen.getByLabelText('From (Email)') as HTMLInputElement).value).toBe('09:00');
		expect(screen.getByRole('heading', { level: 4, name: 'Quiet hours' })).toBeTruthy();
	});

	it('hides quiet hours when no channel supports them', () => {
		mount('notifications', {
			value: {},
			props: { events, channels: [{ id: 'push', label: 'Push' }] }
		});
		expect(screen.queryByText('Quiet hours')).toBeNull();
	});
});

const scopes = [
	{ value: 'users:read', label: 'Read users', hint: 'List and view' },
	{ value: 'users:write', label: 'Write users' },
	{ value: 'billing:read', label: 'Read billing' }
];
const key = {
	id: 'k1',
	name: 'CI deploy',
	prefix: 'nk_live_',
	last4: 'abcd',
	scopes: ['users:read'],
	createdAt: '2026-01-10T00:00:00Z',
	lastUsedAt: '2026-03-14T12:00:00Z',
	expiresAt: '2026-03-20T00:00:00Z'
};

describe('ApiKeysManager', () => {
	it('shows an empty state with a create action', () => {
		mount('keys', { props: { keys: [], scopes, now: NOW } });
		expect(screen.getByText('No API keys yet')).toBeTruthy();
		expect(screen.getAllByRole('button', { name: 'Create key' })).toHaveLength(2);
	});

	it('lists keys masked, with last used and expiry in words', () => {
		mount('keys', {
			props: {
				keys: [
					key,
					{ ...key, id: 'k2', name: 'Old', expiresAt: '2026-01-01T00:00:00Z', lastUsedAt: null },
					{ ...key, id: 'k3', name: 'Later', expiresAt: '2026-12-01T00:00:00Z', scopes: [] },
					{ ...key, id: 'k4', name: 'Forever', expiresAt: null }
				],
				scopes,
				now: NOW
			}
		});
		const list = screen.getByRole('list', { name: 'Your API keys' });
		const items = within(list).getAllByRole('listitem');
		expect(items).toHaveLength(4);
		expect(items[0].textContent).toContain('nk_live_••••••••abcd');
		expect(items[0].textContent).toContain('yesterday');
		expect(items[0].textContent).toContain('Expires soon');
		expect(items[1].textContent).toContain('Never used');
		expect(items[1].textContent).toContain('Expired');
		expect(items[2].textContent).toContain('Expires Dec 1, 2026');
		expect(items[2].textContent).toContain('No access');
		expect(items[3].textContent).toContain('Never expires');
	});

	it('validates the create form with a summary and field errors', async () => {
		const { onEvent } = mount('keys', { props: { keys: [key], scopes, now: NOW } });
		await fireEvent.click(screen.getAllByRole('button', { name: 'Create key' })[0]);
		await settle();
		const dialog = screen.getByRole('dialog', { name: 'Create an API key' });
		await fireEvent.submit(
			within(dialog).getByRole('button', { name: 'Create key' }).closest('form')!
		);
		await tick();
		const alert = within(dialog).getByRole('alert');
		expect(alert.textContent).toContain('Give the key a name.');
		expect(alert.textContent).toContain('Choose at least one scope.');
		expect(within(dialog).getByLabelText(/Name/).getAttribute('aria-invalid')).toBe('true');
		expect(onEvent).not.toHaveBeenCalled();

		await fireEvent.input(within(dialog).getByLabelText(/Name/), {
			target: { value: 'ci deploy' }
		});
		await tick();
		expect(within(dialog).getByRole('alert').textContent).toContain('already exists');
	});

	it('creates a key with implied scopes and an expiry', async () => {
		const { onEvent } = mount('keys', { props: { keys: [], scopes, now: NOW } });
		await fireEvent.click(screen.getAllByRole('button', { name: 'Create key' })[0]);
		await settle();
		const dialog = screen.getByRole('dialog', { name: 'Create an API key' });
		await fireEvent.input(within(dialog).getByLabelText(/Name/), {
			target: { value: ' Reports ' }
		});
		await fireEvent.click(within(dialog).getByRole('checkbox', { name: /Write users/ }));
		expect(
			(within(dialog).getByRole('checkbox', { name: /Read users/ }) as HTMLInputElement).checked
		).toBe(true);
		await fireEvent.change(within(dialog).getByLabelText('Expires'), { target: { value: '30' } });
		await fireEvent.submit(
			within(dialog).getByRole('button', { name: 'Create key' }).closest('form')!
		);
		await tick();
		expect(onEvent).toHaveBeenCalledWith('create', {
			name: 'Reports',
			scopes: ['users:read', 'users:write'],
			expiresAt: '2026-04-14T12:00:00.000Z'
		});
		expect(dialog.hasAttribute('open')).toBe(false);
	});

	it('shows the secret once, focuses it, copies it and dismisses it', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
		const { onEvent } = mount('keys', {
			props: {
				keys: [key],
				scopes,
				now: NOW,
				createdSecret: 'nk_live_SECRET',
				createdName: 'Reports'
			}
		});
		await settle();
		const heading = screen.getByRole('heading', { name: /Copy your new key now: Reports/ });
		expect(document.activeElement).toBe(heading);
		expect(screen.getByText('nk_live_SECRET')).toBeTruthy();
		await fireEvent.click(screen.getByRole('button', { name: 'Copy key' }));
		await settle();
		expect(writeText).toHaveBeenCalledWith('nk_live_SECRET');
		expect(onEvent).toHaveBeenCalledWith('copy', { ok: true });
		expect(screen.getByText('Copied to clipboard.')).toBeTruthy();

		await fireEvent.click(screen.getByRole('button', { name: 'I have saved it' }));
		await settle();
		expect(onEvent).toHaveBeenCalledWith('secretdismiss', null);
		expect(document.activeElement?.textContent).toContain('Create key');
	});

	it('reports a failed copy honestly', async () => {
		Object.defineProperty(navigator, 'clipboard', {
			value: { writeText: vi.fn().mockRejectedValue(new Error('no')) },
			configurable: true
		});
		const { onEvent } = mount('keys', {
			props: { keys: [], scopes, now: NOW, createdSecret: 's' }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Copy key' }));
		await settle();
		expect(onEvent).toHaveBeenCalledWith('copy', { ok: false });
		expect(screen.getByText(/Could not copy/)).toBeTruthy();
	});

	it('revokes only after confirmation, Cancel focused first', async () => {
		const { onEvent } = mount('keys', { props: { keys: [key], scopes, now: NOW } });
		await fireEvent.click(screen.getByRole('button', { name: 'Revoke CI deploy' }));
		await settle();
		const dialog = screen.getByRole('alertdialog');
		expect(dialog.textContent).toContain('CI deploy');
		expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Cancel' }));
		await fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
		await settle();
		expect(onEvent).not.toHaveBeenCalledWith('revoke', expect.anything());

		await fireEvent.click(screen.getByRole('button', { name: 'Revoke CI deploy' }));
		await settle();
		await fireEvent.click(screen.getByRole('button', { name: 'Revoke key' }));
		await settle();
		expect(onEvent).toHaveBeenCalledWith('revoke', { id: 'k1' });
		expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'API keys' }));
	});

	it('announces an error and disables actions while busy', () => {
		mount('keys', {
			props: { keys: [key], scopes, now: NOW, error: 'Could not reach the server.', busy: true }
		});
		expect(screen.getByRole('alert').textContent).toBe('Could not reach the server.');
		expect(
			(screen.getByRole('button', { name: 'Revoke CI deploy' }) as HTMLButtonElement).disabled
		).toBe(true);
	});
});

const hook = {
	id: 'h1',
	url: 'https://example.com/hooks',
	events: ['invoice.paid'],
	enabled: true,
	deliveries: [
		{ id: 'd1', event: 'invoice.paid', status: 200, at: '2026-03-14T10:00:00Z' },
		{ id: 'd2', event: 'invoice.paid', status: 500, at: '2026-03-14T11:00:00Z' },
		{ id: 'd3', event: 'invoice.paid', status: null, at: '2026-03-14T12:00:00Z' }
	]
};
const hookEvents = [
	{ value: 'invoice.paid', label: 'Invoice paid' },
	{ value: 'user.created', label: 'User created' }
];

describe('WebhooksManager', () => {
	it('shows an empty state', () => {
		mount('webhooks', { props: { endpoints: [], events: hookEvents } });
		expect(screen.getByText('No webhook endpoints')).toBeTruthy();
	});

	it('lists endpoints with health, switch and deliveries in words', () => {
		mount('webhooks', {
			props: {
				endpoints: [
					hook,
					{ ...hook, id: 'h2', url: 'https://b.example/x', enabled: false, deliveries: [] }
				],
				events: hookEvents
			}
		});
		const items = within(screen.getByRole('list', { name: 'Webhook endpoints' })).getAllByRole(
			'listitem',
			{}
		);
		const first = items[0];
		expect(first.textContent).toContain('Some failures');
		expect(first.textContent).toContain('Delivered 200');
		expect(first.textContent).toContain('Failed 500');
		expect(first.textContent).toContain('Pending');
		expect(first.textContent).toContain('Invoice paid');
		expect(
			(screen.getByRole('switch', { name: 'Enabled: https://b.example/x' }) as HTMLInputElement)
				.checked
		).toBe(false);
		expect(screen.getByText('No deliveries yet.')).toBeTruthy();
		expect(screen.getByText('No data')).toBeTruthy();
	});

	it('toggles enabled', async () => {
		const { onEvent } = mount('webhooks', { props: { endpoints: [hook], events: hookEvents } });
		await fireEvent.click(
			screen.getByRole('switch', { name: /Enabled: https:\/\/example.com\/hooks/ })
		);
		expect(onEvent).toHaveBeenCalledWith('toggle', { id: 'h1', enabled: false });
	});

	it('validates the URL and events before saving', async () => {
		const { onEvent } = mount('webhooks', { props: { endpoints: [], events: hookEvents } });
		await fireEvent.click(screen.getByRole('button', { name: 'Add endpoint' }));
		await settle();
		const dialog = screen.getByRole('dialog', { name: 'Add a webhook endpoint' });
		const form = within(dialog).getByRole('button', { name: 'Save endpoint' }).closest('form')!;
		await fireEvent.submit(form);
		await tick();
		expect(within(dialog).getByRole('alert').textContent).toContain('Enter the endpoint URL.');
		expect(within(dialog).getByRole('alert').textContent).toContain('Choose at least one event.');
		expect(onEvent).not.toHaveBeenCalled();

		const url = within(dialog).getByLabelText(/Endpoint URL/);
		await fireEvent.input(url, { target: { value: 'http://example.com' } });
		await tick();
		expect(url.getAttribute('aria-invalid')).toBe('true');
		expect(within(dialog).getByRole('alert').textContent).toContain('https://');

		await fireEvent.input(url, { target: { value: 'https://example.com/new' } });
		await fireEvent.click(within(dialog).getByRole('checkbox', { name: 'User created' }));
		await fireEvent.submit(form);
		await tick();
		expect(onEvent).toHaveBeenCalledWith('save', {
			id: null,
			url: 'https://example.com/new',
			events: ['user.created'],
			enabled: true
		});
	});

	it('edits an endpoint, keeping its enabled state, and allows local http when told', async () => {
		const { onEvent } = mount('webhooks', {
			props: { endpoints: [{ ...hook, enabled: false }], events: hookEvents, allowLocalHttp: true }
		});
		await fireEvent.click(screen.getByRole('button', { name: /^Edit/ }));
		await settle();
		const dialog = screen.getByRole('dialog', { name: 'Edit webhook endpoint' });
		const url = within(dialog).getByLabelText(/Endpoint URL/) as HTMLInputElement;
		expect(url.value).toBe('https://example.com/hooks');
		expect(
			(within(dialog).getByRole('checkbox', { name: 'Invoice paid' }) as HTMLInputElement).checked
		).toBe(true);
		await fireEvent.input(url, { target: { value: 'http://localhost:3000/h' } });
		await fireEvent.submit(url.closest('form')!);
		await tick();
		expect(onEvent).toHaveBeenCalledWith(
			'save',
			expect.objectContaining({ id: 'h1', enabled: false, url: 'http://localhost:3000/h' })
		);
	});

	it('deletes after confirmation', async () => {
		const { onEvent } = mount('webhooks', { props: { endpoints: [hook], events: hookEvents } });
		await fireEvent.click(screen.getByRole('button', { name: /^Delete/ }));
		await settle();
		await fireEvent.click(
			within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' })
		);
		await settle();
		expect(onEvent).not.toHaveBeenCalledWith('remove', expect.anything());
		await fireEvent.click(screen.getByRole('button', { name: /^Delete/ }));
		await settle();
		await fireEvent.click(screen.getByRole('button', { name: 'Delete endpoint' }));
		await settle();
		expect(onEvent).toHaveBeenCalledWith('remove', { id: 'h1' });
		expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Webhooks' }));
	});

	it('disables actions while busy and shows unknown event ids as-is', () => {
		mount('webhooks', {
			props: { endpoints: [{ ...hook, events: ['x.y'] }], events: hookEvents, busy: true }
		});
		expect(screen.getByText('x.y')).toBeTruthy();
		expect(
			(screen.getByRole('button', { name: 'Add endpoint' }) as HTMLButtonElement).disabled
		).toBe(true);
	});
});

describe('CookieConsent', () => {
	it('is a labelled region, not a dialog, with accept and reject at equal weight', () => {
		mount('cookies');
		const region = screen.getByRole('region', { name: 'Cookies on this site' });
		expect(region.closest('dialog')).toBeNull();
		const buttons = within(region)
			.getAllByRole('button')
			.map((b) => b.textContent?.trim());
		expect(buttons).toEqual(['Reject all', 'Preferences', 'Accept all']);
		expect(document.activeElement).toBe(document.body);
		expect(screen.queryByRole('link')).toBeNull();
	});

	it('renders a policy link', () => {
		mount('cookies', { props: { policyHref: '/cookies' } });
		expect(screen.getByRole('link', { name: 'Read the cookie policy' }).getAttribute('href')).toBe(
			'/cookies'
		);
	});

	it('accepts all, hides, announces, and returns focus to where it was', async () => {
		const { onEvent, state } = mount('cookies');
		const before = screen.getByRole('button', { name: 'Before' });
		before.focus();
		const accept = screen.getByRole('button', { name: 'Accept all' });
		accept.focus();
		await fireEvent.click(accept);
		await settle();
		expect(onEvent).toHaveBeenCalledWith('accept', {
			necessary: true,
			analytics: true,
			marketing: true
		});
		expect(state().visible).toBe(false);
		expect(screen.queryByRole('region', { name: 'Cookies on this site' })).toBeNull();
		expect(screen.getByText('Cookie choices saved.')).toBeTruthy();
		expect(document.activeElement).toBe(before);
		expect(screen.getByRole('button', { name: 'Cookie settings' })).toBeTruthy();
	});

	it('rejects all, leaving only necessary on', async () => {
		const { onEvent } = mount('cookies');
		await fireEvent.click(screen.getByRole('button', { name: 'Reject all' }));
		await settle();
		expect(onEvent).toHaveBeenCalledWith('reject', {
			necessary: true,
			analytics: false,
			marketing: false
		});
	});

	it('hands focus to focusAfter when given, else the reopen button', async () => {
		const target = document.createElement('main');
		target.id = 'main';
		target.tabIndex = -1;
		document.body.append(target);
		mount('cookies', { props: { focusAfter: '#main' } });
		const accept = screen.getByRole('button', { name: 'Accept all' });
		accept.focus();
		await fireEvent.click(accept);
		await settle();
		expect(document.activeElement).toBe(target);
		target.remove();
	});

	it('falls back to the reopen button when nothing else can take focus', async () => {
		mount('cookies', { props: { showReopen: true } });
		const reject = screen.getByRole('button', { name: 'Reject all' });
		reject.focus();
		await fireEvent.click(reject);
		await settle();
		expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cookie settings' }));
	});

	it('does not move focus for a click made elsewhere', async () => {
		mount('cookies');
		const before = screen.getByRole('button', { name: 'Before' });
		before.focus();
		const accept = screen.getByRole('button', { name: 'Accept all' });
		// A programmatic click while focus is outside the banner.
		accept.click();
		await settle();
		expect(document.activeElement).toBe(before);
	});

	it('opens preferences with the necessary category locked on, and saves choices', async () => {
		const { onEvent } = mount('cookies');
		screen.getByRole('button', { name: 'Preferences' }).focus();
		await fireEvent.click(screen.getByRole('button', { name: 'Preferences' }));
		await settle();
		const dialog = screen.getByRole('dialog', { name: 'Cookie preferences' });
		const necessary = within(dialog).getByRole('switch', {
			name: 'Strictly necessary'
		}) as HTMLInputElement;
		expect(necessary.checked).toBe(true);
		expect(necessary.disabled).toBe(true);
		expect(within(dialog).getByText('Always on')).toBeTruthy();
		expect(within(dialog).getByText('Only necessary cookies')).toBeTruthy();

		await fireEvent.click(within(dialog).getByRole('switch', { name: 'Analytics' }));
		expect(within(dialog).getByText('1 of 2 optional categories')).toBeTruthy();
		await fireEvent.click(within(dialog).getByRole('button', { name: 'Save choices' }));
		await settle();
		expect(onEvent).toHaveBeenCalledWith('save', {
			necessary: true,
			analytics: true,
			marketing: false
		});
		// Opened from the banner, so focus lands somewhere real rather than on a removed button.
		expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cookie settings' }));
	});

	it('cancels the dialog without saving, and rejects from it', async () => {
		const { onEvent, state } = mount('cookies');
		await fireEvent.click(screen.getByRole('button', { name: 'Preferences' }));
		await settle();
		await fireEvent.click(
			within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' })
		);
		await settle();
		expect(onEvent).not.toHaveBeenCalled();
		expect(state().visible).toBe(true);

		await fireEvent.click(screen.getByRole('button', { name: 'Preferences' }));
		await settle();
		await fireEvent.click(
			within(screen.getByRole('dialog')).getByRole('button', { name: 'Reject all' })
		);
		await settle();
		expect(onEvent).toHaveBeenCalledWith('reject', expect.objectContaining({ analytics: false }));
	});

	it('can be reopened after a decision, and respects showReopen', async () => {
		mount('cookies', { visible: false });
		await fireEvent.click(screen.getByRole('button', { name: 'Cookie settings' }));
		await settle();
		expect(screen.getByRole('dialog', { name: 'Cookie preferences' })).toBeTruthy();
	});

	it('shows no reopen button when switched off', () => {
		mount('cookies', { visible: false, props: { showReopen: false } });
		expect(screen.queryByRole('button', { name: 'Cookie settings' })).toBeNull();
	});

	it('works with custom categories and fixed placement', () => {
		mount('cookies', {
			props: {
				placement: 'fixed',
				categories: [
					{ id: 'n', label: 'Needed', necessary: true },
					{ id: 'x', label: 'Extra' }
				]
			}
		});
		expect(document.querySelector('.cookie--fixed')).not.toBeNull();
	});
});

describe('PrivacyControls', () => {
	it('shows both requests as not requested with actions', () => {
		mount('privacy', { props: { now: NOW } });
		expect(screen.getAllByText('Not requested')).toHaveLength(2);
		expect(screen.getByRole('button', { name: 'Request export' })).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Delete my data' })).toBeTruthy();
	});

	it('requests an export, then focuses the status when the app answers', async () => {
		const { onEvent, component } = (() => {
			const onEvent = vi.fn();
			const result = render(Harness, { props: { which: 'privacy', onEvent, props: { now: NOW } } });
			return { onEvent, component: result };
		})();
		await fireEvent.click(screen.getByRole('button', { name: 'Request export' }));
		expect(onEvent).toHaveBeenCalledWith('exportrequest', null);
		component.component.update({
			exportRequest: { status: 'pending', requestedAt: '2026-03-15T10:00:00Z' }
		});
		await settle();
		await settle();
		const status = screen.getAllByRole('status')[0];
		expect(status.textContent).toContain('Requested');
		expect(status.textContent).toContain('Mar 15, 2026');
		expect(document.activeElement).toBe(status);
		await fireEvent.click(screen.getByRole('button', { name: 'Cancel request' }));
		expect(onEvent).toHaveBeenCalledWith('cancelrequest', { kind: 'export' });
	});

	it('does not steal focus from updates the person did not ask for', async () => {
		const onEvent = vi.fn();
		const result = render(Harness, { props: { which: 'privacy', onEvent, props: { now: NOW } } });
		const other = document.createElement('button');
		document.body.append(other);
		other.focus();
		result.component.update({ exportRequest: { status: 'processing' } });
		await settle();
		expect(document.activeElement).toBe(other);
		other.remove();
	});

	it('shows a ready export with a download link and expiry, and a failed one retryable', () => {
		const { unmount } = mount('privacy', {
			props: {
				now: NOW,
				exportRequest: {
					status: 'ready',
					downloadUrl: '/export.zip',
					expiresAt: '2026-03-20T00:00:00Z'
				}
			}
		});
		expect(screen.getByRole('link', { name: 'Download export' }).getAttribute('href')).toBe(
			'/export.zip'
		);
		expect(screen.getByText(/Link expires Mar 20, 2026/)).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Request a new export' })).toBeTruthy();
		unmount();
		mount('privacy', { props: { now: NOW, exportRequest: { status: 'failed' } } });
		expect(screen.getByText('Failed')).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Request a new export' })).toBeTruthy();
	});

	it('hides actions while an export is processing', () => {
		mount('privacy', { props: { now: NOW, exportRequest: { status: 'processing' } } });
		expect(screen.queryByRole('button', { name: /export/i })).toBeNull();
		expect(screen.queryByRole('button', { name: 'Cancel request' })).toBeNull();
	});

	it('needs the typed phrase before deleting', async () => {
		const { onEvent } = mount('privacy', { props: { now: NOW } });
		await fireEvent.click(screen.getByRole('button', { name: 'Delete my data' }));
		await settle();
		const dialog = screen.getByRole('dialog', { name: 'Delete all your data?' });
		const confirm = within(dialog).getByRole('button', {
			name: 'Delete everything'
		}) as HTMLButtonElement;
		const input = within(dialog).getByLabelText('Type DELETE to confirm');
		expect(confirm.disabled).toBe(true);
		await fireEvent.input(input, { target: { value: 'delet' } });
		expect(confirm.disabled).toBe(true);
		await fireEvent.submit(input.closest('form')!);
		expect(onEvent).not.toHaveBeenCalled();
		await fireEvent.input(input, { target: { value: 'delete' } });
		expect(confirm.disabled).toBe(false);
		await fireEvent.submit(input.closest('form')!);
		await settle();
		expect(onEvent).toHaveBeenCalledWith('deleterequest', null);
		expect(dialog.hasAttribute('open')).toBe(false);
	});

	it('shows the erasure countdown and lets a pending deletion be cancelled', async () => {
		const { onEvent, unmount } = mount('privacy', {
			props: {
				now: NOW,
				deleteRequest: {
					status: 'pending',
					requestedAt: '2026-03-15T00:00:00Z',
					expiresAt: '2026-03-18T12:00:00Z'
				}
			}
		});
		expect(document.body.textContent).toMatch(
			/Scheduled for erasure Mar 18, 2026\s+\(3\s+days left/
		);
		await fireEvent.click(screen.getByRole('button', { name: 'Cancel request' }));
		expect(onEvent).toHaveBeenCalledWith('cancelrequest', { kind: 'delete' });
		unmount();
		mount('privacy', {
			props: { now: NOW, deleteRequest: { status: 'pending', expiresAt: '2026-03-16T12:00:00Z' } }
		});
		expect(document.body.textContent).toMatch(/\(1\s+day left/);
	});

	it('takes a custom phrase', async () => {
		mount('privacy', { props: { now: NOW, confirmPhrase: 'erase me' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Delete my data' }));
		await settle();
		expect(screen.getByLabelText('Type erase me to confirm')).toBeTruthy();
	});
});

describe('LanguageRegionSettings', () => {
	const region = { ...DEFAULT_REGION, timeZone: 'America/New_York' };

	it('previews with Intl and updates live from the selects', async () => {
		const { state, onEvent } = mount('region', { value: region, props: { now: NOW } });
		const preview = screen.getByRole('group', { name: 'Preview' });
		expect(preview.textContent).toContain('Mar 15, 2026');
		expect(preview.textContent).toContain('1,234,567.891');
		expect(preview.textContent).toContain('$1,234.50');

		await fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'de-DE' } });
		expect(state().value.language).toBe('de-DE');
		expect(preview.textContent).toContain('1.234.567,891');
		expect(onEvent).toHaveBeenCalledWith('change', expect.objectContaining({ language: 'de-DE' }));

		await fireEvent.change(screen.getByLabelText('Date format'), { target: { value: 'full' } });
		expect(preview.textContent).toContain('Sonntag');
		await fireEvent.change(screen.getByLabelText('Number format'), { target: { value: 'en-GB' } });
		expect(state().value.numberLocale).toBe('en-GB');
		await fireEvent.change(screen.getByLabelText('Currency'), { target: { value: 'JPY' } });
		expect(state().value.currency).toBe('JPY');
		await fireEvent.click(screen.getByRole('radio', { name: '24-hour' }));
		expect(state().value.hourCycle).toBe('24');
	});

	it('searches time zones by city and picks one', async () => {
		const { state } = mount('region', { value: region, props: { now: NOW } });
		const combo = screen.getByRole('combobox', { name: 'Time zone' }) as HTMLInputElement;
		expect(combo.value).toBe('(UTC-04:00) New York');
		await fireEvent.input(combo, { target: { value: 'tok' } });
		const options = within(screen.getByRole('listbox')).getAllByRole('option');
		expect(options).toHaveLength(1);
		expect(options[0].textContent).toContain('Tokyo');
		await fireEvent.click(options[0]);
		expect(state().value.timeZone).toBe('Asia/Tokyo');
		expect(screen.getByRole('group', { name: 'Preview' }).textContent).toContain(
			'Mar 16, 2026'.slice(0, 3)
		);
	});

	it('says so when no zone matches, and keeps a custom zone selectable', async () => {
		mount('region', { value: { ...region, timeZone: 'Pacific/Fiji' }, props: { now: NOW } });
		const combo = screen.getByRole('combobox', { name: 'Time zone' }) as HTMLInputElement;
		expect(combo.value).toContain('Fiji');
		await fireEvent.input(combo, { target: { value: 'zzzz' } });
		expect(screen.getAllByText('No matching time zone').length).toBeGreaterThan(0);
	});
});

const integrations = [
	{
		id: 'slack',
		name: 'Slack',
		description: 'Post updates',
		status: 'connected',
		permissions: ['Read channels', 'Post messages'],
		account: 'acme.slack.com'
	},
	{ id: 'gh', name: 'GitHub', description: 'Link repos', status: 'disconnected', permissions: [] },
	{
		id: 'zap',
		name: 'Zapier',
		description: 'Automate',
		status: 'error',
		permissions: ['Read events']
	},
	{ id: 'wait', name: 'Waiting', description: 'Hang on', status: 'pending', permissions: ['x'] }
];

describe('IntegrationsList', () => {
	it('shows cards ordered by attention with a status badge in words', () => {
		mount('integrations', { props: { integrations } });
		const names = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
		expect(names).toEqual(['Zapier', 'Slack', 'Waiting', 'GitHub']);
		expect(screen.getByText('Connected')).toBeTruthy();
		expect(screen.getByText('Needs attention')).toBeTruthy();
		expect(screen.getByText('Connecting')).toBeTruthy();
		expect(screen.getByText('Not connected')).toBeTruthy();
		expect(screen.getByText('1 / 4 connected')).toBeTruthy();
		expect(screen.getByText('Account: acme.slack.com')).toBeTruthy();
		expect(screen.getByText('This integration asks for no access.')).toBeTruthy();
	});

	it('discloses permissions in a details element', () => {
		mount('integrations', { props: { integrations } });
		const summary = screen.getByText('Permissions (2)');
		expect(summary.tagName).toBe('SUMMARY');
		expect(summary.closest('details')?.textContent).toContain('Post messages');
	});

	it('connects and reconnects without asking', async () => {
		const { onEvent } = mount('integrations', { props: { integrations } });
		await fireEvent.click(screen.getByRole('button', { name: 'Connect GitHub' }));
		expect(onEvent).toHaveBeenCalledWith('connect', { id: 'gh' });
		await fireEvent.click(screen.getByRole('button', { name: 'Reconnect Zapier' }));
		expect(onEvent).toHaveBeenCalledWith('reconnect', { id: 'zap' });
		expect(screen.queryByRole('button', { name: /Waiting/ })).toBeNull();
	});

	it('asks before disconnecting', async () => {
		const { onEvent } = mount('integrations', { props: { integrations } });
		await fireEvent.click(screen.getByRole('button', { name: 'Disconnect Slack' }));
		await settle();
		const dialog = screen.getByRole('alertdialog');
		expect(dialog.textContent).toContain('Slack');
		await fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
		await settle();
		expect(onEvent).not.toHaveBeenCalledWith('disconnect', expect.anything());
		await fireEvent.click(screen.getByRole('button', { name: 'Disconnect Slack' }));
		await settle();
		await fireEvent.click(
			within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Disconnect' })
		);
		await settle();
		expect(onEvent).toHaveBeenCalledWith('disconnect', { id: 'slack' });
		expect(document.activeElement).toBe(
			screen.getByRole('heading', { level: 2, name: 'Integrations' })
		);
	});

	it('marks the busy card as loading', () => {
		mount('integrations', { props: { integrations, busyId: 'gh' } });
		expect(screen.getByRole('button', { name: 'Connect GitHub' }).getAttribute('aria-busy')).toBe(
			'true'
		);
	});

	it('searches once there are enough integrations', async () => {
		const many = Array.from({ length: 7 }, (_, i) => ({
			id: `i${i}`,
			name: i === 3 ? 'Needle' : `Tool ${i}`,
			description: 'thing',
			status: 'disconnected',
			permissions: []
		}));
		mount('integrations', { props: { integrations: many } });
		const search = screen.getByRole('searchbox', { name: 'Search integrations' });
		await fireEvent.input(search, { target: { value: 'needle' } });
		expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(1);
		expect(screen.getByText('1 shown')).toBeTruthy();
		await fireEvent.input(search, { target: { value: 'nothing here' } });
		expect(screen.getByText('No integrations match your search.')).toBeTruthy();
	});

	it('has no search for a short list or when switched off, and an empty state', () => {
		const { unmount } = mount('integrations', { props: { integrations } });
		expect(screen.queryByRole('searchbox')).toBeNull();
		unmount();
		mount('integrations', { props: { integrations: [] } });
		expect(screen.getByText('No integrations available')).toBeTruthy();
	});
});

const sections = [
	{ id: 'profile', label: 'Profile', description: 'Who you are' },
	{ id: 'alerts', label: 'Notifications' },
	{ id: 'danger', label: 'Danger zone' }
];

describe('SettingsLayout', () => {
	it('marks the current link with aria-current and renders the slot for it', () => {
		mount('layout', { active: 'alerts', props: { sections, syncHash: false } });
		const nav = screen.getByRole('navigation', { name: 'Settings sections' });
		expect(
			within(nav).getByRole('link', { name: 'Notifications' }).getAttribute('aria-current')
		).toBe('page');
		expect(
			within(nav).getByRole('link', { name: 'Profile' }).getAttribute('aria-current')
		).toBeNull();
		expect(screen.getByTestId('panel-body').textContent).toBe('Panel alerts');
		expect(screen.getByRole('region', { name: 'Notifications' })).toBeTruthy();
		expect(screen.getByRole('heading', { level: 2, name: 'Notifications' })).toBeTruthy();
		expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeTruthy();
	});

	it('falls back to the first section and shows its description', () => {
		mount('layout', { active: 'nope', props: { sections, syncHash: false } });
		expect(screen.getByTestId('panel-body').textContent).toBe('Panel profile');
		expect(screen.getByText('Who you are')).toBeTruthy();
	});

	it('switches section on click, moves focus to the panel and tells the app', async () => {
		const { onEvent, state } = mount('layout', { props: { sections, syncHash: false } });
		await fireEvent.click(screen.getByRole('link', { name: 'Danger zone' }));
		await settle();
		expect(state().active).toBe('danger');
		expect(onEvent).toHaveBeenCalledWith('change', { id: 'danger' });
		expect(document.activeElement).toBe(screen.getByRole('region', { name: 'Danger zone' }));
		expect(screen.getByTestId('panel-body').textContent).toBe('Panel danger');
	});

	it('moves with arrow keys, Home and End, wrapping', async () => {
		const { state } = mount('layout', { active: 'profile', props: { sections, syncHash: false } });
		const link = (name: string) => screen.getByRole('link', { name });
		await fireEvent.keyDown(link('Profile'), { key: 'ArrowDown' });
		await settle();
		expect(state().active).toBe('alerts');
		expect(document.activeElement).toBe(link('Notifications'));
		await fireEvent.keyDown(link('Notifications'), { key: 'End' });
		await settle();
		expect(state().active).toBe('danger');
		await fireEvent.keyDown(link('Danger zone'), { key: 'ArrowDown' });
		await settle();
		expect(state().active).toBe('profile');
		await fireEvent.keyDown(link('Profile'), { key: 'ArrowUp' });
		await settle();
		expect(state().active).toBe('danger');
		await fireEvent.keyDown(link('Danger zone'), { key: 'Home' });
		await settle();
		expect(state().active).toBe('profile');
		await fireEvent.keyDown(link('Profile'), { key: 'a' });
		expect(state().active).toBe('profile');
	});

	it('offers a native select on narrow screens', async () => {
		const { state } = mount('layout', {
			active: 'profile',
			props: { sections, syncHash: false, selectLabel: 'Jump to' }
		});
		const select = screen.getByLabelText('Jump to') as HTMLSelectElement;
		expect(select.value).toBe('profile');
		await fireEvent.change(select, { target: { value: 'alerts' } });
		await settle();
		expect(state().active).toBe('alerts');
		expect(document.activeElement).toBe(screen.getByRole('region', { name: 'Notifications' }));
	});

	it('follows the URL hash and writes it back', async () => {
		history.replaceState(null, '', '#danger');
		const { state } = mount('layout', { props: { sections } });
		await settle();
		expect(state().active).toBe('danger');
		await fireEvent.click(screen.getByRole('link', { name: 'Profile' }));
		await settle();
		expect(location.hash).toBe('#profile');
		location.hash = '#alerts';
		window.dispatchEvent(new HashChangeEvent('hashchange'));
		await settle();
		expect(state().active).toBe('alerts');
		location.hash = '#unknown';
		window.dispatchEvent(new HashChangeEvent('hashchange'));
		await settle();
		expect(state().active).toBe('alerts');
		history.replaceState(null, '', location.pathname);
	});

	it('copes with no sections', () => {
		mount('layout', { props: { sections: [], syncHash: false, title: 'Prefs', level: 2 } });
		expect(screen.getByRole('heading', { level: 2, name: 'Prefs' })).toBeTruthy();
		expect(screen.getByRole('region', { name: 'Prefs' })).toBeTruthy();
	});
});

describe('settings catalog', () => {
	it('has one complete entry per component, with unique ids and usage snippets', async () => {
		const { settingsModules } = await import('./catalog');
		expect(settingsModules).toHaveLength(9);
		expect(new Set(settingsModules.map((m) => m.id)).size).toBe(9);
		for (const entry of settingsModules) {
			expect(entry.group).toBe('Settings');
			expect(entry.code).toContain(`import { ${entry.name} }`);
			expect(entry.a11y.length).toBeGreaterThan(40);
			expect(entry.summary.length).toBeGreaterThan(20);
		}
	});
});
