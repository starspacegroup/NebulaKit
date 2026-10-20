<!--
	ConfirmDialog — a confirmation for destructive actions that reads like
	ordinary code. Bind the component and await it:

	  const ok = await dialog.ask({ title: 'Delete project?', confirmLabel: 'Delete' });
	  if (ok) remove();

	`ask` resolves true on Confirm and false on Cancel, Escape or a second
	`ask` taking over. It is the ui AlertDialog underneath: Cancel is focused
	first so a stray Enter never confirms, the page behind is inert, and
	focus returns to whatever had it when `ask` was called.
-->
<script context="module" lang="ts">
	export interface ConfirmOptions {
		title?: string;
		description?: string;
		confirmLabel?: string;
		cancelLabel?: string;
		tone?: 'default' | 'danger';
	}
</script>

<script lang="ts">
	import { tick } from 'svelte';
	import { AlertDialog } from '$lib/ui';
	import { createConfirmation } from './logic';

	export let title = 'Are you sure?';
	export let description = '';
	export let confirmLabel = 'Confirm';
	export let cancelLabel = 'Cancel';
	export let tone: 'default' | 'danger' = 'danger';

	const confirmation = createConfirmation();
	let open = false;
	let opener: HTMLElement | null = null;
	let current: Required<ConfirmOptions> = { title, description, confirmLabel, cancelLabel, tone };

	/** Open the dialog and wait for the answer. */
	export function ask(options: ConfirmOptions = {}): Promise<boolean> {
		opener = (document.activeElement as HTMLElement | null) ?? null;
		current = { title, description, confirmLabel, cancelLabel, tone, ...options };
		const answer = confirmation.ask();
		open = true;
		return answer;
	}

	async function settle(value: boolean) {
		confirmation.answer(value);
		await tick();
		opener?.focus?.();
	}
</script>

<AlertDialog
	bind:open
	title={current.title}
	description={current.description}
	confirmLabel={current.confirmLabel}
	cancelLabel={current.cancelLabel}
	tone={current.tone}
	on:confirm={() => settle(true)}
	on:cancel={() => settle(false)}
/>
