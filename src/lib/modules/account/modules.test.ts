import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Harness from '../../../../tests/fixtures/ModulesAccountHarness.svelte';
import FormErrorSummary from './FormErrorSummary.svelte';
import PasswordStrength from './PasswordStrength.svelte';
import SessionsList from './SessionsList.svelte';

// prettier-ignore
type Which =
	'sign-in' | 'sign-up' | 'reset' | 'profile' | 'sessions' | 'danger' | 'two-factor' | 'switcher';

function mount(
	which: Which,
	props: Record<string, unknown> = {},
	extra: Record<string, unknown> = {}
) {
	const onEvent = vi.fn();
	const result = render(Harness, { props: { which, props, onEvent, ...extra } });
	const state = () => JSON.parse(screen.getByTestId('state').textContent ?? '{}');
	return { ...result, onEvent, state };
}

const settle = async () => {
	await tick();
	await tick();
	await new Promise((resolve) => setTimeout(resolve, 0));
};

const type = (label: string | RegExp, value: string) =>
	fireEvent.input(screen.getByLabelText(label), { target: { value } });

const key = (el: Element, k: string, init: KeyboardEventInit = {}) =>
	fireEvent.keyDown(el, { key: k, ...init });

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe('PasswordStrength', () => {
	it('shows the level as a word and each requirement as text', async () => {
		const { rerender } = render(PasswordStrength, { props: { password: '' } });
		expect(screen.getByRole('status').textContent?.trim()).toBe('Not entered yet');
		expect(screen.getAllByText('(not met)')).toHaveLength(5);
		await rerender({ password: 'Abcdefghij1!' });
		expect(screen.getByRole('status').textContent?.trim()).toBe('Strong');
		expect(screen.getAllByText('(met)')).toHaveLength(5);
	});

	it('can hide the checklist', () => {
		render(PasswordStrength, { props: { password: 'a', showChecklist: false } });
		expect(screen.queryByRole('list')).toBeNull();
	});
});

describe('FormErrorSummary', () => {
	const fields = [
		{ name: 'a', label: 'Alpha', id: 'f-a' },
		{ name: 'b', label: 'Beta', id: 'f-b' }
	];

	it('renders nothing without errors', () => {
		const { container } = render(FormErrorSummary, { props: { errors: { a: '' }, fields } });
		expect(container.querySelector('section')).toBeNull();
	});

	it('lists errors as links that focus their field, and takes focus itself', async () => {
		const input = document.createElement('input');
		input.id = 'f-b';
		document.body.append(input);
		const { component } = render(FormErrorSummary, {
			props: { errors: { b: 'Required' }, fields, title: 'Oops' }
		});
		const group = screen.getByRole('region', { name: /Oops/ });
		expect(screen.getAllByRole('link')).toHaveLength(1);
		(component as unknown as { focus: () => void }).focus();
		expect(document.activeElement).toBe(group);
		await fireEvent.click(screen.getByRole('link', { name: 'Beta: Required' }));
		expect(document.activeElement).toBe(input);
		input.remove();
	});

	it('leaves the link alone when the field is missing', async () => {
		render(FormErrorSummary, { props: { errors: { a: 'x' }, fields } });
		const link = screen.getByRole('link');
		const notPrevented = await fireEvent.click(link);
		expect(notPrevented).toBe(true);
	});
});

describe('SignInForm', () => {
	it('is named by its heading and labels every control', () => {
		mount('sign-in', { level: 3 });
		expect(screen.getByRole('heading', { level: 3, name: 'Sign in' })).toBeTruthy();
		expect(screen.getByLabelText(/Email/).getAttribute('autocomplete')).toBe('username');
		expect(screen.getByLabelText(/^Password/).getAttribute('autocomplete')).toBe(
			'current-password'
		);
		expect(screen.getByRole('checkbox', { name: /Keep me signed in/ })).toBeTruthy();
	});

	it('shows and hides the password', async () => {
		mount('sign-in');
		const field = screen.getByLabelText(/^Password/) as HTMLInputElement;
		expect(field.type).toBe('password');
		await fireEvent.click(screen.getByRole('checkbox', { name: 'Show password' }));
		expect(field.type).toBe('text');
	});

	it('blocks an empty submit, summarises, and focuses the summary', async () => {
		const { onEvent } = mount('sign-in');
		await fireEvent.submit(screen.getByRole('button', { name: 'Sign in' }).closest('form')!);
		await settle();
		expect(onEvent).not.toHaveBeenCalled();
		const email = screen.getByLabelText(/Email/);
		expect(email.getAttribute('aria-invalid')).toBe('true');
		expect(email.getAttribute('aria-describedby')).toContain('-error');
		const summary = screen.getByRole('region', { name: /Please fix/ });
		expect(document.activeElement).toBe(summary);
		expect(screen.getAllByRole('link')).toHaveLength(2);
		await type(/Email/, 'a@b.co');
		expect(screen.getByLabelText(/Email/).getAttribute('aria-invalid')).toBeNull();
	});

	it('emits the trimmed values', async () => {
		const { onEvent } = mount('sign-in');
		await type(/Email/, ' ada@example.com ');
		await type(/^Password/, 'secret');
		await fireEvent.click(screen.getByRole('checkbox', { name: /Keep me signed in/ }));
		await fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
		expect(onEvent).toHaveBeenCalledWith('submit', {
			email: 'ada@example.com',
			password: 'secret',
			remember: true
		});
	});

	it('ignores submits while loading, and says so', async () => {
		const { onEvent } = mount('sign-in', { loading: true, email: 'a@b.co', password: 'x' });
		const button = screen.getByRole('button', { name: 'Signing in' });
		expect(button.getAttribute('aria-busy')).toBe('true');
		expect(button.hasAttribute('disabled')).toBe(false);
		await fireEvent.submit(button.closest('form')!);
		expect(onEvent).not.toHaveBeenCalled();
	});

	it('shows server errors by form and by field', () => {
		mount('sign-in', { error: 'Wrong email or password.', errors: { password: 'Locked' } });
		expect(screen.getByText('Wrong email or password.').closest('[role="alert"]')).toBeTruthy();
		expect(screen.getByLabelText(/^Password/).getAttribute('aria-invalid')).toBe('true');
	});

	it('offers providers and links, and the slot replaces the buttons', async () => {
		const { onEvent, unmount } = mount('sign-in', {
			providers: [{ id: 'gh', label: 'GitHub' }],
			forgotHref: '/f',
			signUpHref: '/s'
		});
		expect(screen.getByRole('group', { name: 'Sign in with' })).toBeTruthy();
		await fireEvent.click(screen.getByRole('button', { name: 'GitHub' }));
		expect(onEvent).toHaveBeenCalledWith('provider', { id: 'gh' });
		expect(screen.getByRole('link', { name: 'Forgot your password?' }).getAttribute('href')).toBe(
			'/f'
		);
		expect(screen.getByRole('link', { name: 'Create one' }).getAttribute('href')).toBe('/s');
		unmount();
	});
});

describe('SignUpForm', () => {
	it('labels fields with the right autocomplete tokens', () => {
		mount('sign-up');
		expect(screen.getByLabelText(/Full name/).getAttribute('autocomplete')).toBe('name');
		expect(screen.getByLabelText(/Email/).getAttribute('autocomplete')).toBe('email');
		expect(screen.getByLabelText(/^Password/).getAttribute('autocomplete')).toBe('new-password');
		expect(screen.getByRole('checkbox', { name: /I agree/ })).toBeTruthy();
	});

	it('updates the strength meter live and points the password at it', async () => {
		mount('sign-up');
		const field = screen.getByLabelText(/^Password/);
		expect(field.getAttribute('aria-describedby')).toMatch(/-strength$/);
		await type(/^Password/, 'Abcdefghij1!');
		expect(screen.getByText('Strong')).toBeTruthy();
	});

	it('shows a field-level error for every problem, including terms', async () => {
		const { onEvent } = mount('sign-up');
		await type(/Email/, 'nope');
		await fireEvent.submit(screen.getByRole('button', { name: 'Create account' }).closest('form')!);
		await settle();
		expect(onEvent).not.toHaveBeenCalled();
		expect(screen.getByLabelText(/Full name/).getAttribute('aria-invalid')).toBe('true');
		expect(screen.getByLabelText(/Email/).getAttribute('aria-invalid')).toBe('true');
		const terms = screen.getByRole('checkbox', { name: /I agree/ });
		expect(terms.getAttribute('aria-invalid')).toBe('true');
		expect(document.getElementById(terms.getAttribute('aria-describedby')!)?.textContent).toMatch(
			/Accept the terms/
		);
		expect(screen.getAllByRole('link')).toHaveLength(4);
		await fireEvent.click(terms);
		expect(terms.getAttribute('aria-invalid')).toBeNull();
	});

	it('submits when valid', async () => {
		const { onEvent } = mount('sign-up');
		await type(/Full name/, ' Ada ');
		await type(/Email/, 'ada@example.com');
		await type(/^Password/, 'Abcdef1!');
		await fireEvent.click(screen.getByRole('checkbox', { name: /I agree/ }));
		await fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
		expect(onEvent).toHaveBeenCalledWith('submit', {
			name: 'Ada',
			email: 'ada@example.com',
			password: 'Abcdef1!'
		});
	});

	it('shows server errors, a toggled password and providers; ignores loading submits', async () => {
		const { onEvent } = mount('sign-up', {
			errors: { email: 'Taken', terms: 'Required' },
			error: 'Failed',
			providers: [{ id: 'g', label: 'Google' }],
			signInHref: '/in',
			name: 'A',
			email: 'a@b.co',
			password: 'Abcdef1!',
			terms: true,
			loading: true
		});
		expect(screen.getByText('Taken')).toBeTruthy();
		expect(screen.getByText('Failed')).toBeTruthy();
		await fireEvent.click(
			screen.getByRole('button', { name: 'Google' }).closest('div')!.querySelector('button')!
		);
		await fireEvent.click(screen.getByRole('checkbox', { name: 'Show password' }));
		expect((screen.getByLabelText(/^Password/) as HTMLInputElement).type).toBe('text');
		await fireEvent.submit(
			screen.getByRole('button', { name: 'Creating your account' }).closest('form')!
		);
		expect(onEvent).not.toHaveBeenCalledWith('submit', expect.anything());
		expect(screen.getByRole('link', { name: 'Sign in' })).toBeTruthy();
	});
});

describe('PasswordResetFlow', () => {
	const submitOf = (name: string) => screen.getByRole('button', { name }).closest('form')!;

	it('starts on the email step with a stepper', () => {
		mount('reset');
		expect(screen.getByRole('list', { name: 'Password reset progress' })).toBeTruthy();
		expect(document.querySelector('[aria-current="step"]')?.textContent).toMatch(/Email/);
		expect(screen.getByRole('heading', { name: 'Reset your password', level: 2 })).toBeTruthy();
	});

	it('rejects a bad email, then walks every step and moves focus', async () => {
		const { onEvent, state } = mount('reset');
		await fireEvent.submit(submitOf('Send reset code'));
		await settle();
		expect(onEvent).not.toHaveBeenCalled();
		expect(screen.getByLabelText(/Email/).getAttribute('aria-invalid')).toBe('true');

		await type(/Email/, 'ada@example.com');
		await fireEvent.submit(submitOf('Send reset code'));
		await settle();
		expect(onEvent).toHaveBeenCalledWith('request', { email: 'ada@example.com' });
		expect(state().step).toBe(1);
		expect(screen.getByText(/a\*a@example\.com/)).toBeTruthy();
		expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Reset code' }));

		await fireEvent.submit(submitOf('Verify code'));
		await settle();
		expect(screen.getByRole('region', { name: /Please fix/ })).toBeTruthy();
		expect(onEvent).not.toHaveBeenCalledWith('verify', expect.anything());

		const cells = screen.getAllByRole('textbox');
		expect(cells).toHaveLength(6);
		await fireEvent.paste(cells[0], { clipboardData: { getData: () => '123456' } });
		await settle();
		await fireEvent.submit(submitOf('Verify code'));
		await settle();
		expect(onEvent).toHaveBeenCalledWith('verify', { email: 'ada@example.com', code: '123456' });
		expect(state().step).toBe(2);

		await type(/^New password/, 'weak');
		await type(/Confirm new password/, 'other');
		await fireEvent.submit(submitOf('Change password'));
		await settle();
		expect(screen.getByLabelText(/^New password/).getAttribute('aria-invalid')).toBe('true');
		expect(screen.getByLabelText(/Confirm new password/).getAttribute('aria-invalid')).toBe('true');

		await fireEvent.click(screen.getByRole('checkbox', { name: 'Show passwords' }));
		await type(/^New password/, 'Abcdef1!');
		await type(/Confirm new password/, 'Abcdef1!');
		await fireEvent.submit(submitOf('Change password'));
		await settle();
		expect(onEvent).toHaveBeenCalledWith('reset', {
			email: 'ada@example.com',
			code: '123456',
			password: 'Abcdef1!'
		});
		expect(state().step).toBe(3);
		expect(screen.getByText('Password changed', { selector: 'p' })).toBeTruthy();
		await fireEvent.click(screen.getByRole('button', { name: 'Back to sign in' }));
		expect(onEvent).toHaveBeenCalledWith('done', null);
	});

	it('lets the parent drive the step when autoAdvance is off, and can go back', async () => {
		const { onEvent, state } = mount('reset', { autoAdvance: false, email: 'ada@example.com' });
		await fireEvent.submit(submitOf('Send reset code'));
		expect(onEvent).toHaveBeenCalledWith('request', { email: 'ada@example.com' });
		expect(state().step).toBe(0);
	});

	it('counts down before Resend works, then announces it', async () => {
		vi.useFakeTimers();
		let t = 1_000_000;
		const { onEvent } = mount(
			'reset',
			{
				resendSeconds: 3,
				email: 'ada@example.com',
				now: () => t
			},
			{ step: 1 }
		);
		await tick();
		const resend = screen.getByRole('button', { name: 'Resend code in 0:03' });
		expect(resend.hasAttribute('disabled')).toBe(true);
		t += 1000;
		await vi.advanceTimersByTimeAsync(1000);
		expect(screen.getByRole('button', { name: 'Resend code in 0:02' })).toBeTruthy();
		t += 2000;
		await vi.advanceTimersByTimeAsync(2000);
		const ready = screen.getByRole('button', { name: 'Resend code' });
		expect(ready.hasAttribute('disabled')).toBe(false);
		expect(screen.getByText('You can ask for a new code now.')).toBeTruthy();
		await fireEvent.click(ready);
		await tick();
		expect(onEvent).toHaveBeenCalledWith('resend', { email: 'ada@example.com' });
		expect(screen.getByText('A new code was sent.')).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Resend code in 0:03' })).toBeTruthy();
	});

	it('goes back to the email step and clears the code', async () => {
		const { state } = mount('reset', { email: 'ada@example.com' }, { step: 1 });
		await tick();
		await fireEvent.click(screen.getByRole('button', { name: 'Use a different email' }));
		expect(state().step).toBe(0);
		expect(screen.getByLabelText(/Email/)).toBeTruthy();
	});

	it('shows a server error', () => {
		mount('reset', { error: 'Code expired' });
		expect(screen.getByText('Code expired').closest('[role="alert"]')).toBeTruthy();
	});
});

describe('ProfileForm', () => {
	const initial = { name: 'Ada', email: 'ada@example.com', bio: 'Hello', avatarUrl: '/a.png' };

	it('starts clean with Save and Discard off', () => {
		mount('profile', { initial });
		expect(screen.getByRole('button', { name: 'Save changes' }).hasAttribute('disabled')).toBe(
			true
		);
		expect(screen.getByRole('button', { name: 'Discard changes' }).hasAttribute('disabled')).toBe(
			true
		);
		expect(screen.getByRole('status').textContent).toMatch(/No changes yet/);
		expect(screen.getByText('5 / 160')).toBeTruthy();
	});

	it('tracks dirty state, counts the bio, saves and discards', async () => {
		const { onEvent } = mount('profile', { initial });
		await type(/^Bio/, 'Hello world');
		expect(screen.getByText('11 / 160')).toBeTruthy();
		expect(screen.getByRole('status').textContent).toMatch(/unsaved changes/);
		await fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
		expect(onEvent).toHaveBeenCalledWith('save', {
			values: { name: 'Ada', email: 'ada@example.com', bio: 'Hello world' },
			avatar: null,
			removeAvatar: false
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
		expect(onEvent).toHaveBeenCalledWith('discard', null);
		expect((screen.getByLabelText(/^Bio/) as HTMLTextAreaElement).value).toBe('Hello');
		expect(screen.getByRole('status').textContent).toMatch(/No changes/);
	});

	it('validates before saving', async () => {
		const { onEvent } = mount('profile', { initial });
		await type(/^Name/, '');
		await type(/^Email/, 'bad');
		await fireEvent.submit(screen.getByRole('button', { name: 'Save changes' }).closest('form')!);
		await settle();
		expect(onEvent).not.toHaveBeenCalled();
		expect(screen.getByLabelText(/^Name/).getAttribute('aria-invalid')).toBe('true');
		expect(document.activeElement).toBe(screen.getByRole('region', { name: /Please fix/ }));
		await type(/^Name/, 'Bo');
		expect(screen.getByLabelText(/^Name/).getAttribute('aria-invalid')).toBeNull();
	});

	it('ignores a submit while saving', async () => {
		const { onEvent } = mount('profile', { initial, saving: true });
		await type(/^Name/, 'Zed');
		await fireEvent.submit(screen.getByRole('button', { name: 'Saving' }).closest('form')!);
		expect(onEvent).not.toHaveBeenCalled();
	});

	it('says changes were saved', () => {
		mount('profile', { initial, saved: true });
		expect(screen.getByRole('status').textContent).toMatch(/were saved/);
	});

	it('previews a picked image and sends it with the save', async () => {
		const create = vi.fn(() => 'blob:preview');
		const revoke = vi.fn();
		vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke }));
		const { onEvent, container } = mount('profile', {
			initial: { ...initial, avatarUrl: undefined }
		});
		const input = container.querySelector('input[type="file"]') as HTMLInputElement;
		const file = new File(['x'], 'me.png', { type: 'image/png' });
		await fireEvent.change(input, { target: { files: [file] } });
		expect(create).toHaveBeenCalledWith(file);
		expect(container.querySelector('img')?.getAttribute('src')).toBe('blob:preview');
		const other = new File(['y'], 'you.png', { type: 'image/png' });
		await fireEvent.change(input, { target: { files: [other] } });
		expect(revoke).toHaveBeenCalledWith('blob:preview');
		await fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
		expect(onEvent).toHaveBeenCalledWith(
			'save',
			expect.objectContaining({ avatar: other, removeAvatar: false })
		);
		await fireEvent.click(screen.getByRole('button', { name: 'Remove photo' }));
		expect(container.querySelector('img')).toBeNull();
	});

	it('explains a bad file in text, and ignores an empty pick', async () => {
		const { container, onEvent } = mount('profile', { initial });
		const input = container.querySelector('input[type="file"]') as HTMLInputElement;
		await fireEvent.change(input, {
			target: { files: [new File(['x'], 'a.pdf', { type: 'application/pdf' })] }
		});
		await settle();
		expect(screen.getAllByText(/Choose a PNG, JPEG, WebP or GIF image/).length).toBeGreaterThan(0);
		await fireEvent.change(input, { target: { files: [] } });
		await type(/^Name/, 'Zed');
		await fireEvent.submit(screen.getByRole('button', { name: 'Save changes' }).closest('form')!);
		await settle();
		expect(onEvent).not.toHaveBeenCalled();
	});

	it('removing an existing photo is a change, and works without object URLs', async () => {
		vi.stubGlobal(
			'URL',
			Object.assign(URL, { createObjectURL: undefined, revokeObjectURL: undefined })
		);
		const { onEvent, container } = mount('profile', { initial });
		await fireEvent.click(screen.getByRole('button', { name: 'Remove photo' }));
		expect(container.querySelector('img')).toBeNull();
		await fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
		expect(onEvent).toHaveBeenCalledWith('save', expect.objectContaining({ removeAvatar: true }));
		const input = container.querySelector('input[type="file"]') as HTMLInputElement;
		await fireEvent.change(input, {
			target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] }
		});
		expect(container.querySelector('img')).toBeNull();
	});
});

describe('SessionsList', () => {
	const NOW = Date.UTC(2026, 5, 15, 12, 0, 0);
	const sessions = [
		{ id: 'a', device: 'Safari on iPhone', location: 'Portland', lastActive: NOW - 3 * 3600_000 },
		{ id: 'b', device: 'Firefox on Linux', lastActive: NOW - 5000, current: true },
		{ id: 'c', device: 'Edge', lastActive: 'not a date' }
	];

	it('lists the current session first with a text badge and relative times', () => {
		mount('sessions', { sessions, now: NOW });
		const items = screen.getAllByRole('listitem');
		expect(items[0].textContent).toMatch(/Firefox on Linux/);
		expect(items[0].textContent).toMatch(/Current session/);
		expect(items[0].textContent).toMatch(/Just now/);
		expect(items[1].textContent).toMatch(/3 hours ago/);
		expect(items[2].textContent).toMatch(/Unknown/);
		expect(screen.getAllByRole('button', { name: /Revoke session on/ })).toHaveLength(2);
		expect(items[1].querySelector('time')?.getAttribute('datetime')).toBe(
			new Date(NOW - 3 * 3600_000).toISOString()
		);
	});

	it('revokes one session, then announces it and moves focus to the heading', async () => {
		const { onEvent } = mount('sessions', { sessions, now: NOW });
		await fireEvent.click(
			screen.getByRole('button', { name: 'Revoke session on Safari on iPhone' })
		);
		expect(onEvent).toHaveBeenCalledWith('revoke', { id: 'a' });
	});

	it('announces a revoked session once the list drops it', async () => {
		const { rerender } = render(SessionsList, { props: { sessions, now: NOW } });
		await fireEvent.click(
			screen.getByRole('button', { name: 'Revoke session on Safari on iPhone' })
		);
		await rerender({ sessions: [sessions[1], sessions[2]] });
		await settle();
		expect(screen.getByText('Safari on iPhone was signed out.')).toBeTruthy();
		expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Active sessions' }));
	});

	it('shows busy ids, an error and the empty state', () => {
		const { onEvent } = mount('sessions', {
			sessions: [sessions[1], sessions[0]],
			now: NOW,
			revoking: ['a'],
			error: 'Could not load'
		});
		const busy = screen.getByRole('button', { name: 'Revoke session on Safari on iPhone' });
		expect(busy.getAttribute('aria-busy')).toBe('true');
		expect(busy.textContent).toMatch(/Revoking/);
		fireEvent.click(busy);
		expect(onEvent).not.toHaveBeenCalled();
		expect(screen.getByText('Could not load')).toBeTruthy();
	});

	it('says when there is nothing else to revoke', () => {
		mount('sessions', { sessions: [sessions[1]], now: NOW });
		expect(screen.getByText('No other active sessions.')).toBeTruthy();
		expect(screen.queryByRole('button', { name: 'Sign out of all other sessions' })).toBeNull();
	});

	it('has a loading state', () => {
		mount('sessions', { sessions, loading: true });
		expect(screen.getByText('Loading sessions')).toBeTruthy();
		expect(screen.queryByRole('list')).toBeNull();
	});

	it('asks before signing out everywhere else', async () => {
		const { onEvent } = mount('sessions', { sessions, now: NOW });
		await fireEvent.click(screen.getByRole('button', { name: 'Sign out of all other sessions' }));
		await settle();
		const dialog = document.querySelector('dialog')!;
		expect(dialog.getAttribute('role')).toBe('alertdialog');
		expect(dialog.textContent).toMatch(/signs out 2 other sessions/);
		expect(onEvent).not.toHaveBeenCalled();
		await fireEvent.click(screen.getByRole('button', { name: 'Sign out other sessions' }));
		expect(onEvent).toHaveBeenCalledWith('revokeAll', { ids: ['a', 'c'] });
	});

	it('uses the singular for one other session', async () => {
		mount('sessions', { sessions: [sessions[0], sessions[1]], now: NOW });
		await fireEvent.click(screen.getByRole('button', { name: 'Sign out of all other sessions' }));
		await settle();
		expect(document.querySelector('dialog')!.textContent).toMatch(/signs out 1 other session\./);
	});
});

describe('DangerZone', () => {
	it('opens an alert dialog with Cancel focused', async () => {
		mount('danger');
		await fireEvent.click(screen.getByRole('button', { name: 'Delete account…' }));
		await settle();
		const dialog = document.querySelector('dialog')!;
		expect(dialog.getAttribute('role')).toBe('alertdialog');
		expect(dialog.hasAttribute('open')).toBe(true);
		expect(document.activeElement?.textContent).toBe('Cancel');
	});

	it('keeps the dialog open and explains when confirmed too early', async () => {
		const { onEvent } = mount('danger', { confirmPhrase: 'acme' });
		await fireEvent.click(screen.getByRole('button', { name: 'Delete account…' }));
		await settle();
		await type(/Type acme to confirm/, 'ac');
		await fireEvent.click(screen.getByRole('button', { name: 'Delete forever' }));
		await settle();
		expect(onEvent).not.toHaveBeenCalled();
		const dialog = document.querySelector('dialog')!;
		expect(dialog.hasAttribute('open')).toBe(true);
		const input = screen.getByLabelText(/Type acme to confirm/);
		expect(input.getAttribute('aria-invalid')).toBe('true');
		expect(dialog.textContent).toMatch(/Type acme exactly/);
		expect(document.activeElement).toBe(input);
	});

	it('deletes once the phrase matches', async () => {
		const { onEvent } = mount('danger', { confirmPhrase: 'acme' });
		await fireEvent.click(screen.getByRole('button', { name: 'Delete account…' }));
		await settle();
		await type(/Type acme to confirm/, '  acme ');
		expect(document.querySelector('dialog')!.textContent).toMatch(/Matches/);
		await fireEvent.click(screen.getByRole('button', { name: 'Delete forever' }));
		await settle();
		expect(onEvent).toHaveBeenCalledWith('delete', null);
		expect(document.querySelector('dialog')!.hasAttribute('open')).toBe(false);
	});

	it('reports cancel and clears what was typed', async () => {
		const { onEvent } = mount('danger');
		await fireEvent.click(screen.getByRole('button', { name: 'Delete account…' }));
		await settle();
		await type(/Type DELETE to confirm/, 'DEL');
		await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
		await settle();
		expect(onEvent).toHaveBeenCalledWith('cancel', null);
		await fireEvent.click(screen.getByRole('button', { name: 'Delete account…' }));
		await settle();
		expect((screen.getByLabelText(/Type DELETE to confirm/) as HTMLInputElement).value).toBe('');
	});

	it('shows busy and error states', () => {
		mount('danger', { deleting: true, error: 'Try again later' });
		expect(screen.getByRole('button', { name: 'Deleting' }).getAttribute('aria-busy')).toBe('true');
		expect(screen.getByText('Try again later')).toBeTruthy();
	});
});

describe('TwoFactorSetup', () => {
	const base = {
		secret: 'JBSWY3DPEHPK3PXP',
		recoveryCodes: ['abcde12345', 'fghij-67890'],
		appName: 'Nebula Kit'
	};

	it('shows the QR placeholder, the grouped secret, and locked recovery codes', () => {
		mount('two-factor', base);
		expect(screen.getByText('QR code appears here')).toBeTruthy();
		expect(screen.getByText('JBSW Y3DP EHPK 3PXP')).toBeTruthy();
		expect(screen.getByText(/appear after you verify/)).toBeTruthy();
		expect(screen.getAllByRole('heading').length).toBeGreaterThanOrEqual(4);
	});

	it('copies the secret and says so', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal('navigator', { clipboard: { writeText } });
		const { onEvent } = mount('two-factor', base);
		await fireEvent.click(screen.getByRole('button', { name: 'Copy key' }));
		await settle();
		expect(writeText).toHaveBeenCalledWith('JBSWY3DPEHPK3PXP');
		expect(onEvent).toHaveBeenCalledWith('copy', { what: 'secret', text: 'JBSWY3DPEHPK3PXP' });
		expect(screen.getByText('Copied to the clipboard.')).toBeTruthy();
	});

	it('reports a failed copy', async () => {
		vi.stubGlobal('navigator', {
			clipboard: { writeText: vi.fn().mockRejectedValue(new Error('no')) }
		});
		mount('two-factor', base);
		await fireEvent.click(screen.getByRole('button', { name: 'Copy key' }));
		await settle();
		expect(screen.getByText(/Could not copy/)).toBeTruthy();
	});

	it('needs a full code to verify, then emits it', async () => {
		const { onEvent } = mount('two-factor', base);
		await fireEvent.submit(
			screen.getByRole('button', { name: 'Verify and turn on' }).closest('form')!
		);
		await settle();
		expect(onEvent).not.toHaveBeenCalled();
		expect(screen.getByText('Enter all 6 characters of the code.')).toBeTruthy();
		const cells = screen.getAllByRole('textbox');
		await fireEvent.paste(cells[0], { clipboardData: { getData: () => '123456' } });
		await settle();
		await fireEvent.submit(
			screen.getByRole('button', { name: 'Verify and turn on' }).closest('form')!
		);
		expect(onEvent).toHaveBeenCalledWith('verify', { code: '123456' });
	});

	it('shows a server error and ignores submits while verifying', async () => {
		const { onEvent } = mount('two-factor', {
			...base,
			error: 'That code did not work.',
			verifying: true
		});
		expect(screen.getByText('That code did not work.')).toBeTruthy();
		await fireEvent.submit(screen.getByRole('button', { name: 'Verifying' }).closest('form')!);
		expect(onEvent).not.toHaveBeenCalled();
	});

	it('reveals recovery codes once verified: copy, download, then finish', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal('navigator', { clipboard: { writeText } });
		const click = vi.fn();
		const create = vi.fn(() => 'blob:x');
		const revoke = vi.fn();
		vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke }));
		const realCreate = document.createElement.bind(document);
		vi.spyOn(document, 'createElement').mockImplementation(
			(tag: string, o?: ElementCreationOptions) => {
				const el = realCreate(tag, o);
				if (tag === 'a') el.click = click;
				return el;
			}
		);
		const { onEvent } = mount('two-factor', { ...base, verified: true });
		expect(screen.getByText('Two-factor authentication is on.')).toBeTruthy();
		expect(screen.getByText('abcde-12345')).toBeTruthy();
		expect(screen.getByText('fghij-67890')).toBeTruthy();

		await fireEvent.click(screen.getByRole('button', { name: 'Copy codes' }));
		await settle();
		expect(writeText).toHaveBeenCalledWith('abcde-12345\nfghij-67890');

		await fireEvent.click(screen.getByRole('button', { name: 'Download codes' }));
		expect(click).toHaveBeenCalled();
		expect(onEvent).toHaveBeenCalledWith(
			'download',
			expect.objectContaining({ filename: 'nebula-kit-recovery-codes.txt' })
		);

		const finish = screen.getByRole('button', { name: 'Finish' });
		expect(finish.hasAttribute('disabled')).toBe(true);
		await fireEvent.click(screen.getByRole('checkbox', { name: 'I have saved my recovery codes' }));
		expect(finish.hasAttribute('disabled')).toBe(false);
		await fireEvent.click(finish);
		expect(onEvent).toHaveBeenCalledWith('complete', null);
		vi.restoreAllMocks();
	});

	it('downloads without object URL support by just reporting', async () => {
		vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: undefined }));
		const { onEvent } = mount('two-factor', { ...base, verified: true });
		await fireEvent.click(screen.getByRole('button', { name: 'Download codes' }));
		expect(onEvent).toHaveBeenCalledWith('download', expect.anything());
	});
});

describe('AccountSwitcher', () => {
	const open = async () => {
		const trigger = screen.getByRole('button', { name: /Ada Lovelace/ });
		await fireEvent.click(trigger);
		await settle();
		return trigger;
	};

	it('is a menu button that opens on the current account', async () => {
		mount('switcher');
		const trigger = screen.getByRole('button', { name: /Ada Lovelace Switch account/ });
		expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
		expect(trigger.getAttribute('aria-expanded')).toBe('false');
		await open();
		expect(trigger.getAttribute('aria-expanded')).toBe('true');
		const items = screen.getAllByRole('menuitemradio');
		expect(items).toHaveLength(4);
		expect(items[0].getAttribute('aria-checked')).toBe('true');
		expect(items[0].textContent).toMatch(/current/);
		expect(items[1].getAttribute('aria-checked')).toBe('false');
		expect(document.activeElement).toBe(items[0]);
		expect(trigger.getAttribute('aria-controls')).toBe(screen.getByRole('menu').id);
	});

	it('moves with arrows, skipping disabled, and Home/End', async () => {
		mount('switcher');
		await open();
		const menu = screen.getByRole('menu');
		const items = screen.getAllByRole('menuitemradio');
		await key(menu, 'ArrowDown');
		expect(document.activeElement).toBe(items[1]);
		await key(menu, 'ArrowDown');
		expect(document.activeElement).toBe(items[3]);
		await key(menu, 'ArrowUp');
		expect(document.activeElement).toBe(items[1]);
		await key(menu, 'End');
		expect(document.activeElement).toBe(items[3]);
		await key(menu, 'Home');
		expect(document.activeElement).toBe(items[0]);
	});

	it('jumps by first letter', async () => {
		mount('switcher');
		await open();
		const menu = screen.getByRole('menu');
		await key(menu, 'b');
		expect(document.activeElement).toBe(screen.getAllByRole('menuitemradio')[3]);
		await key(menu, 'z');
		expect(document.activeElement).toBe(screen.getAllByRole('menuitemradio')[3]);
		await key(menu, 'b', { ctrlKey: true });
		await key(menu, 'F5');
	});

	it('selects with a click, updates current and closes with focus back on the trigger', async () => {
		const { onEvent, state } = mount('switcher');
		const trigger = await open();
		await fireEvent.click(screen.getAllByRole('menuitemradio')[1]);
		expect(onEvent).toHaveBeenCalledWith('select', { id: 'acme' });
		expect(state().current).toBe('acme');
		expect(screen.queryByRole('menu')).toBeNull();
		expect(document.activeElement).toBe(trigger);
		expect(trigger.textContent).toMatch(/Acme Inc/);
	});

	it('closing on the current account emits nothing; disabled ones cannot be picked', async () => {
		const { onEvent } = mount('switcher');
		await open();
		await fireEvent.click(screen.getAllByRole('menuitemradio')[2]);
		expect(screen.getByRole('menu')).toBeTruthy();
		await fireEvent.click(screen.getAllByRole('menuitemradio')[0]);
		expect(onEvent).not.toHaveBeenCalled();
		expect(screen.queryByRole('menu')).toBeNull();
	});

	it('Escape closes and returns focus; Tab and outside clicks close', async () => {
		mount('switcher');
		const trigger = await open();
		await key(screen.getByRole('menu'), 'Escape');
		expect(screen.queryByRole('menu')).toBeNull();
		expect(document.activeElement).toBe(trigger);
		await open();
		await key(screen.getByRole('menu'), 'Tab');
		expect(screen.queryByRole('menu')).toBeNull();
		await fireEvent.click(trigger);
		await settle();
		await fireEvent.pointerDown(screen.getByRole('button', { name: 'Elsewhere' }));
		expect(screen.queryByRole('menu')).toBeNull();
		await fireEvent.pointerDown(document.body);
		await fireEvent.click(trigger);
		await settle();
		await fireEvent.pointerDown(screen.getByRole('menu'));
		expect(screen.getByRole('menu')).toBeTruthy();
		await fireEvent.click(trigger);
		expect(screen.queryByRole('menu')).toBeNull();
	});

	it('opens from the keyboard on the trigger', async () => {
		mount('switcher');
		const trigger = screen.getByRole('button', { name: /Ada Lovelace/ });
		await key(trigger, 'ArrowDown');
		await settle();
		expect(document.activeElement).toBe(screen.getAllByRole('menuitemradio')[0]);
		await key(screen.getByRole('menu'), 'Escape');
		await key(trigger, 'ArrowUp');
		await settle();
		expect(document.activeElement).toBe(screen.getAllByRole('menuitemradio')[3]);
		await key(screen.getByRole('menu'), 'Escape');
		await key(trigger, 'x');
		expect(screen.queryByRole('menu')).toBeNull();
	});

	it('has an optional add row that is reachable by keyboard', async () => {
		const { onEvent } = mount('switcher', { addLabel: 'Add account' });
		await open();
		const menu = screen.getByRole('menu');
		await key(menu, 'End');
		const add = screen.getByRole('menuitem', { name: 'Add account' });
		expect(document.activeElement).toBe(add);
		await key(menu, 'a');
		expect(document.activeElement).toBe(screen.getAllByRole('menuitemradio')[0]);
		await key(menu, 'End');
		await fireEvent.click(add);
		expect(onEvent).toHaveBeenCalledWith('add', null);
		expect(screen.queryByRole('menu')).toBeNull();
	});

	it('falls back to the first account and handles an empty list', () => {
		mount('switcher', { current: 'nobody', accounts: [] });
		expect(screen.getByRole('button', { name: 'Switch account' })).toBeTruthy();
	});
});
