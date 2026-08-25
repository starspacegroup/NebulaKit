/**
 * Callout embed — a brand-neutral reference embed.
 *
 * Demonstrates the embed pattern end to end: a typed props schema (which the
 * editor turns into a form automatically) and a theme-token-aware component
 * that renders live in published content. Copy this folder to start your own.
 */
import { defineEmbed } from '../props-schema';

export const definition = defineEmbed({
	name: 'callout',
	label: 'Callout',
	description: 'A highlighted note box (info, success, warning, or danger).',
	props: [
		{
			key: 'variant',
			label: 'Variant',
			type: 'select',
			default: 'info',
			options: [
				{ label: 'Info', value: 'info' },
				{ label: 'Success', value: 'success' },
				{ label: 'Warning', value: 'warning' },
				{ label: 'Danger', value: 'danger' }
			]
		},
		{ key: 'title', label: 'Title', type: 'string', default: 'Note' },
		{
			key: 'body',
			label: 'Body',
			type: 'string',
			default: '',
			placeholder: 'What do you want to highlight?'
		}
	]
});
