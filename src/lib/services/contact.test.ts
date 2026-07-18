import { describe, expect, it } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import {
	createContactFormSubmission,
	generateContactSubmissionSlug,
	listContactFormSubmissions,
	countContactFormSubmissions,
	getContactFormSubmission,
	resolveContactFormSubmission
} from './contact';

interface MockHandlers {
	first?: (sql: string, args: unknown[]) => unknown;
	all?: (sql: string, args: unknown[]) => { results: unknown[] };
	run?: (sql: string, args: unknown[]) => unknown;
}

/** Minimal D1 stand-in supporting prepare().bind().first()/all()/run(). */
function makeDb(handlers: MockHandlers, calls: Array<{ sql: string; args: unknown[] }> = []) {
	return {
		prepare(sql: string) {
			let args: unknown[] = [];
			const stmt = {
				bind(...a: unknown[]) {
					args = a;
					return stmt;
				},
				first: async () => {
					calls.push({ sql, args });
					return handlers.first ? handlers.first(sql, args) : undefined;
				},
				all: async () => {
					calls.push({ sql, args });
					return handlers.all ? handlers.all(sql, args) : { results: [] };
				},
				run: async () => {
					calls.push({ sql, args });
					return handlers.run ? handlers.run(sql, args) : { success: true };
				}
			};
			return stmt;
		}
	} as unknown as D1Database;
}

const sampleRow = {
	id: 'id-1',
	slug: 'slug-1',
	name: 'Ada',
	email: 'ada@example.com',
	message: 'Hello there',
	is_resolved: 0,
	created_at: '2026-01-01 00:00:00'
};

describe('generateContactSubmissionSlug', () => {
	it('returns the first slug that is not already taken', async () => {
		const db = makeDb({ first: () => undefined });
		const slug = await generateContactSubmissionSlug(db);
		expect(slug).toHaveLength(9);
	});

	it('throws after exhausting attempts when every slug collides', async () => {
		const db = makeDb({ first: () => ({ id: 'taken' }) });
		await expect(generateContactSubmissionSlug(db)).rejects.toThrow(
			'Failed to generate unique contact form submission slug'
		);
	});
});

describe('createContactFormSubmission', () => {
	it('inserts and maps the returned row to the domain type', async () => {
		const calls: Array<{ sql: string; args: unknown[] }> = [];
		const db = makeDb(
			{
				first: (sql) => {
					if (sql.includes('WHERE slug = ?')) return undefined; // slug is free
					if (sql.startsWith('INSERT')) return sampleRow;
					return undefined;
				}
			},
			calls
		);
		const result = await createContactFormSubmission(db, {
			name: 'Ada',
			email: 'ada@example.com',
			message: 'Hello there'
		});
		expect(result).toEqual({
			id: 'id-1',
			slug: 'slug-1',
			name: 'Ada',
			email: 'ada@example.com',
			message: 'Hello there',
			isResolved: false,
			createdAt: '2026-01-01 00:00:00'
		});
		expect(calls.some((c) => c.sql.includes('INSERT INTO contact_form_submissions'))).toBe(true);
	});

	it('throws when the insert returns no row', async () => {
		const db = makeDb({
			first: (sql) => (sql.startsWith('INSERT') ? null : undefined)
		});
		await expect(
			createContactFormSubmission(db, { name: 'A', email: 'a@b.co', message: 'hello world' })
		).rejects.toThrow('Failed to create contact form submission');
	});
});

describe('listContactFormSubmissions', () => {
	it('maps rows and defaults to all submissions', async () => {
		const calls: Array<{ sql: string; args: unknown[] }> = [];
		const db = makeDb({ all: () => ({ results: [sampleRow] }) }, calls);
		const rows = await listContactFormSubmissions(db);
		expect(rows).toHaveLength(1);
		expect(rows[0].isResolved).toBe(false);
		expect(calls[0].sql).not.toContain('WHERE is_resolved = 0');
		expect(calls[0].args).toEqual([50, 0]);
	});

	it('filters to unresolved and honors limit/offset', async () => {
		const calls: Array<{ sql: string; args: unknown[] }> = [];
		const db = makeDb({ all: () => ({ results: [] }) }, calls);
		await listContactFormSubmissions(db, { limit: 10, offset: 20, unresolvedOnly: true });
		expect(calls[0].sql).toContain('WHERE is_resolved = 0');
		expect(calls[0].args).toEqual([10, 20]);
	});

	it('handles a null results set', async () => {
		const db = makeDb({ all: () => ({ results: null as never }) });
		expect(await listContactFormSubmissions(db)).toEqual([]);
	});
});

describe('countContactFormSubmissions', () => {
	it('returns the count', async () => {
		const db = makeDb({ first: () => ({ count: 7 }) });
		expect(await countContactFormSubmissions(db)).toBe(7);
	});

	it('adds the unresolved filter and defaults to 0', async () => {
		const calls: Array<{ sql: string; args: unknown[] }> = [];
		const db = makeDb({ first: () => undefined }, calls);
		expect(await countContactFormSubmissions(db, { unresolvedOnly: true })).toBe(0);
		expect(calls[0].sql).toContain('WHERE is_resolved = 0');
	});
});

describe('getContactFormSubmission', () => {
	it('maps a found row', async () => {
		const db = makeDb({ first: () => ({ ...sampleRow, is_resolved: 1 }) });
		const row = await getContactFormSubmission(db, 'id-1');
		expect(row?.isResolved).toBe(true);
	});

	it('returns null when not found', async () => {
		const db = makeDb({ first: () => undefined });
		expect(await getContactFormSubmission(db, 'missing')).toBeNull();
	});
});

describe('resolveContactFormSubmission', () => {
	it('runs an UPDATE bound to the id', async () => {
		const calls: Array<{ sql: string; args: unknown[] }> = [];
		const db = makeDb({ run: () => ({ success: true }) }, calls);
		await resolveContactFormSubmission(db, 'id-9');
		expect(calls[0].sql).toContain('UPDATE contact_form_submissions SET is_resolved = 1');
		expect(calls[0].args).toEqual(['id-9']);
	});
});
