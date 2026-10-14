import type { ModuleEntry } from '../types';

export const accountModules: ModuleEntry[] = [
	{
		id: 'sign-in-form',
		name: 'SignInForm',
		group: 'Account',
		summary:
			'Email and password sign-in with show/hide password, "keep me signed in", optional provider buttons (OAuth), and loading and error states.',
		a11y: 'A labelled form in a section named by its heading (level is a prop). Fields have real labels, autocomplete tokens (username, current-password) and aria-invalid + aria-describedby errors. A failed submit moves focus to an error summary whose links jump to each field; a server failure is announced as an alert. While loading the button sets aria-busy and ignores clicks without being disabled, so focus is not lost.',
		code: `import { SignInForm } from '$lib/modules';

<SignInForm
  providers={[{ id: 'github', label: 'Continue with GitHub' }]}
  loading={busy}
  error={failure}
  forgotHref="/reset"
  signUpHref="/sign-up"
  on:submit={(e) => signIn(e.detail)}
  on:provider={(e) => startOAuth(e.detail.id)}
/>`
	},
	{
		id: 'sign-up-form',
		name: 'SignUpForm',
		group: 'Account',
		summary:
			'Name, email and password with a live strength meter and requirement checklist, a terms checkbox, and field-level errors.',
		a11y: 'Each field shows its own error, tied with aria-invalid and aria-describedby; the password field also points at the strength meter and checklist. Strength is a word, and every requirement says met or not met in text, so nothing rests on colour. Failed submits focus an error summary; the terms label is a slot so it can hold links.',
		code: `import { SignUpForm } from '$lib/modules';

<SignUpForm
  errors={serverErrors}
  loading={busy}
  signInHref="/sign-in"
  on:submit={(e) => register(e.detail)}
>
  <span slot="terms">I accept the <a href="/terms">terms</a></span>
</SignUpForm>`
	},
	{
		id: 'password-strength',
		name: 'PasswordStrength',
		group: 'Account',
		summary:
			'A strength meter and a checklist of password requirements, for any new-password field.',
		a11y: 'The bar is decorative; the strength word is a status region announced when it changes, and each requirement carries "(met)" or "(not met)" for screen readers. Link a password input to it with aria-describedby. Honours forced-colors.',
		code: `import { PasswordStrength } from '$lib/modules';

<input type="password" bind:value={password} aria-describedby="pw-strength" />
<PasswordStrength id="pw-strength" {password} />`
	},
	{
		id: 'form-error-summary',
		name: 'FormErrorSummary',
		group: 'Account',
		summary: 'A list of everything wrong in a form, each item a link to its field.',
		a11y: 'A labelled section with a heading (level is a prop) that takes focus when you call focus() after a failed submit, so a screen reader reads it. Each link moves focus into its field. It renders nothing when there are no errors.',
		code: `import { FormErrorSummary } from '$lib/modules';

<FormErrorSummary
  bind:this={summary}
  {errors}
  fields={[{ name: 'email', label: 'Email', id: 'email' }]}
/>`
	},
	{
		id: 'password-reset-flow',
		name: 'PasswordResetFlow',
		group: 'Account',
		summary:
			'Three steps: request an email, enter the code (one-time-code input), set a new password, with a stepper and a resend countdown.',
		a11y: "A Stepper marks the current step with aria-current. Each step change moves focus to that step's heading. The code is one labelled group of cells with one-time-code autocomplete. Resend is disabled with the time left in its text, and a polite status says when it is ready again. Errors are summarised and tied to their fields.",
		code: `import { PasswordResetFlow } from '$lib/modules';

<PasswordResetFlow
  bind:step
  autoAdvance={false}
  loading={busy}
  error={failure}
  on:request={(e) => sendCode(e.detail.email)}
  on:verify={(e) => checkCode(e.detail)}
  on:reset={(e) => changePassword(e.detail)}
  on:done={() => goto('/sign-in')}
/>`
	},
	{
		id: 'profile-form',
		name: 'ProfileForm',
		group: 'Account',
		summary:
			'Avatar upload with preview, name, email and a bio with a character counter. Tracks what changed and offers Save and Discard.',
		a11y: 'The photo picker is a real button that opens the file dialog; picking a bad file shows its reason in text. Save and Discard are disabled until something changes, and a polite status says "You have unsaved changes" in words. The bio counter is announced politely. Errors are summarised and tied to their fields.',
		code: `import { ProfileForm } from '$lib/modules';

<ProfileForm
  {initial}
  saving={busy}
  saved={ok}
  on:save={(e) => save(e.detail)}
  on:discard={() => (ok = false)}
/>`
	},
	{
		id: 'sessions-list',
		name: 'SessionsList',
		group: 'Account',
		summary:
			'Signed-in devices with a "Current session" badge, last-active times, revoke one, and revoke all others behind a confirmation.',
		a11y: 'A list of sessions; the current one carries a text badge, not only a colour. Each Revoke button is named for its device ("Revoke session on Firefox on Linux"). Times are real <time> elements. "Sign out of all other sessions" opens an alert dialog with Cancel focused. After a revoke, a status says which device was signed out and focus returns to the heading.',
		code: `import { SessionsList } from '$lib/modules';

<SessionsList
  {sessions}
  now={Date.now()}
  revoking={pendingIds}
  on:revoke={(e) => revoke(e.detail.id)}
  on:revokeAll={(e) => revokeMany(e.detail.ids)}
/>`
	},
	{
		id: 'danger-zone',
		name: 'DangerZone',
		group: 'Account',
		summary: 'Delete the account behind a type-to-confirm step in an alert dialog.',
		a11y: 'The dialog is an alertdialog on the native <dialog>: focus is trapped, Cancel is focused first and Escape cancels. Pressing delete before the phrase matches keeps the dialog open, explains what to type in text and moves focus to the field. The button describes itself with the warning text.',
		code: `import { DangerZone } from '$lib/modules';

<DangerZone
  confirmPhrase={account.name}
  deleting={busy}
  on:delete={() => deleteAccount()}
/>`
	},
	{
		id: 'two-factor-setup',
		name: 'TwoFactorSetup',
		group: 'Account',
		summary:
			'Authenticator setup: QR code slot, copyable secret, verify the code, then recovery codes to copy or download.',
		a11y: 'An ordered list of three parts, each with a heading. The secret is selectable text with a Copy button, for people who cannot scan. The code is a labelled one-time-code group with a text error. Copy and download results are announced in a status region. Finish stays disabled until "I have saved my recovery codes" is ticked.',
		code: `import { TwoFactorSetup } from '$lib/modules';

<TwoFactorSetup
  secret={secret}
  recoveryCodes={codes}
  verified={ok}
  error={failure}
  on:verify={(e) => check(e.detail.code)}
  on:complete={() => close()}
>
  <img slot="qr" src={qrDataUrl} alt="QR code for your authenticator app" />
</TwoFactorSetup>`
	},
	{
		id: 'account-switcher',
		name: 'AccountSwitcher',
		group: 'Account',
		summary:
			'A menu of accounts or organisations with the current one marked, and an optional "add account" row.',
		a11y: 'The ARIA menu-button pattern with radio items. Enter, Space or arrows open it on the current account; arrows, Home and End move and skip disabled accounts; a letter jumps to the next match; Escape closes and returns focus to the button. The current account has aria-checked, a check mark and the word "current" for screen readers.',
		code: `import { AccountSwitcher } from '$lib/modules';

<AccountSwitcher
  {accounts}
  bind:current
  addLabel="Add account"
  on:select={(e) => switchTo(e.detail.id)}
  on:add={() => goto('/accounts/new')}
/>`
	}
];
