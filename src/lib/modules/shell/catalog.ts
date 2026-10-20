import type { ModuleEntry } from '../types';

export const shellModules: ModuleEntry[] = [
	{
		id: 'app-shell',
		name: 'AppShell',
		group: 'App shell',
		summary:
			'The frame of an app: skip link, header, collapsible sidebar, main landmark and footer. Below its breakpoint the sidebar becomes an off-canvas panel.',
		a11y: 'A skip link is the first tab stop and moves focus to <main>. The sidebar is a navigation landmark; off-canvas it is a modal <dialog>, so focus is trapped, Escape closes it and focus returns to the menu button. The toggle button states aria-expanded.',
		code: `import { AppShell } from '$lib/modules';

<AppShell bind:collapsed navLabel="Main navigation">
  <span slot="brand">Acme</span>
  <UserMenu slot="header" {user} />
  <ul slot="nav">…</ul>
  <h1>Dashboard</h1>
  <p slot="footer">© Acme</p>
</AppShell>`
	},
	{
		id: 'page-header',
		name: 'PageHeader',
		group: 'App shell',
		summary:
			'A page title with breadcrumbs, a description and action buttons. When the header is narrow the actions fold into one menu.',
		a11y: 'The title is a real heading at the level you set. Breadcrumbs are a labelled navigation list with aria-current on the last item. Folded actions are an ARIA menu button with the same keyboard support as any menu.',
		code: `import { PageHeader } from '$lib/modules';

<PageHeader
  title="Projects"
  description="Everything your team is building."
  breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Projects' }]}
  actions={[{ id: 'new', label: 'New project', variant: 'primary' }]}
  on:action={(e) => run(e.detail.id)}
/>`
	},
	{
		id: 'notification-center',
		name: 'NotificationCenter',
		group: 'App shell',
		summary:
			'A bell with an unread badge opening a list of notifications grouped by day, with mark read, mark all read and an empty state.',
		a11y: 'The unread count is in the bell’s accessible name (“Notifications, 3 unread”), not only the badge. The list opens in a labelled dialog popover; arrow keys, Home and End move between rows; unread rows say “unread” in words as well as showing a dot. Escape closes and returns focus to the bell.',
		code: `import { NotificationCenter } from '$lib/modules';

<NotificationCenter
  bind:items
  now={new Date()}
  timeZone="America/Phoenix"
  on:select={(e) => open(e.detail.id)}
/>`
	},
	{
		id: 'global-search',
		name: 'GlobalSearch',
		group: 'App shell',
		summary:
			'A Cmd/Ctrl+K command palette: ranked, grouped results with highlighted matches, recent searches, an async loading state and a no-results message.',
		a11y: 'The ARIA combobox pattern on a modal dialog: focus stays in the input and aria-activedescendant names the highlighted option. Result counts, “searching” and “no results” are announced politely. The first Escape clears the text, the second closes and focus returns to where it was. Matches are marked with <mark> and an underline, not colour alone.',
		code: `import { GlobalSearch } from '$lib/modules';

<GlobalSearch
  bind:open
  {items}
  {recent}
  loading={busy}
  on:search={(e) => fetchResults(e.detail.query)}
  on:recent={(e) => remember(e.detail.query)}
  on:select={(e) => goto(e.detail.item.href)}
/>`
	},
	{
		id: 'user-menu',
		name: 'UserMenu',
		group: 'App shell',
		summary:
			'The avatar button at the end of a header, opening who you are, a list of account links and a Sign out action.',
		a11y: 'The ARIA menu button pattern. The button is named “Account menu for <name>”. Arrows, Home and End move; Escape closes and returns focus; Tab closes. Sign out is set apart by a separator, a warning symbol and colour.',
		code: `import { UserMenu } from '$lib/modules';

<UserMenu
  user={{ name: 'Ada Lovelace', email: 'ada@example.com' }}
  items={[{ id: 'profile', label: 'Profile', href: '/profile' }]}
  on:signout={signOut}
/>`
	},
	{
		id: 'onboarding-checklist',
		name: 'OnboardingChecklist',
		group: 'App shell',
		summary:
			'A “get started” checklist with a progress bar, expandable steps, dismiss, and a celebration when every step is done.',
		a11y: 'Each step is a disclosure button with aria-expanded; done steps say “Done” in words. Progress is a labelled progressbar plus text. The celebration is announced through a polite live region and its animation is skipped for prefers-reduced-motion.',
		code: `import { OnboardingChecklist } from '$lib/modules';

<OnboardingChecklist
  bind:steps
  on:complete={() => confetti()}
  on:dismiss={() => hide()}
/>`
	},
	{
		id: 'step-wizard',
		name: 'Wizard',
		group: 'App shell',
		summary:
			'A multi-step form shell with a Stepper, per-step validation that gates Next, Back and Finish, and a summary of the answers on the last step.',
		a11y: 'Focus moves to the new step’s heading on every change and a polite live region announces “Step 2 of 4”. A refused Next shows a role="alert" error summary whose links focus the fields, and marks the step in the Stepper in words. Enter submits the step.',
		code: `import { Wizard, runWizardRules, wizardRequiredRule } from '$lib/modules';

<Wizard {steps} bind:values {validate} {summary} on:finish={save} let:step let:errors let:fieldId>
  {#if step.id === 'account'}
    <TextInput id={fieldId('name')} label="Name" bind:value={values.name} error={errors.name} />
  {/if}
</Wizard>`
	},
	{
		id: 'error-state',
		name: 'ErrorState',
		group: 'App shell',
		summary:
			'Full-section error pages for 404, 403, 500, offline and maintenance, with retry and home actions and a copyable request id.',
		a11y: 'A section labelled by its heading (level configurable). Emoji icons are hidden from assistive tech; the message carries the meaning. Copy confirms through a polite live region. Set announce for an error that appears in place, which makes it role="alert".',
		code: `import { ErrorState } from '$lib/modules';

<ErrorState kind="500" requestId={id} on:retry={reload} />`
	},
	{
		id: 'empty-state-card',
		name: 'EmptyStateCard',
		group: 'App shell',
		summary:
			'Empty states for “no data”, “no results” and “first run”, each with its own wording and a call to action.',
		a11y: 'A section labelled by a real heading. The “no results” preset quotes the search back in words. Actions are links or buttons with 44px targets.',
		code: `import { EmptyStateCard } from '$lib/modules';

<EmptyStateCard kind="no-results" query={q} action={{ id: 'clear', label: 'Clear filters' }} />`
	},
	{
		id: 'confirm-dialog',
		name: 'ConfirmDialog',
		group: 'App shell',
		summary:
			'A promise-style confirmation for destructive actions: await dialog.ask() and get true or false.',
		a11y: 'An alertdialog on the native <dialog>: Cancel takes focus first so a stray Enter never confirms, Escape cancels, the page behind is inert, and focus returns to the control that asked.',
		code: `import { ConfirmDialog } from '$lib/modules';

let dialog;
<ConfirmDialog bind:this={dialog} />
<button on:click={async () => { if (await dialog.ask({ title: 'Delete project?', confirmLabel: 'Delete' })) remove(); }}>Delete</button>`
	},
	{
		id: 'tabs-page-nav',
		name: 'TabsPageNav',
		group: 'App shell',
		summary:
			'Tab-style navigation between pages (routes). The row scrolls inside itself when links do not fit, with an arrow at each edge that has more.',
		a11y: 'A labelled <nav> of real links; the current page has aria-current="page" and a bar under it. Badges join the link’s accessible name. The scroll region keeps natural Tab order, so every link stays reachable by keyboard.',
		code: `import { TabsPageNav } from '$lib/modules';

<TabsPageNav {items} current={$page.url.pathname} />`
	},
	{
		id: 'action-toolbar',
		name: 'Toolbar',
		group: 'App shell',
		summary:
			'A formatting-style toolbar with groups, toggle buttons and a “More” menu that takes the items that do not fit.',
		a11y: 'The ARIA toolbar pattern with a roving tabindex: one tab stop, arrows, Home and End move. Toggles use aria-pressed. The overflow button is the last stop and opens a menu with arrow-key navigation and Escape to return.',
		code: `import { Toolbar } from '$lib/modules';

<Toolbar label="Text formatting" bind:groups on:action={(e) => apply(e.detail)} />`
	},
	{
		id: 'bottom-nav',
		name: 'BottomNav',
		group: 'App shell',
		summary:
			'The mobile bottom tab bar: icons, labels and badges, safe-area aware, hidden once a sidebar fits.',
		a11y: 'A labelled <nav> of links with aria-current="page"; the current one is bold with a bar, not colour alone. Badges are spoken (“Inbox, 3 new”). Touch targets are at least 44px, and padding honours the device’s safe-area insets.',
		code: `import { BottomNav } from '$lib/modules';

<BottomNav {items} current={$page.url.pathname} fixed />`
	}
];
