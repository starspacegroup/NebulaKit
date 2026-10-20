<!--
	Renders the app-shell modules with bound state, reporting their events
	through `onEvent` and the bound state as JSON in `data-testid="state"`.
-->
<script lang="ts">
	import type { ShellWhich } from './modules-which';
	import AppShell from '$lib/modules/shell/AppShell.svelte';
	import BottomNav from '$lib/modules/shell/BottomNav.svelte';
	import ConfirmDialog from '$lib/modules/shell/ConfirmDialog.svelte';
	import EmptyStateCard from '$lib/modules/shell/EmptyStateCard.svelte';
	import ErrorState from '$lib/modules/shell/ErrorState.svelte';
	import GlobalSearch from '$lib/modules/shell/GlobalSearch.svelte';
	import NotificationCenter from '$lib/modules/shell/NotificationCenter.svelte';
	import OnboardingChecklist from '$lib/modules/shell/OnboardingChecklist.svelte';
	import PageHeader from '$lib/modules/shell/PageHeader.svelte';
	import TabsPageNav from '$lib/modules/shell/TabsPageNav.svelte';
	import Toolbar from '$lib/modules/shell/Toolbar.svelte';
	import UserMenu from '$lib/modules/shell/UserMenu.svelte';
	import Wizard from '$lib/modules/shell/Wizard.svelte';
	import { runWizardRules, wizardRequiredRule } from '$lib/modules/shell/logic';

	export let which: ShellWhich;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	export let props: Record<string, any> = {};
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	export let onEvent: (name: string, detail: any) => void = () => {};

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let items: any[] = props.items ?? [];
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let steps: any[] = props.steps ?? [];
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let groups: any[] = props.groups ?? [];
	let open = false;
	let query = '';
	let dismissed = false;
	let collapsed = false;
	let shellOpen = false;
	let values: Record<string, unknown> = { name: '', email: '' };
	let dialog: ConfirmDialog;
	let answer = '';

	function validate(stepId: string, v: Record<string, unknown>) {
		return stepId === 'account'
			? runWizardRules({ name: wizardRequiredRule('Enter your name.') }, v)
			: {};
	}

	async function ask() {
		const ok = await dialog.ask({ title: 'Delete it?', confirmLabel: 'Delete' });
		answer = ok ? 'yes' : 'no';
	}

	$: state = JSON.stringify({
		items,
		steps,
		groups,
		open,
		query,
		dismissed,
		collapsed,
		shellOpen,
		values,
		answer
	});
</script>

{#if which === 'shell'}
	<AppShell
		bind:collapsed
		bind:open={shellOpen}
		{...props}
		on:toggle={(e) => onEvent('toggle', e.detail)}
		on:navigate={() => onEvent('navigate', null)}
	>
		<span slot="brand">Brand</span>
		<ul slot="nav">
			<li><a href="#one">One</a></li>
			<li><a href="#two">Two</a></li>
		</ul>
		<h1>Page</h1>
		<p slot="footer">Foot</p>
	</AppShell>
{:else if which === 'header'}
	<PageHeader title="" {...props} on:action={(e) => onEvent('action', e.detail)} />
{:else if which === 'notifications'}
	<NotificationCenter
		bind:items
		bind:open
		{...props}
		on:read={(e) => onEvent('read', e.detail)}
		on:readall={() => onEvent('readall', null)}
		on:select={(e) => onEvent('select', e.detail)}
	/>
{:else if which === 'search'}
	<button type="button">before</button>
	<GlobalSearch
		bind:open
		bind:query
		{items}
		{...props}
		on:search={(e) => onEvent('search', e.detail)}
		on:select={(e) => onEvent('select', e.detail)}
		on:recent={(e) => onEvent('recent', e.detail)}
	/>
{:else if which === 'user'}
	<UserMenu
		user={{ name: '' }}
		{...props}
		on:select={(e) => onEvent('select', e.detail)}
		on:signout={() => onEvent('signout', null)}
	/>
	<button type="button">outside</button>
{:else if which === 'checklist'}
	<OnboardingChecklist
		bind:steps
		bind:dismissed
		{...props}
		on:step={(e) => onEvent('step', e.detail)}
		on:complete={() => onEvent('complete', null)}
		on:dismiss={() => onEvent('dismiss', null)}
	/>
{:else if which === 'wizard'}
	<Wizard
		{steps}
		bind:values
		{validate}
		{...props}
		on:step={(e) => onEvent('step', e.detail)}
		on:finish={(e) => onEvent('finish', e.detail)}
		let:step
		let:errors
		let:fieldId
	>
		{#if step.id === 'account'}
			<label for={fieldId('name')}>Name</label>
			<input
				id={fieldId('name')}
				bind:value={values.name}
				aria-invalid={errors.name ? 'true' : undefined}
			/>
		{:else}
			<p>Step {step.label}</p>
		{/if}
	</Wizard>
{:else if which === 'error'}
	<ErrorState
		{...props}
		on:retry={() => onEvent('retry', null)}
		on:home={() => onEvent('home', null)}
		on:copy={(e) => onEvent('copy', e.detail)}
	/>
{:else if which === 'empty'}
	<EmptyStateCard {...props} on:action={(e) => onEvent('action', e.detail)} />
{:else if which === 'confirm'}
	<button type="button" on:click={ask}>Delete</button>
	<ConfirmDialog bind:this={dialog} {...props} />
{:else if which === 'tabs'}
	<TabsPageNav {items} {...props} />
{:else if which === 'toolbar'}
	<Toolbar bind:groups {...props} on:action={(e) => onEvent('action', e.detail)} />
	<button type="button">after</button>
{:else if which === 'bottom'}
	<BottomNav {items} {...props} />
{/if}

<output data-testid="state">{state}</output>
