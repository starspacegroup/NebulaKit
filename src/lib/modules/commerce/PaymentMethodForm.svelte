<!--
	PaymentMethodForm — add a card. Number grouping by brand, a Luhn check,
	MM/YY expiry, and a CVC whose length follows the brand (4 for Amex).
	cc-* autocomplete lets the browser and password managers fill it.

	DEMO ONLY: these are ordinary inputs. Never send a card number through your
	own server; in production replace this with your payment processor's hosted
	fields (Stripe Elements, Adyen Drop-in...) so card data never touches you.
	The `submit` event carries the digits so the demo can show validation.
-->
<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import Button from '$lib/ui/Button.svelte';
	import Field from '$lib/ui/Field.svelte';
	import { uid } from '$lib/ui/logic';
	import {
		CARD_BRAND_LABELS,
		checkCardNumber,
		checkCvc,
		checkExpiry,
		cvcLength,
		detectCardBrand,
		cardDigits,
		formatCardNumber,
		formatExpiry,
		parseExpiry,
		type CardBrand
	} from './logic';

	export let now: Date | null = null;
	export let loading = false;
	/** Show the "make this my default card" checkbox. */
	export let offerDefault = true;
	/** A message from the server after submit (declined, etc.). */
	export let error = '';
	export let showDemoNotice = true;
	export let level: 2 | 3 | 4 = 3;
	export let labels: Partial<typeof defaults> = {};

	const defaults = {
		heading: 'Add a card',
		demo: 'Demo fields. These are plain inputs: in production use your payment processor’s hosted fields so card numbers never reach your server.',
		name: 'Name on card',
		number: 'Card number',
		expiry: 'Expiry (MM/YY)',
		cvc: 'Security code',
		makeDefault: 'Use as my default card',
		submit: 'Save card',
		summary: 'Fix {count} problems to continue:',
		summaryOne: 'Fix 1 problem to continue:',
		nameRequired: 'Enter the name on the card.',
		numberRequired: 'Enter the card number.',
		numberLength: 'That card number is the wrong length.',
		numberLuhn: 'That card number is not valid. Check for a typo.',
		expiryRequired: 'Enter the expiry date.',
		expiryFormat: 'Use the format MM/YY, for example 08/28.',
		expiryExpired: 'This card has expired.',
		expiryFar: 'That expiry date is too far away.',
		cvcRequired: 'Enter the security code.',
		cvcLength: 'The security code is {n} digits.',
		cvcHint: '{n} digits',
		brandNamed: 'Card type: {brand}'
	};

	const dispatch = createEventDispatcher<{
		submit: {
			name: string;
			number: string;
			brand: CardBrand;
			last4: string;
			expMonth: number;
			expYear: number;
			cvc: string;
			makeDefault: boolean;
		};
	}>();

	const id = uid('pmf');
	let form: HTMLFormElement;
	let summaryEl: HTMLDivElement;
	let name = '';
	let number = '';
	let expiry = '';
	let cvc = '';
	let makeDefault = false;
	let touched: Record<string, boolean> = {};
	let submitted = false;

	$: t = { ...defaults, ...labels };
	$: brand = detectCardBrand(number);
	$: cvcN = cvcLength(brand);

	function reference(): Date {
		return now ?? new Date();
	}

	function codeMessage(field: string, code: string): string {
		const key = `${field}${code[0].toUpperCase()}${code.slice(1)}` as keyof typeof defaults;
		return String(t[key] ?? '').replace('{n}', String(cvcN));
	}

	$: errors = (() => {
		const out: Record<string, string> = {};
		if (!name.trim()) out.name = t.nameRequired;
		const n = checkCardNumber(number);
		if (!n.ok) out.number = codeMessage('number', n.code);
		const e = checkExpiry(expiry, reference());
		if (!e.ok) out.expiry = codeMessage('expiry', e.code);
		const c = checkCvc(cvc, brand);
		if (!c.ok) out.cvc = codeMessage('cvc', c.code);
		return out;
	})();

	$: show = (field: string) => (submitted || touched[field] ? (errors[field] ?? '') : '');
	$: shown = ['name', 'number', 'expiry', 'cvc'].filter((f) => submitted && errors[f]);

	function touch(field: string) {
		touched = { ...touched, [field]: true };
	}

	function onNumber(event: Event) {
		const el = event.currentTarget as HTMLInputElement;
		number = formatCardNumber(el.value);
		el.value = number;
	}

	function onExpiry(event: Event) {
		const el = event.currentTarget as HTMLInputElement;
		expiry = formatExpiry(el.value, expiry);
		el.value = expiry;
	}

	function onCvc(event: Event) {
		const el = event.currentTarget as HTMLInputElement;
		cvc = cardDigits(el.value).slice(0, cvcN);
		el.value = cvc;
	}

	async function onSubmit() {
		submitted = true;
		if (shown.length === 0 && Object.keys(errors).length === 0) {
			const digits = cardDigits(number);
			const exp = parseExpiry(expiry)!;
			dispatch('submit', {
				name: name.trim(),
				number: digits,
				brand,
				last4: digits.slice(-4),
				expMonth: exp.month,
				expYear: exp.year,
				cvc,
				makeDefault
			});
			return;
		}
		await tick();
		summaryEl?.focus();
	}

	function focusField(field: string) {
		form.querySelector<HTMLElement>(`[name="${field}"]`)?.focus();
	}

	const fieldLabel = (f: string) =>
		({ name: t.name, number: t.number, expiry: t.expiry, cvc: t.cvc })[f];
</script>

<form
	bind:this={form}
	class="pmf"
	novalidate
	on:submit|preventDefault={onSubmit}
	aria-labelledby="{id}-h"
>
	<svelte:element this={`h${level}`} class="pmf__title" id="{id}-h">{t.heading}</svelte:element>

	{#if showDemoNotice}<p class="pmf__demo">{t.demo}</p>{/if}

	{#if submitted && shown.length}
		<div bind:this={summaryEl} class="pmf__summary" role="alert" tabindex="-1">
			<p>
				{shown.length === 1 ? t.summaryOne : t.summary.replace('{count}', String(shown.length))}
			</p>
			<ul>
				{#each shown as f (f)}
					<li>
						<a href="#{id}-{f}" on:click|preventDefault={() => focusField(f)}
							>{fieldLabel(f)}: {errors[f]}</a
						>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
	{#if error}<p class="pmf__server" role="alert">{error}</p>{/if}

	<Field label={t.name} error={show('name')} required id="{id}-name" let:describedBy let:invalid>
		<input
			id="{id}-name"
			name="name"
			type="text"
			autocomplete="cc-name"
			value={name}
			required
			aria-describedby={describedBy}
			aria-invalid={invalid || undefined}
			on:input={(e) => (name = e.currentTarget.value)}
			on:blur={() => touch('name')}
		/>
	</Field>

	<Field
		label={t.number}
		error={show('number')}
		hint={brand !== 'unknown' ? t.brandNamed.replace('{brand}', CARD_BRAND_LABELS[brand]) : ''}
		required
		id="{id}-number"
		let:describedBy
		let:invalid
	>
		<input
			id="{id}-number"
			name="number"
			type="text"
			inputmode="numeric"
			autocomplete="cc-number"
			autocapitalize="off"
			spellcheck="false"
			placeholder="1234 1234 1234 1234"
			value={number}
			required
			aria-describedby={describedBy}
			aria-invalid={invalid || undefined}
			on:input={onNumber}
			on:blur={() => touch('number')}
		/>
	</Field>

	<div class="pmf__row">
		<Field
			label={t.expiry}
			error={show('expiry')}
			required
			id="{id}-expiry"
			let:describedBy
			let:invalid
		>
			<input
				id="{id}-expiry"
				name="expiry"
				type="text"
				inputmode="numeric"
				autocomplete="cc-exp"
				placeholder="MM/YY"
				maxlength="5"
				value={expiry}
				required
				aria-describedby={describedBy}
				aria-invalid={invalid || undefined}
				on:input={onExpiry}
				on:blur={() => touch('expiry')}
			/>
		</Field>
		<Field
			label={t.cvc}
			error={show('cvc')}
			hint={t.cvcHint.replace('{n}', String(cvcN))}
			required
			id="{id}-cvc"
			let:describedBy
			let:invalid
		>
			<input
				id="{id}-cvc"
				name="cvc"
				type="text"
				inputmode="numeric"
				autocomplete="cc-csc"
				maxlength={cvcN}
				value={cvc}
				required
				aria-describedby={describedBy}
				aria-invalid={invalid || undefined}
				on:input={onCvc}
				on:blur={() => touch('cvc')}
			/>
		</Field>
	</div>

	{#if offerDefault}
		<label class="pmf__default">
			<input type="checkbox" bind:checked={makeDefault} />
			<span>{t.makeDefault}</span>
		</label>
	{/if}

	<Button type="submit" {loading} block>{t.submit}</Button>
</form>

<style>
	.pmf {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
		min-width: 0;
		max-width: 28rem;
		color: var(--color-text);
	}

	.pmf__title {
		margin: 0;
		font-size: 1.25rem;
	}

	.pmf__demo {
		margin: 0;
		padding: var(--spacing-sm) var(--spacing-md);
		border: 1px dashed var(--color-border);
		border-radius: var(--radius-md);
		color: var(--color-text-secondary);
		font-size: 0.8125rem;
	}

	.pmf__summary,
	.pmf__server {
		margin: 0;
		padding: var(--spacing-md);
		border: 1px solid var(--color-error);
		border-radius: var(--radius-md);
		color: var(--color-text);
	}

	.pmf__summary p {
		margin: 0 0 var(--spacing-xs);
		font-weight: 700;
	}

	.pmf__summary ul {
		margin: 0;
		padding-inline-start: var(--spacing-lg);
	}

	.pmf__summary a {
		color: var(--color-error);
	}

	.pmf :global(input[type='text']) {
		width: 100%;
		min-height: 2.75rem;
		box-sizing: border-box;
	}

	.pmf__row {
		display: grid;
		gap: var(--spacing-md);
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.pmf__default {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		min-height: 2.75rem;
		cursor: pointer;
	}

	.pmf__default input {
		width: 1.25rem;
		height: 1.25rem;
		accent-color: var(--color-primary-solid);
	}

	.pmf :global(.btn) {
		min-height: 2.75rem;
	}
</style>
