/**
 * Write-path hardening: the CMS create/update endpoints must sanitize richtext
 * fields server-side before they reach the storage layer. Services are mocked
 * so we can assert exactly what the route passes down.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createContentItem = vi.fn();
const updateContentItem = vi.fn();
const getContentTypeBySlug = vi.fn();
const getContentItem = vi.fn();
const listContentItems = vi.fn();
const deleteContentItem = vi.fn();

vi.mock('$lib/services/cms', () => ({
	createContentItem: (...args: unknown[]) => createContentItem(...args),
	updateContentItem: (...args: unknown[]) => updateContentItem(...args),
	getContentTypeBySlug: (...args: unknown[]) => getContentTypeBySlug(...args),
	getContentItem: (...args: unknown[]) => getContentItem(...args),
	listContentItems: (...args: unknown[]) => listContentItems(...args),
	deleteContentItem: (...args: unknown[]) => deleteContentItem(...args)
}));

const blogType = {
	id: 'ct-1',
	slug: 'blog',
	name: 'Blog',
	fields: [
		{ name: 'body', label: 'Body', type: 'richtext', required: true, sortOrder: 1 },
		{ name: 'excerpt', label: 'Excerpt', type: 'textarea', sortOrder: 2 }
	],
	settings: {}
};

const mockPlatform = { env: { DB: {} } };
const mockLocals = {
	user: { id: 'user-1', login: 'admin', email: 'a@b.c', isOwner: true, isAdmin: true }
};

const DIRTY = '<p>ok</p><script>alert(1)</script>';
const CLEAN = '<p>ok</p>';

const PUT_URL = new URL('http://localhost/api/cms/blog/ci-1');

beforeEach(() => {
	vi.clearAllMocks();
	getContentTypeBySlug.mockResolvedValue(blogType);
	// The merged PUT reads the prior item before writing, so main's proof job can
	// detect a first publish. Without this the route 404s before sanitizing.
	getContentItem.mockResolvedValue({ id: 'ci-1', slug: 'hello', publishedAt: null, fields: {} });
});

describe('POST /api/cms/[type] sanitizes richtext before storage', () => {
	it('strips scripts from richtext fields, leaves other fields alone', async () => {
		const { POST } = await import('../../src/routes/api/cms/[type]/+server.js');
		createContentItem.mockResolvedValue({ id: 'ci-1', fields: {} });

		const request = new Request('http://localhost/api/cms/blog', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				title: 'Hello',
				fields: { body: DIRTY, excerpt: '<b>raw</b>' }
			})
		});

		await POST({
			platform: mockPlatform,
			locals: mockLocals,
			params: { type: 'blog' },
			request
		} as any);

		expect(createContentItem).toHaveBeenCalledTimes(1);
		const passed = createContentItem.mock.calls[0][1];
		expect(passed.fields.body).toBe(CLEAN);
		// non-richtext fields pass through untouched
		expect(passed.fields.excerpt).toBe('<b>raw</b>');
	});
});

describe('PUT /api/cms/[type]/[id] sanitizes richtext before storage', () => {
	it('strips scripts from richtext fields on update', async () => {
		const { PUT } = await import('../../src/routes/api/cms/[type]/[id]/+server.js');
		updateContentItem.mockResolvedValue({ id: 'ci-1', fields: {} });

		const request = new Request('http://localhost/api/cms/blog/ci-1', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ title: 'Hello', fields: { body: DIRTY } })
		});

		await PUT({
			platform: mockPlatform,
			locals: mockLocals,
			params: { type: 'blog', id: 'ci-1' },
			request,
			url: PUT_URL
		} as any);

		expect(updateContentItem).toHaveBeenCalledTimes(1);
		const passed = updateContentItem.mock.calls[0][2];
		expect(passed.fields.body).toBe(CLEAN);
	});

	// Was 'skips sanitize lookup when no fields are supplied'. The merged route
	// always resolves the content type (main's proof job needs it), so the old
	// "not called" assertion is false by construction. What still matters — and is
	// what the test was really protecting — is that no fields means nothing to sanitize.
	it('passes fields through untouched when none are supplied', async () => {
		const { PUT } = await import('../../src/routes/api/cms/[type]/[id]/+server.js');
		updateContentItem.mockResolvedValue({ id: 'ci-1', fields: {} });

		const request = new Request('http://localhost/api/cms/blog/ci-1', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ title: 'Title only' })
		});

		await PUT({
			platform: mockPlatform,
			locals: mockLocals,
			params: { type: 'blog', id: 'ci-1' },
			request,
			url: PUT_URL
		} as any);

		expect(updateContentItem).toHaveBeenCalledTimes(1);
		expect(updateContentItem.mock.calls[0][2].fields).toBeUndefined();
	});

	// DELIBERATE DEVIATION from "favor cms-v2": that branch let a write through
	// against an unknown content type with its richtext UNSANITIZED. The merged
	// route 404s first. Rejecting the write is strictly safer than storing dirty
	// HTML, and main's proof path needs the type to exist regardless.
	it('rejects the write when the content type is unknown', async () => {
		const { PUT } = await import('../../src/routes/api/cms/[type]/[id]/+server.js');
		getContentTypeBySlug.mockResolvedValue(null);
		updateContentItem.mockResolvedValue({ id: 'ci-1', fields: {} });

		const request = new Request('http://localhost/api/cms/blog/ci-1', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ fields: { body: DIRTY } })
		});

		await expect(
			PUT({
				platform: mockPlatform,
				locals: mockLocals,
				params: { type: 'blog', id: 'ci-1' },
				request,
				url: PUT_URL
			} as any)
		).rejects.toMatchObject({ status: 404 });
		expect(updateContentItem).not.toHaveBeenCalled();
	});
});
