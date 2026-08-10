import { render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import CmsItemEditor from '../../src/lib/components/CmsItemEditor.svelte';

// The full-page editor replaced the item modals; this guards the tasklist
// branch the replacement initially dropped (structured { text, done }[] values
// must never render as a plain text input, which would stringify them on save).

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

const taskListContentType = {
	id: 'ct-1',
	name: 'Project',
	slug: 'project',
	fields: [
		{
			name: 'checklist',
			label: 'Checklist',
			type: 'tasklist',
			order: 1
		}
	],
	settings: {}
};

describe('CmsItemEditor tasklist fields', () => {
	it('renders TaskListField with existing structured tasks, not a text input', () => {
		render(CmsItemEditor, {
			props: {
				contentType: taskListContentType,
				item: {
					id: 'item-1',
					title: 'Launch plan',
					slug: 'launch-plan',
					status: 'draft',
					fields: {
						checklist: [
							{ text: 'Write the docs', done: false },
							{ text: 'Ship it', done: true }
						]
					}
				},
				tags: []
			}
		});

		// Existing tasks appear as checkable items…
		expect(screen.getByText('Write the docs')).toBeTruthy();
		expect(screen.getByText('Ship it')).toBeTruthy();
		const checkboxes = screen.getAllByRole('checkbox');
		expect(checkboxes.length).toBeGreaterThanOrEqual(2);

		// …and the field is not rendered as the fallback text input, which
		// would replace the array with a string on save.
		expect(document.querySelector('input[type="text"]#field-checklist')).toBeNull();
	});

	it('defaults a new item to an empty task array and offers the add-task input', () => {
		render(CmsItemEditor, {
			props: {
				contentType: taskListContentType,
				item: null,
				tags: []
			}
		});

		// TaskListField's add-task affordance is present for new items.
		expect(document.querySelector('input[type="text"]#field-checklist')).toBeNull();
		expect(document.querySelector('.tasklist')).toBeTruthy();
	});
});
