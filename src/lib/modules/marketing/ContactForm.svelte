<!--
	ContactForm — name, email, topic and message.

	A failed submit gathers the errors in an alert summary (each entry links to
	its field), moves focus to the summary, and ties each message to its field
	with `aria-invalid` + `aria-describedby`. The message has a live character
	counter. A valid submit fires `send`; the app answers with `status`
	("idle" | "sending" | "success" | "error"). Success replaces the form with a
	confirmation that takes focus and offers `reset`.
-->
<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import Button from '$lib/ui/Button.svelte';
	import Select from '$lib/ui/Select.svelte';
	import Textarea from '$lib/ui/Textarea.svelte';
	import TextInput from '$lib/ui/TextInput.svelte';
	import { uid } from '$lib/ui/logic';
	import {
		CONTACT_FIELD_ORDER,
		orderedErrors,
		validateContact,
		type ContactField,
		type ContactValues,
		type MarketingFormMessages
	} from './logic';

	export let title = 'Contact us';
	export let level: 2 | 3 | 4 = 2;
	export let topics: { value: string; label: string }[] = [
		{ value: 'sales', label: 'Sales' },
		{ value: 'support', label: 'Support' },
		{ value: 'other', label: 'Something else' }
	];
	export let status: 'idle' | 'sending' | 'success' | 'error' = 'idle';
	export let errorMessage = '';
	export let maxMessage = 500;
	export let minMessage = 10;
	export let values: ContactValues = { name: '', email: '', topic: '', message: '' };
	export let labels = {
		name: 'Your name',
		email: 'Email address',
		topic: 'Topic',
		topicPlaceholder: 'Choose a topic',
		message: 'Message',
		submit: 'Send message',
		summary: (n: number) =>
			n === 1 ? 'Fix 1 problem to continue:' : `Fix ${n} problems to continue:`,
		successTitle: 'Message sent',
		successText: 'Thanks. We will reply within two working days.',
		another: 'Send another message',
		error: 'The message could not be sent. Please try again.'
	};
	export let messages: Partial<MarketingFormMessages> = {};

	const id = uid('contact');
	const dispatch = createEventDispatcher<{ send: ContactValues; reset: void }>();

	let errors: Partial<Record<ContactField, string>> = {};
	let submitted = false;
	let summaryEl: HTMLElement;
	let successEl: HTMLElement;
	let wasSuccess = false;

	$: list = orderedErrors(errors, CONTACT_FIELD_ORDER);
	$: if ((status === 'success') !== wasSuccess) {
		wasSuccess = status === 'success';
		if (wasSuccess) tick().then(() => successEl?.focus());
	}

	const fieldId = (f: ContactField) => `${id}-${f}`;

	// Once the visitor has tried to submit, errors clear as they fix each field.
	$: if (submitted) errors = validateContact(values, { maxMessage, minMessage, messages });

	async function submit() {
		submitted = true;
		errors = validateContact(values, { maxMessage, minMessage, messages });
		if (Object.keys(errors).length > 0) {
			await tick();
			summaryEl?.focus();
			return;
		}
		dispatch('send', { ...values });
	}

	function focusField(event: MouseEvent, field: ContactField) {
		event.preventDefault();
		document.getElementById(fieldId(field))?.focus();
	}

	function again() {
		values = { name: '', email: '', topic: '', message: '' };
		errors = {};
		submitted = false;
		dispatch('reset');
	}
</script>

<section class="contact" aria-labelledby="{id}-title">
	<svelte:element this={`h${level}`} id="{id}-title" class="contact__title">{title}</svelte:element>

	{#if status === 'success'}
		<div bind:this={successEl} class="contact__success" tabindex="-1" role="status">
			<p class="contact__success-title"><span aria-hidden="true">✓</span> {labels.successTitle}</p>
			<p>{labels.successText}</p>
			<Button variant="secondary" size="lg" on:click={again}>{labels.another}</Button>
		</div>
	{:else}
		<form novalidate class="contact__form" on:submit|preventDefault={submit}>
			{#if list.length > 0}
				<div bind:this={summaryEl} class="contact__summary" role="alert" tabindex="-1">
					<p>{labels.summary(list.length)}</p>
					<ul>
						{#each list as [field, text] (field)}
							<li><a href="#{fieldId(field)}" on:click={(e) => focusField(e, field)}>{text}</a></li>
						{/each}
					</ul>
				</div>
			{/if}
			{#if status === 'error'}
				<p class="contact__fail" role="alert">
					<span aria-hidden="true">⚠</span>
					{errorMessage || labels.error}
				</p>
			{/if}
			<TextInput
				id={fieldId('name')}
				label={labels.name}
				bind:value={values.name}
				error={errors.name ?? ''}
				required
				autocomplete="name"
			/>
			<TextInput
				id={fieldId('email')}
				type="email"
				label={labels.email}
				bind:value={values.email}
				error={errors.email ?? ''}
				required
				autocomplete="email"
			/>
			<Select
				id={fieldId('topic')}
				label={labels.topic}
				placeholder={labels.topicPlaceholder}
				options={topics}
				bind:value={values.topic}
				error={errors.topic ?? ''}
				required
			/>
			<Textarea
				id={fieldId('message')}
				label={labels.message}
				bind:value={values.message}
				error={errors.message ?? ''}
				maxlength={maxMessage}
				required
				rows={5}
			/>
			<Button type="submit" size="lg" loading={status === 'sending'}>{labels.submit}</Button>
		</form>
	{/if}
</section>

<style>
	.contact {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
		min-width: 0;
	}

	.contact__title {
		margin: 0;
		font-size: 1.5rem;
	}

	.contact__form {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
	}

	.contact__summary,
	.contact__fail {
		margin: 0;
		padding: var(--spacing-md);
		border: 2px solid var(--color-error);
		border-radius: var(--radius-md);
		background: var(--color-background);
	}

	.contact__summary p {
		margin: 0 0 var(--spacing-xs);
		font-weight: 700;
	}

	.contact__summary ul {
		margin: 0;
		padding-inline-start: var(--spacing-lg);
	}

	.contact__summary a {
		display: inline-block;
		min-block-size: 1.75rem;
		color: var(--color-error);
		font-weight: 600;
	}

	.contact__success {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		justify-items: start;
		gap: var(--spacing-sm);
		padding: var(--spacing-lg);
		border: 2px solid var(--color-success);
		border-radius: var(--radius-lg);
		background: var(--color-background);
	}

	.contact__success p {
		margin: 0;
	}

	.contact__success-title {
		color: var(--color-success);
		font-size: 1.25rem;
		font-weight: 700;
	}
</style>
