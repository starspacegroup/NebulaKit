/**
 * Contact form submissions service.
 *
 * Data operations for the public contact form and the admin review inbox.
 * Follows the kit service pattern: every function takes a `D1Database` first,
 * DB rows are snake_case (`ContactFormSubmissionRow`) and mapped to the
 * camelCase domain type (`ContactFormSubmission`) via `rowToSubmission`.
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { ContactFormSubmission } from '$lib/types';
import type { ContactInput } from '$lib/utils/contact-validation';

/** Raw DB row shape for `contact_form_submissions`. */
interface ContactFormSubmissionRow {
	id: string;
	slug: string;
	name: string;
	email: string;
	message: string;
	is_resolved: number;
	created_at: string;
}

// Unambiguous alphabet (no 0/O/1/I/l) — matches the legacy nanoid(9) slugs.
const SLUG_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
const SLUG_LENGTH = 9;
const SLUG_MAX_ATTEMPTS = 10;

function rowToSubmission(row: ContactFormSubmissionRow): ContactFormSubmission {
	return {
		id: row.id,
		slug: row.slug,
		name: row.name,
		email: row.email,
		message: row.message,
		isResolved: row.is_resolved === 1,
		createdAt: row.created_at
	};
}

function randomSlug(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(SLUG_LENGTH));
	let out = '';
	for (let i = 0; i < SLUG_LENGTH; i++) {
		out += SLUG_ALPHABET[bytes[i] % SLUG_ALPHABET.length];
	}
	return out;
}

/**
 * Generate a slug that isn't already taken. Retries a bounded number of times
 * (collisions are astronomically unlikely at 9 chars) and throws if it somehow
 * can't find a free one.
 */
export async function generateContactSubmissionSlug(db: D1Database): Promise<string> {
	for (let attempt = 0; attempt < SLUG_MAX_ATTEMPTS; attempt++) {
		const slug = randomSlug();
		const existing = await db
			.prepare('SELECT id FROM contact_form_submissions WHERE slug = ?')
			.bind(slug)
			.first<{ id: string }>();
		if (!existing) return slug;
	}
	throw new Error('Failed to generate unique contact form submission slug');
}

/** Insert a new submission. `is_resolved`/`created_at` rely on column defaults. */
export async function createContactFormSubmission(
	db: D1Database,
	input: ContactInput
): Promise<ContactFormSubmission> {
	const id = crypto.randomUUID();
	const slug = await generateContactSubmissionSlug(db);
	const row = await db
		.prepare(
			'INSERT INTO contact_form_submissions (id, slug, name, email, message) VALUES (?, ?, ?, ?, ?) RETURNING *'
		)
		.bind(id, slug, input.name, input.email, input.message)
		.first<ContactFormSubmissionRow>();
	if (!row) throw new Error('Failed to create contact form submission');
	return rowToSubmission(row);
}

export interface ListSubmissionsOptions {
	limit?: number;
	offset?: number;
	unresolvedOnly?: boolean;
}

/** List submissions newest-first, optionally only the unresolved ones. */
export async function listContactFormSubmissions(
	db: D1Database,
	options: ListSubmissionsOptions = {}
): Promise<ContactFormSubmission[]> {
	const { limit = 50, offset = 0, unresolvedOnly = false } = options;
	const where = unresolvedOnly ? 'WHERE is_resolved = 0' : '';
	const result = await db
		.prepare(
			`SELECT * FROM contact_form_submissions ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
		)
		.bind(limit, offset)
		.all<ContactFormSubmissionRow>();
	return (result.results ?? []).map(rowToSubmission);
}

/** Count submissions, optionally only the unresolved ones. */
export async function countContactFormSubmissions(
	db: D1Database,
	options: { unresolvedOnly?: boolean } = {}
): Promise<number> {
	const where = options.unresolvedOnly ? 'WHERE is_resolved = 0' : '';
	const row = await db
		.prepare(`SELECT COUNT(*) as count FROM contact_form_submissions ${where}`)
		.first<{ count: number }>();
	return row?.count ?? 0;
}

/** Fetch a single submission by id, or null if not found. */
export async function getContactFormSubmission(
	db: D1Database,
	id: string
): Promise<ContactFormSubmission | null> {
	const row = await db
		.prepare('SELECT * FROM contact_form_submissions WHERE id = ?')
		.bind(id)
		.first<ContactFormSubmissionRow>();
	return row ? rowToSubmission(row) : null;
}

/** Mark a submission resolved (one-way; there's no un-resolve). */
export async function resolveContactFormSubmission(db: D1Database, id: string): Promise<void> {
	await db
		.prepare('UPDATE contact_form_submissions SET is_resolved = 1 WHERE id = ?')
		.bind(id)
		.run();
}
