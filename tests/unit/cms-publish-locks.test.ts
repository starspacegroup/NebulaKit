/**
 * Publish locks: fields (and optionally title/slug) that stop being editable
 * once an item has EVER been published.
 *
 * The "ever" is the whole point — enforcement keys on published_at rather than
 * current status, so an unpublish → edit → republish cycle cannot be used to
 * launder a locked value.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getLockedFieldViolations } from '../../src/lib/cms/utils';

const LOCKED_FIELD = {
	name: 'claim',
	label: 'Claim',
	type: 'textarea' as const,
	lockedAfterPublish: true
};
const FREE_FIELD = { name: 'notes', label: 'Notes', type: 'textarea' as const };

describe('getLockedFieldViolations', () => {
	it('reports a locked field whose value changed', () => {
		const v = getLockedFieldViolations([LOCKED_FIELD], { claim: 'a' }, { claim: 'b' });
		expect(v).toEqual(['Claim']);
	});

	it('ignores a locked field that was submitted unchanged', () => {
		expect(getLockedFieldViolations([LOCKED_FIELD], { claim: 'a' }, { claim: 'a' })).toEqual([]);
	});

	it('ignores a locked field absent from the patch', () => {
		expect(getLockedFieldViolations([LOCKED_FIELD], { claim: 'a' }, { notes: 'x' })).toEqual([]);
	});

	it('ignores unlocked fields entirely', () => {
		expect(getLockedFieldViolations([FREE_FIELD], { notes: 'a' }, { notes: 'b' })).toEqual([]);
	});

	it('compares by value, not reference, so equal objects do not trip it', () => {
		const defs = [{ ...LOCKED_FIELD, name: 'window', label: 'Window' }];
		const same = getLockedFieldViolations(defs, { window: { a: 1 } }, { window: { a: 1 } });
		expect(same).toEqual([]);
		const diff = getLockedFieldViolations(defs, { window: { a: 1 } }, { window: { a: 2 } });
		expect(diff).toEqual(['Window']);
	});

	it('collects every violating label', () => {
		const defs = [LOCKED_FIELD, { ...LOCKED_FIELD, name: 'source', label: 'Source' }];
		const v = getLockedFieldViolations(
			defs,
			{ claim: 'a', source: 'x' },
			{ claim: 'b', source: 'y' }
		);
		expect(v).toEqual(['Claim', 'Source']);
	});
});

describe('updateContentItem publish locks', () => {
	let mockDB: any;

	beforeEach(() => {
		vi.resetModules();
		mockDB = {
			prepare: vi.fn().mockReturnThis(),
			bind: vi.fn().mockReturnThis(),
			first: vi.fn(),
			all: vi.fn(),
			run: vi.fn(),
			batch: vi.fn()
		};
	});

	const existingItem = (overrides: object = {}) => ({
		id: 'ci-1',
		content_type_id: 'ct-1',
		slug: 'a-claim',
		title: 'A Claim',
		status: 'published',
		fields: '{"claim":"original"}',
		seo_title: null,
		seo_description: null,
		seo_image: null,
		author_id: null,
		published_at: '2026-01-01',
		created_at: '2026-01-01',
		updated_at: '2026-01-01',
		...overrides
	});

	/** existing item, then the content type carrying the lock config */
	const primeDB = (item: object, fields: object[], settings: object = {}) => {
		mockDB.first
			.mockResolvedValueOnce(item)
			.mockResolvedValueOnce({ fields: JSON.stringify(fields), settings: JSON.stringify(settings) })
			.mockResolvedValueOnce(existingItem());
	};

	it('refuses to change a locked field after publishing', async () => {
		const { updateContentItem } = await import('../../src/lib/services/cms.js');
		primeDB(existingItem(), [LOCKED_FIELD]);

		// Asserted by name, not instanceof: vi.resetModules() means the service
		// module holds a different copy of the class than this file would import.
		await expect(
			updateContentItem(mockDB, 'ci-1', { fields: { claim: 'rewritten' } })
		).rejects.toMatchObject({ name: 'LockedContentError' });
	});

	it('allows unlocked fields to change on the same published item', async () => {
		const { updateContentItem } = await import('../../src/lib/services/cms.js');
		primeDB(existingItem({ fields: '{"claim":"original","notes":"a"}' }), [
			LOCKED_FIELD,
			FREE_FIELD
		]);

		const item = await updateContentItem(mockDB, 'ci-1', {
			fields: { claim: 'original', notes: 'b' }
		});
		expect(item).toBeTruthy();
	});

	it('allows a locked field to change before the item has ever been published', async () => {
		const { updateContentItem } = await import('../../src/lib/services/cms.js');
		primeDB(existingItem({ status: 'draft', published_at: null }), [LOCKED_FIELD]);

		const item = await updateContentItem(mockDB, 'ci-1', { fields: { claim: 'rewritten' } });
		expect(item).toBeTruthy();
	});

	it('still refuses once unpublished, because published_at survives', async () => {
		// The laundering path: publish, unpublish, edit, republish.
		const { updateContentItem } = await import('../../src/lib/services/cms.js');
		primeDB(existingItem({ status: 'draft', published_at: '2026-01-01' }), [LOCKED_FIELD]);

		// Asserted by name, not instanceof: vi.resetModules() means the service
		// module holds a different copy of the class than this file would import.
		await expect(
			updateContentItem(mockDB, 'ci-1', { fields: { claim: 'rewritten' } })
		).rejects.toMatchObject({ name: 'LockedContentError' });
	});

	it('refuses a title change when the type locks title and slug', async () => {
		const { updateContentItem } = await import('../../src/lib/services/cms.js');
		primeDB(existingItem(), [], { lockTitleAndSlugAfterPublish: true });

		await expect(updateContentItem(mockDB, 'ci-1', { title: 'Reworded' })).rejects.toMatchObject({
			name: 'LockedContentError',
			message: 'Cannot edit the title after publishing'
		});
	});

	it('refuses a slug change when the type locks title and slug', async () => {
		const { updateContentItem } = await import('../../src/lib/services/cms.js');
		primeDB(existingItem(), [], { lockTitleAndSlugAfterPublish: true });

		await expect(updateContentItem(mockDB, 'ci-1', { slug: 'reworded' })).rejects.toMatchObject({
			name: 'LockedContentError',
			message: 'Cannot edit the slug after publishing'
		});
	});

	it('allows resubmitting the identical title and slug', async () => {
		const { updateContentItem } = await import('../../src/lib/services/cms.js');
		primeDB(existingItem(), [], { lockTitleAndSlugAfterPublish: true });

		const item = await updateContentItem(mockDB, 'ci-1', {
			title: 'A Claim',
			slug: 'a-claim'
		});
		expect(item).toBeTruthy();
	});

	it('leaves title and slug editable when the type does not opt in', async () => {
		const { updateContentItem } = await import('../../src/lib/services/cms.js');
		primeDB(existingItem(), [], {});

		const item = await updateContentItem(mockDB, 'ci-1', { title: 'Reworded' });
		expect(item).toBeTruthy();
	});

	it('does not enforce locks when the content type row is missing', async () => {
		const { updateContentItem } = await import('../../src/lib/services/cms.js');
		mockDB.first
			.mockResolvedValueOnce(existingItem())
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce(existingItem());

		const item = await updateContentItem(mockDB, 'ci-1', { fields: { claim: 'rewritten' } });
		expect(item).toBeTruthy();
	});

	it('keeps the original published_at across a republish', async () => {
		const { updateContentItem } = await import('../../src/lib/services/cms.js');
		primeDB(existingItem({ status: 'draft', published_at: '2026-01-01' }), []);

		await updateContentItem(mockDB, 'ci-1', { status: 'published' });

		// published_at is the 8th bound parameter of the UPDATE
		const bound = mockDB.bind.mock.calls.at(-1);
		expect(bound).toContain('2026-01-01');
	});
});
