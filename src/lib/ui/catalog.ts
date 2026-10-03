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
	}
];

export function catalogEntry(id: string): CatalogEntry {
	const entry = catalog.find((e) => e.id === id);
	if (!entry) throw new Error(`No catalog entry "${id}"`);
	return entry;
}
