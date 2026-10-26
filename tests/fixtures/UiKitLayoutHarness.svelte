<!--
	Fills the layout and navigation components' slots so their tests can
	render them the way a page would, and reports component events and bound
	values through `onEvent`. A callback prop works the same under Svelte 4 and
	5; the testing-library event APIs do not.
-->
<script lang="ts">
	import Button from '$lib/ui/Button.svelte';
	import ButtonGroup from '$lib/ui/ButtonGroup.svelte';
	import Collapsible from '$lib/ui/Collapsible.svelte';
	import NavigationMenu from '$lib/ui/NavigationMenu.svelte';
	import Resizable from '$lib/ui/Resizable.svelte';
	import ScrollArea from '$lib/ui/ScrollArea.svelte';
	import Sidebar from '$lib/ui/Sidebar.svelte';
	import Stepper from '$lib/ui/Stepper.svelte';

	export let which: 'sidebar' | 'nav' | 'stepper' | 'group' | 'split' | 'collapse' | 'scroll';
	export let props: Record<string, unknown> = {};
	export let collapsed = false;
	export let open = false;
	export let size = 50;
	// `any` so each test can type the detail it expects.
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	export let onEvent: (name: string, detail: any) => void = () => {};

	$: onEvent('collapsed', collapsed);
	$: onEvent('open', open);
	$: onEvent('size', size);
</script>

{#if which === 'sidebar'}
	<Sidebar
		sections={[
			{
				heading: 'Workspace',
				items: [
					{ id: 'home', label: 'Home', href: '/' },
					{ id: 'inbox', label: 'Inbox', href: '/inbox', badge: 3 },
					{
						id: 'settings',
						label: 'Settings',
						children: [
							{ id: 'profile', label: 'Profile', href: '/settings/profile' },
							{ id: 'billing', label: 'Billing' }
						]
					},
					{ id: 'logout', label: 'Log out' }
				]
			}
		]}
		bind:collapsed
		bind:open
		{...props}
		on:select={(e) => onEvent('select', e.detail)}
	>
		<span slot="icon" let:item data-testid="icon-{item.id}">•</span>
		<p slot="header">Acme</p>
	</Sidebar>
{:else if which === 'nav'}
	<NavigationMenu
		items={[
			{ id: 'home', label: 'Home', href: '/' },
			{
				id: 'product',
				label: 'Product',
				links: [
					{ label: 'Features', href: '/features', description: 'What it does' },
					{ label: 'Pricing', href: '/pricing' },
					{ label: 'Changelog', href: '/changelog' }
				]
			},
			{
				id: 'docs',
				label: 'Docs',
				links: [{ label: 'Guide', href: '/docs/guide' }]
			}
		]}
		{...props}
	/>
	<button type="button">Outside</button>
{:else if which === 'stepper'}
	<Stepper
		steps={[
			{ id: 'account', label: 'Account', description: 'Your details' },
			{ id: 'plan', label: 'Plan', error: true },
			{ id: 'pay', label: 'Payment' },
			{ id: 'done', label: 'Done' }
		]}
		current={2}
		{...props}
		on:select={(e) => onEvent('select', e.detail)}
	/>
{:else if which === 'group'}
	<ButtonGroup label="Text alignment" {...props}>
		<Button variant="secondary">Left</Button>
		<Button variant="secondary">Centre</Button>
		<button type="button">Right</button>
	</ButtonGroup>
{:else if which === 'split'}
	<Resizable bind:size min={20} max={80} {...props} on:change={(e) => onEvent('change', e.detail)}>
		<p slot="first">Files</p>
		<p slot="second">Editor</p>
	</Resizable>
{:else if which === 'collapse'}
	<Collapsible bind:open label="Show details" on:toggle={(e) => onEvent('toggle', e.detail)}>
		<a href="/more">More</a>
	</Collapsible>
{:else if which === 'scroll'}
	<ScrollArea label="Release notes" maxHeight="5rem" {...props}>
		<p>Long content</p>
	</ScrollArea>
{/if}
