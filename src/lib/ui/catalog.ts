/**
 * The /components catalog: every element in `$lib/ui` and every registered
 * widget, with what it is for and how to use it.
 *
 * `catalog.test.ts` fails when a component is exported from `$lib/ui`, or a
 * widget is registered, without an entry here — so the catalog cannot fall
 * behind the kit.
 */

export const CATALOG_GROUPS = [
	'Actions',
	'Forms',
	'Feedback',
	'Overlays',
	'Navigation',
	'Layout',
	'Data display',
	'Widgets'
] as const;

export type CatalogGroup = (typeof CATALOG_GROUPS)[number];

export interface CatalogEntry {
	/** Anchor id on the page, and the key the demo is looked up by. */
	id: string;
	/** The export name for an element; the manifest label for a widget. */
	name: string;
	group: CatalogGroup;
	summary: string;
	code: string;
}

const ui = (names: string) => `import { ${names} } from '$lib/ui';\n\n`;

export const catalog: CatalogEntry[] = [
	{
		id: 'button',
		name: 'Button',
		group: 'Actions',
		summary:
			'Four variants and three sizes. With an href it renders a link; loading keeps focus and blocks clicks.',
		code:
			ui('Button') +
			`<Button on:click={save}>Save</Button>
<Button variant="secondary">Cancel</Button>
<Button variant="ghost" size="sm">Skip</Button>
<Button variant="danger" loading={deleting}>Delete</Button>
<Button href="/documentation">Read the docs</Button>`
	},
	{
		id: 'menu',
		name: 'Menu',
		group: 'Actions',
		summary:
			'A button that opens a list of actions. Arrow keys move, Escape closes and returns focus.',
		code:
			ui('Menu') +
			`<Menu
  label="Actions"
  items={[
    { id: 'edit', label: 'Edit' },
    { id: 'archive', label: 'Archive', disabled: true },
    { id: 'delete', label: 'Delete', danger: true }
  ]}
  on:select={(e) => run(e.detail.id)}
/>`
	},
	{
		id: 'text-input',
		name: 'TextInput',
		group: 'Forms',
		summary:
			'A labelled input with a hint and an error, wired with aria-describedby and aria-invalid.',
		code:
			ui('TextInput') +
			`<TextInput label="Email" type="email" bind:value={email}
  hint="We never share it." error={emailError} required />`
	},
	{
		id: 'textarea',
		name: 'Textarea',
		group: 'Forms',
		summary: 'Multi-line input, with a live character count when it has a maxlength.',
		code: ui('Textarea') + `<Textarea label="Bio" bind:value={bio} maxlength={160} />`
	},
	{
		id: 'select',
		name: 'Select',
		group: 'Forms',
		summary: 'A labelled native select, the most accessible picker there is.',
		code:
			ui('Select') +
			`<Select label="Plan" bind:value={plan} placeholder="Choose a plan"
  options={[{ value: 'free', label: 'Free' }, { value: 'pro', label: 'Pro' }]} />`
	},
	{
		id: 'checkbox',
		name: 'Checkbox',
		group: 'Forms',
		summary: 'A box and its label, the whole row clickable. Supports indeterminate.',
		code:
			ui('Checkbox') +
			`<Checkbox label="Email me updates" hint="About once a month." bind:checked />`
	},
	{
		id: 'radio-group',
		name: 'RadioGroup',
		group: 'Forms',
		summary: 'One choice from a few, as a fieldset with a legend.',
		code:
			ui('RadioGroup') +
			`<RadioGroup legend="Billing" bind:value={billing} inline
  options={[{ value: 'monthly', label: 'Monthly' }, { value: 'yearly', label: 'Yearly' }]} />`
	},
	{
		id: 'switch',
		name: 'Switch',
		group: 'Forms',
		summary: 'An on/off setting that applies at once. A real checkbox with role="switch".',
		code: ui('Switch') + `<Switch label="Notifications" bind:checked={notify} />`
	},
	{
		id: 'slider',
		name: 'Slider',
		group: 'Forms',
		summary: 'A labelled range that shows its value, and announces it with the unit.',
		code: ui('Slider') + `<Slider label="Volume" bind:value={volume} unit="%" />`
	},
	{
		id: 'field',
		name: 'Field',
		group: 'Forms',
		summary: 'The label, hint and error around any control. Every form control is built on it.',
		code:
			ui('Field') +
			`<Field label="Colour" hint="Any CSS colour" let:id let:describedBy>
  <input {id} type="color" aria-describedby={describedBy} />
</Field>`
	},
	{
		id: 'alert',
		name: 'Alert',
		group: 'Feedback',
		summary:
			'A message in the page. Danger and warning interrupt a screen reader; info and success do not.',
		code:
			ui('Alert') +
			`<Alert tone="warning" title="Trial ends soon" dismissible>Three days left.</Alert>`
	},
	{
		id: 'toaster',
		name: 'Toaster',
		group: 'Feedback',
		summary:
			'Brief messages from anywhere. One <Toaster /> in the layout; raise them with toast.*().',
		code:
			ui('Toaster, toast') +
			`<!-- once, in +layout.svelte -->
<Toaster />

toast.success('Saved');
toast.danger('Could not reach the server', 0); // 0 = stays until dismissed`
	},
	{
		id: 'badge',
		name: 'Badge',
		group: 'Feedback',
		summary: 'A short status label in five tones, readable in both themes.',
		code: ui('Badge') + `<Badge tone="success">Live</Badge>`
	},
	{
		id: 'progress',
		name: 'Progress',
		group: 'Feedback',
		summary: 'How far along something is. Leave out the value for work of unknown length.',
		code: ui('Progress') + `<Progress label="Uploading" value={uploaded} max={total} />`
	},
	{
		id: 'spinner',
		name: 'Spinner',
		group: 'Feedback',
		summary: 'Indeterminate activity, announced as a status.',
		code: ui('Spinner') + `<Spinner label="Saving" />`
	},
	{
		id: 'skeleton',
		name: 'Skeleton',
		group: 'Feedback',
		summary: 'Placeholder shapes while content loads. Still under reduced motion.',
		code: ui('Skeleton') + `<Skeleton shape="circle" height="3rem" />\n<Skeleton lines={3} />`
	},
	{
		id: 'dialog',
		name: 'Dialog',
		group: 'Overlays',
		summary: 'A modal on the native <dialog>: focus trap, Escape and the backdrop for free.',
		code:
			ui('Dialog, Button') +
			`<Dialog bind:open title="Delete project?" description="This cannot be undone.">
  <svelte:fragment slot="actions">
    <Button variant="secondary" on:click={() => (open = false)}>Cancel</Button>
    <Button variant="danger" on:click={remove}>Delete</Button>
  </svelte:fragment>
</Dialog>`
	},
	{
		id: 'tooltip',
		name: 'Tooltip',
		group: 'Overlays',
		summary: 'A short description on hover and focus, read with the control. Escape hides it.',
		code: ui('Tooltip') + `<Tooltip text="Copies the link"><button>Copy</button></Tooltip>`
	},
	{
		id: 'tabs',
		name: 'Tabs',
		group: 'Navigation',
		summary: 'The ARIA tabs pattern: one tab stop, arrow keys between tabs.',
		code:
			ui('Tabs') +
			`<Tabs tabs={[{ id: 'code', label: 'Code' }, { id: 'preview', label: 'Preview' }]}
  bind:active let:active>
  {#if active === 'code'}…{:else}…{/if}
</Tabs>`
	},
	{
		id: 'accordion',
		name: 'Accordion',
		group: 'Navigation',
		summary: 'Built on <details>: opens with no script and works with find-in-page.',
		code:
			ui('Accordion') +
			`<Accordion exclusive items={[
  { title: 'Is it free?', content: 'Yes, MIT-licensed.' },
  { title: 'Where does it run?', content: 'Cloudflare.' }
]} />`
	},
	{
		id: 'breadcrumbs',
		name: 'Breadcrumbs',
		group: 'Navigation',
		summary: 'Where this page sits. The last item is the current page.',
		code:
			ui('Breadcrumbs') +
			`<Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Docs', href: '/documentation' }, { label: 'Tabs' }]} />`
	},
	{
		id: 'pagination',
		name: 'Pagination',
		group: 'Navigation',
		summary: 'Page numbers with gaps. Pass an href builder for real, crawlable links.',
		code:
			ui('Pagination') +
			`<Pagination bind:page total={24} />\n<Pagination page={2} total={24} href={(p) => \`?page=\${p}\`} />`
	},
	{
		id: 'card',
		name: 'Card',
		group: 'Data display',
		summary: 'A surface with an optional header and footer. With an href the whole card is a link.',
		code:
			ui('Card, Button') +
			`<Card title="Pro plan">
  Everything in Free, plus custom domains.
  <svelte:fragment slot="footer"><Button>Upgrade</Button></svelte:fragment>
</Card>`
	},
	{
		id: 'table',
		name: 'Table',
		group: 'Data display',
		summary: 'Rows and columns with optional sorting. Wide tables scroll in their own frame.',
		code:
			ui('Table') +
			`<Table caption="Deploys" {rows} columns={[
  { key: 'branch', label: 'Branch', sortable: true },
  { key: 'minutes', label: 'Minutes', sortable: true, align: 'end' }
]} />`
	},
	{
		id: 'avatar',
		name: 'Avatar',
		group: 'Data display',
		summary: 'A picture, or initials when there is none or it fails to load.',
		code: ui('Avatar') + `<Avatar name="Ada Lovelace" src={user.image} />`
	},
	{
		id: 'kbd',
		name: 'Kbd',
		group: 'Data display',
		summary: 'A key or a chord of keys.',
		code: ui('Kbd') + `<Kbd keys={['Ctrl', 'K']} />`
	},
	{
		id: 'empty-state',
		name: 'EmptyState',
		group: 'Data display',
		summary: 'What an empty list shows, and what to do next.',
		code:
			ui('EmptyState, Button') +
			`<EmptyState icon="✨" title="No projects yet" description="Make the first one.">
  <Button>New project</Button>
</EmptyState>`
	},
	{
		id: 'widget-stat',
		name: 'Stat',
		group: 'Widgets',
		summary: 'A number, its change, and a sparkline in the chart palette.',
		code: `{ type: 'stat', props: { label: 'Signups', value: '312', delta: -4, series: [42, 39, 44, 37] } }`
	},
	{
		id: 'widget-meter',
		name: 'Meter',
		group: 'Widgets',
		summary: 'Progress toward a goal, or usage against a limit that warns as it fills.',
		code: `{ type: 'meter', props: { label: 'Storage', value: 8.2, goal: 10, unit: ' GB', limit: true } }`
	},
	{
		id: 'widget-clock',
		name: 'Clock',
		group: 'Widgets',
		summary: 'Ticks every second through the board’s live channel, never into saved layout.',
		code: `{ type: 'clock', props: { label: 'Lisbon', timeZone: 'Europe/Lisbon' } }`
	},
	{
		id: 'widget-checklist',
		name: 'Checklist',
		group: 'Widgets',
		summary: 'A short to-do list with a done count.',
		code: `{ type: 'checklist', props: { items: [{ id: 'a', text: 'Write tests', done: true }] } }`
	},
	{
		id: 'widget-notes',
		name: 'Notes',
		group: 'Widgets',
		summary: 'A scratch pad.',
		code: `{ type: 'notes', props: { text: 'Remember the release notes.' } }`
	},
	{
		id: 'widget-links',
		name: 'Links',
		group: 'Widgets',
		summary: 'A short list of bookmarks. External links say they open a new tab.',
		code: `{ type: 'links', props: { links: [{ label: 'Docs', href: '/documentation' }] } }`
	},
	{
		id: 'dropdown-menu',
		name: 'DropdownMenu',
		group: 'Actions',
		summary:
			'Menu with groups, separators, checkbox and radio items, and shortcut hints. Typeahead finds an item by its first letters.',
		code:
			ui('DropdownMenu') +
			`<DropdownMenu
  label="View"
  bind:state={view}
  groups={[
    { items: [{ id: 'refresh', label: 'Refresh', shortcut: '⌘R' }] },
    { label: 'Show', items: [
      { id: 'hidden', label: 'Hidden files', checkbox: true },
      { id: 'ext', label: 'File extensions', checkbox: true }
    ] },
    { label: 'Sort by', radio: 'sort', items: [
      { id: 'name', label: 'Name' },
      { id: 'modified', label: 'Date modified' }
    ] }
  ]}
  on:select={(e) => run(e.detail.id)}
  on:change={(e) => save(e.detail.id, e.detail.value)}
/>`
	},
	{
		id: 'command',
		name: 'Command',
		group: 'Actions',
		summary:
			'A command palette: search ranks label and keyword matches as you type. Inline, or in a modal on ⌘K.',
		code:
			ui('Command') +
			`import { isCommandShortcut } from '$lib/ui/overlay-logic';

<svelte:window on:keydown={(e) => {
  if (isCommandShortcut(e)) { e.preventDefault(); paletteOpen = true; }
}} />

<Command
  dialog
  bind:open={paletteOpen}
  shortcut="⌘K"
  items={[
    { id: 'new', label: 'New project', group: 'Projects', shortcut: '⌘N' },
    { id: 'settings', label: 'Settings', group: 'Account', keywords: ['preferences'] }
  ]}
  on:select={(e) => run(e.detail.id)}
/>`
	},
	{
		id: 'popover',
		name: 'Popover',
		group: 'Overlays',
		summary:
			'A trigger and a floating panel for small forms and details. Flips at the screen edge; Escape returns focus.',
		code:
			ui('Popover, Button, TextInput') +
			`<Popover title="Share" placement="bottom" align="start" bind:open>
  <Button slot="trigger" variant="secondary">Share</Button>
  <TextInput label="Link" value={link} readonly />
  <Button size="sm" on:click={copy}>Copy link</Button>
</Popover>`
	},
	{
		id: 'hover-card',
		name: 'HoverCard',
		group: 'Overlays',
		summary:
			'A rich preview on hover and on keyboard focus, with open and close delays. Never the only way to the content.',
		code:
			ui('HoverCard') +
			`<HoverCard openDelay={500} closeDelay={200}>
  <a slot="trigger" href="/people/ada">@ada</a>
  <strong>Ada Lovelace</strong>
  <p>Wrote the first published program.</p>
</HoverCard>`
	},
	{
		id: 'sheet',
		name: 'Sheet',
		group: 'Overlays',
		summary:
			'A modal panel that slides in from any edge: a side panel, or a bottom drawer on a phone. Native <dialog>.',
		code:
			ui('Sheet, Button') +
			`<Sheet bind:open side="right" title="Filters" description="Narrow the list.">
  …
  <svelte:fragment slot="actions">
    <Button variant="secondary" on:click={() => (open = false)}>Close</Button>
    <Button on:click={apply}>Apply</Button>
  </svelte:fragment>
</Sheet>`
	},
	{
		id: 'alert-dialog',
		name: 'AlertDialog',
		group: 'Overlays',
		summary:
			'A confirmation that asks before it acts. Cancel takes focus first, and a backdrop click does not dismiss it.',
		code:
			ui('AlertDialog') +
			`<AlertDialog
  bind:open
  title="Delete project?"
  description="The project and its deploys go for good."
  confirmLabel="Delete"
  tone="danger"
  on:confirm={remove}
/>`
	},
	{
		id: 'context-menu',
		name: 'ContextMenu',
		group: 'Overlays',
		summary:
			'A right-click menu at the pointer, also on Shift+F10. Held inside the screen; offer the same actions visibly too.',
		code:
			ui('ContextMenu') +
			`<ContextMenu
  label="File actions"
  items={[
    { id: 'open', label: 'Open', shortcut: '↵' },
    { id: 'rename', label: 'Rename', shortcut: 'F2' },
    { separator: true },
    { id: 'delete', label: 'Delete', danger: true }
  ]}
  on:select={(e) => run(e.detail.id)}
>
  <button class="file">report.pdf</button>
</ContextMenu>`
	},
	{
		id: 'menubar',
		name: 'Menubar',
		group: 'Navigation',
		summary:
			'A row of menus, like File and Edit in a desktop app. One tab stop; arrows move along the bar and through each menu.',
		code:
			ui('Menubar') +
			`<Menubar
  label="Editor"
  menus={[
    { id: 'file', label: 'File', items: [
      { id: 'new', label: 'New', shortcut: '⌘N' },
      { separator: true },
      { id: 'close', label: 'Close', shortcut: '⌘W' }
    ] },
    { id: 'edit', label: 'Edit', items: [{ id: 'undo', label: 'Undo', shortcut: '⌘Z' }] }
  ]}
  on:select={(e) => run(e.detail.menu, e.detail.id)}
/>`
	},
	{
		id: 'toggle',
		name: 'Toggle',
		group: 'Actions',
		summary: 'A button that stays pressed, like Bold in a toolbar. Says so with aria-pressed.',
		code:
			ui('Toggle') +
			`<Toggle bind:pressed={bold}>Bold</Toggle>
<Toggle bind:pressed={pinned} label="Pin" variant="outline" size="sm">📌</Toggle>`
	},
	{
		id: 'toggle-group',
		name: 'ToggleGroup',
		group: 'Actions',
		summary:
			'A row of toggles with one tab stop. Single is a radio group; multiple is a set of pressed buttons.',
		code:
			ui('ToggleGroup') +
			`<ToggleGroup label="Alignment" bind:value={align}
  items={[{ value: 'left', label: 'Left' }, { value: 'center', label: 'Centre' }]} />
<ToggleGroup label="Style" type="multiple" bind:value={styles}
  items={[{ value: 'b', label: 'Bold' }, { value: 'i', label: 'Italic' }]} />`
	},
	{
		id: 'combobox',
		name: 'Combobox',
		group: 'Forms',
		summary:
			'Type to filter a list, arrow to an option, Enter to pick. Accent-insensitive; can create new values.',
		code:
			ui('Combobox') +
			`<Combobox label="Timezone" bind:value={zone} creatable
  options={[{ value: 'Europe/Berlin', label: 'Berlin' }, { value: 'Europe/Zurich', label: 'Zürich' }]}
  on:create={(e) => add(e.detail.value)} />`
	},
	{
		id: 'calendar',
		name: 'Calendar',
		group: 'Forms',
		summary:
			'A month as a keyboard grid: arrows by day and week, Page keys by month and year. Localized by Intl.',
		code:
			ui('Calendar') +
			`<Calendar bind:value={day} min="2026-01-01" weekStartsOn={1} locale="en-GB"
  isDisabled={(iso) => [0, 6].includes(new Date(iso).getUTCDay())} />`
	},
	{
		id: 'date-picker',
		name: 'DatePicker',
		group: 'Forms',
		summary:
			'A date field you can type into, with a calendar in a panel. Escape closes and returns focus.',
		code:
			ui('DatePicker') +
			`<DatePicker label="Start date" bind:value={start} min={today} hint="yyyy-mm-dd" />`
	},
	{
		id: 'input-otp',
		name: 'InputOTP',
		group: 'Forms',
		summary:
			'A one-time code in single-character cells. Auto-advances, pastes whole codes, offers SMS autofill.',
		code:
			ui('InputOTP') +
			`<InputOTP bind:value={code} length={6} on:complete={(e) => verify(e.detail.value)} />`
	},
	{
		id: 'input-group',
		name: 'InputGroup',
		group: 'Forms',
		summary: 'An input joined to text, icon or button addons. Text addons are read with the input.',
		code:
			ui('InputGroup, Button') +
			`<InputGroup label="Website" prefix="https://" suffix=".com" bind:value={site} />
<InputGroup label="Search" type="search" bind:value={q}>
  <Button slot="trailing" size="sm">Go</Button>
</InputGroup>`
	},
	{
		id: 'number-input',
		name: 'NumberInput',
		group: 'Forms',
		summary:
			'A spinbutton with − and + buttons. Arrow and Page keys step; typed values snap to the step.',
		code:
			ui('NumberInput') +
			`<NumberInput label="Guests" bind:value={guests} min={1} max={12} />
<NumberInput label="Weight" bind:value={kg} step={0.5} unit="kg" />`
	},
	{
		id: 'tag-input',
		name: 'TagInput',
		group: 'Forms',
		summary:
			'Type and press Enter or a comma to add chips. Deduplicates, caps the count, and validates.',
		code:
			ui('TagInput') +
			`<TagInput label="Topics" bind:tags max={5}
  validate={(t) => (t.length > 20 ? 'Keep it under 20 characters.' : '')} />`
	},
	{
		id: 'file-drop',
		name: 'FileDrop',
		group: 'Forms',
		summary:
			'A dropzone that is also a button. Checks type and size itself, and says why a file was refused.',
		code:
			ui('FileDrop') +
			`<FileDrop label="Attachments" bind:files accept="image/*,.pdf" maxSize={5 * 1024 * 1024}
  multiple on:reject={(e) => console.warn(e.detail.rejections)} />`
	},
	{
		id: 'button-group',
		name: 'ButtonGroup',
		group: 'Actions',
		summary:
			'Joins buttons into one control with shared borders. A labelled group, across or down.',
		code:
			ui('ButtonGroup, Button') +
			`<ButtonGroup label="Text alignment">
  <Button variant="secondary">Left</Button>
  <Button variant="secondary">Centre</Button>
  <Button variant="secondary">Right</Button>
</ButtonGroup>`
	},
	{
		id: 'sidebar',
		name: 'Sidebar',
		group: 'Navigation',
		summary:
			'App navigation with sections, badges and nested groups. Collapses to icons, and goes off-canvas on a phone.',
		code:
			ui('Sidebar') +
			`<Sidebar bind:collapsed current={$page.url.pathname} sections={[
  { heading: 'Workspace', items: [
    { id: 'home', label: 'Home', href: '/', icon: '⌂' },
    { id: 'inbox', label: 'Inbox', href: '/inbox', icon: '✉', badge: 3 },
    { id: 'settings', label: 'Settings', icon: '⚙', children: [
      { id: 'profile', label: 'Profile', href: '/settings/profile' }
    ] }
  ] }
]} />`
	},
	{
		id: 'navigation-menu',
		name: 'NavigationMenu',
		group: 'Navigation',
		summary:
			'A top nav whose items open panels of described links. Disclosure buttons, not a menu, so links stay links.',
		code:
			ui('NavigationMenu') +
			`<NavigationMenu current={$page.url.pathname} items={[
  { id: 'home', label: 'Home', href: '/' },
  { id: 'product', label: 'Product', links: [
    { label: 'Components', href: '/components', description: 'Every element, running' },
    { label: 'Docs', href: '/documentation', description: 'Set up and deploy' }
  ] }
]} />`
	},
	{
		id: 'stepper',
		name: 'Stepper',
		group: 'Navigation',
		summary:
			'Where someone is in a multi-step flow. Errors are said in words; completed steps can be revisited.',
		code:
			ui('Stepper') +
			`<Stepper current={step} clickable on:select={(e) => (step = e.detail.index)} steps={[
  { label: 'Account', description: 'Name and email' },
  { label: 'Plan' },
  { label: 'Payment', error: cardDeclined },
  { label: 'Done' }
]} />`
	},
	{
		id: 'container',
		name: 'Container',
		group: 'Layout',
		summary:
			'The page-width wrapper: a max width from sm to xl, with gutters that grow on wider screens.',
		code: ui('Container') + `<Container size="md" as="main">…</Container>`
	},
	{
		id: 'stack',
		name: 'Stack',
		group: 'Layout',
		summary: 'A flex row or column with a gap token, align, justify and wrap. The everyday layout.',
		code:
			ui('Stack, Button') +
			`<Stack direction="row" gap="sm" justify="between" align="center" wrap>
  <h2>Projects</h2>
  <Button>New project</Button>
</Stack>`
	},
	{
		id: 'separator',
		name: 'Separator',
		group: 'Layout',
		summary:
			'A line between groups, either way. Decorative by default, or a real separator with a label.',
		code:
			ui('Separator') +
			`<Separator />
<Separator label="or" decorative={false} />
<Separator orientation="vertical" />`
	},
	{
		id: 'aspect-ratio',
		name: 'AspectRatio',
		group: 'Layout',
		summary: 'Holds media at a fixed shape so the page does not jump while it loads.',
		code:
			ui('AspectRatio') +
			`<AspectRatio ratio="16/9">
  <img src={cover} alt="The launch event" />
</AspectRatio>`
	},
	{
		id: 'scroll-area',
		name: 'ScrollArea',
		group: 'Layout',
		summary:
			'A labelled, keyboard-scrollable region with thin themed scrollbars and shadows only where there is more.',
		code:
			ui('ScrollArea') +
			`<ScrollArea label="Release notes" maxHeight="16rem">
  {#each notes as note}<p>{note}</p>{/each}
</ScrollArea>`
	},
	{
		id: 'resizable',
		name: 'Resizable',
		group: 'Layout',
		summary:
			'Two panes and a divider to drag, or to move with the arrow keys. Enter collapses and restores.',
		code:
			ui('Resizable') +
			`<Resizable bind:size min={20} max={80}>
  <nav slot="first">Files</nav>
  <section slot="second">Editor</section>
</Resizable>`
	},
	{
		id: 'collapsible',
		name: 'Collapsible',
		group: 'Layout',
		summary: 'One region shown and hidden by a button. Eases open, or snaps under reduced motion.',
		code:
			ui('Collapsible') +
			`<Collapsible label="Show advanced options" bind:open>
  <TextInput label="Webhook URL" bind:value={webhook} />
</Collapsible>`
	},
	{
		id: 'data-table',
		name: 'DataTable',
		group: 'Data display',
		summary:
			'Search, sort, page and select. Select-all goes mixed for a partial page, and the result count is announced.',
		code:
			ui('DataTable, Button') +
			`<DataTable caption="Team" {rows} rowKey="id" selectable bind:selected
  columns={[
    { key: 'name', label: 'Name', sortable: true },
    { key: 'role', label: 'Role' },
    { key: 'commits', label: 'Commits', sortable: true, align: 'end',
      format: (v) => Number(v).toLocaleString() }
  ]}
  on:selection={(e) => (picked = e.detail.selected)}>
  <svelte:fragment slot="toolbar" let:selected>
    <Button size="sm" variant="danger" disabled={!selected.length}>Remove</Button>
  </svelte:fragment>
</DataTable>`
	},
	{
		id: 'bar-chart',
		name: 'BarChart',
		group: 'Data display',
		summary:
			'Grouped bars in plain SVG on round ticks. Screen readers get a summary and the numbers as a table.',
		code:
			ui('BarChart') +
			`<BarChart title="Deploys per day" labels={['Mon', 'Tue', 'Wed', 'Thu', 'Fri']}
  series={[
    { name: 'Production', values: [4, 7, 5, 9, 6] },
    { name: 'Preview', values: [12, 9, 14, 11, 8] }
  ]} />`
	},
	{
		id: 'line-chart',
		name: 'LineChart',
		group: 'Data display',
		summary:
			'One or more lines, with an optional area fill. A null value breaks the line. Arrow keys step through points.',
		code:
			ui('LineChart') +
			`<LineChart title="Visitors" area labels={days}
  series={[
    { name: 'This week', values: [320, 410, 380, 520, 610, 450, 390] },
    { name: 'Last week', values: [280, 300, null, 410, 470, 400, 350] }
  ]} />`
	},
	{
		id: 'donut-chart',
		name: 'DonutChart',
		group: 'Data display',
		summary: 'Parts of a whole, with the total in the middle and each share in the legend.',
		code:
			ui('DonutChart') +
			`<DonutChart title="Traffic sources" data={[
  { label: 'Search', value: 5200 },
  { label: 'Direct', value: 3100 },
  { label: 'Social', value: 1400 }
]} />`
	},
	{
		id: 'carousel',
		name: 'Carousel',
		group: 'Data display',
		summary:
			'Swipeable slides with buttons and dots. Autoplay pauses on hover and focus, and never runs under reduced motion.',
		code:
			ui('Carousel') +
			`<Carousel label="Highlights" items={slides} bind:index autoplay={5000} let:item>
  <img src={item.image} alt={item.alt} />
</Carousel>`
	},
	{
		id: 'item',
		name: 'Item',
		group: 'Data display',
		summary:
			'A list row: media, title, description, meta and actions. With an href the whole row is the link.',
		code:
			ui('Item, Avatar, Button') +
			`<Item title="Ada Lovelace" description="Reviewed your pull request" meta="2h" href="/people/ada">
  <Avatar slot="media" name="Ada Lovelace" size="sm" />
  <Button slot="actions" size="sm" variant="ghost">Reply</Button>
</Item>`
	},
	{
		id: 'timeline',
		name: 'Timeline',
		group: 'Data display',
		summary: 'Events in order on a line, each with a real <time> and a dot coloured by tone.',
		code:
			ui('Timeline') +
			`<Timeline label="Deploy history" items={[
  { time: '9:41', datetime: '2026-10-03T09:41', title: 'Deployed to production', tone: 'success' },
  { time: '9:30', datetime: '2026-10-03T09:30', title: 'Checks failed on preview', tone: 'danger' }
]} />`
	},
	{
		id: 'stat',
		name: 'Stat',
		group: 'Data display',
		summary:
			'A key figure with its change, read as "Up 4.2%". Invert it for figures where down is good.',
		code:
			ui('Stat') +
			`<Stat label="Revenue" value="$48,210" delta={12.4} help="vs last month" series={revenue} />
<Stat label="Error rate" value="0.42%" delta={-18} invert />`
	},
	{
		id: 'avatar-group',
		name: 'AvatarGroup',
		group: 'Data display',
		summary: 'Overlapping avatars with a "+N" for the rest, which names who it hides.',
		code:
			ui('AvatarGroup') +
			`<AvatarGroup label="Reviewers" max={3} people={[
  { name: 'Ada Lovelace' }, { name: 'Alan Turing' },
  { name: 'Grace Hopper' }, { name: 'Edsger Dijkstra' }
]} />`
	},
	{
		id: 'code-block',
		name: 'CodeBlock',
		group: 'Data display',
		summary:
			'Code with a file name, optional line numbers that never get copied, and a copy button that says it worked.',
		code:
			ui('CodeBlock') +
			`<CodeBlock filename="src/routes/+page.svelte" language="svelte" lineNumbers code={source} />`
	},
	{
		id: 'prose',
		name: 'Prose',
		group: 'Data display',
		summary: 'Sets HTML you did not mark up yourself — Markdown, a CMS body — on the type scale.',
		code: ui('Prose') + `<Prose>{@html post.html}</Prose>`
	}
];

export function catalogEntry(id: string): CatalogEntry {
	const entry = catalog.find((e) => e.id === id);
	if (!entry) throw new Error(`No catalog entry "${id}"`);
	return entry;
}
