/**
 * CMS Service
 *
 * Database operations for the content management system.
 * All functions take a D1Database instance as the first parameter,
 * following the existing service pattern.
 */

import { contentTypeRegistry } from '$lib/cms/registry';
import { LockedContentError } from '$lib/cms/types';
import type {
	ContentFieldDefinition,
	ContentItem,
	ContentItemFilters,
	ContentItemParsed,
	ContentTag,
	ContentTagParsed,
	ContentType,
	ContentTypeParsed,
	ContentTypeSettings,
	CreateContentItemInput,
	CreateContentTypeInput,
	PaginatedResult,
	UpdateContentItemInput,
	UpdateContentTypeInput
} from '$lib/cms/types';
import {
	generateSlug,
	getLockedFieldViolations,
	parseContentItem,
	parseContentTag,
	parseContentType
} from '$lib/cms/utils';
import type { D1Database } from '@cloudflare/workers-types';

interface CommandPaletteContentRow {
	content_type_slug: string;
	content_type_name: string;
	route_prefix: string | null;
	item_id: string;
	item_slug: string;
	item_title: string;
	item_description: string | null;
}

export interface CommandPaletteContentItem {
	id: string;
	label: string;
	description: string;
	href: string;
}

async function resolveValidAuthorId(
	db: D1Database,
	authorId?: string | null
): Promise<string | null> {
	if (!authorId) {
		return null;
	}

	const author = await db
		.prepare('SELECT id FROM users WHERE id = ?')
		.bind(authorId)
		.first<{ id: string }>();
	return author?.id || null;
}

/**
 * Sync content type definitions from the code registry to D1.
 * Inserts new types and updates changed ones. Safe to call on every request.
 */
export async function syncContentTypes(db: D1Database): Promise<void> {
	// Get existing types from DB
	const existing = await db
		.prepare('SELECT id, slug, name, description, fields, settings, icon FROM content_types')
		.all<{
			id: string;
			slug: string;
			name: string;
			description: string | null;
			fields: string;
			settings: string;
			icon: string;
		}>();

	const existingBySlug = new Map((existing.results || []).map((row) => [row.slug, row]));

	const statements: any[] = [];

	for (let i = 0; i < contentTypeRegistry.length; i++) {
		const def = contentTypeRegistry[i];
		const fieldsJson = JSON.stringify(def.fields);
		const settingsJson = JSON.stringify(def.settings);
		const existingType = existingBySlug.get(def.slug);

		if (!existingType) {
			// Insert new type (mark as system)
			const id = crypto.randomUUID();
			statements.push(
				db
					.prepare(
						`INSERT INTO content_types (id, slug, name, description, fields, settings, icon, sort_order, is_system)
						 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`
					)
					.bind(id, def.slug, def.name, def.description, fieldsJson, settingsJson, def.icon, i)
			);
		} else {
			// Update if changed (also ensure is_system = 1)
			const hasChanged =
				existingType.name !== def.name ||
				existingType.description !== def.description ||
				existingType.fields !== fieldsJson ||
				existingType.settings !== settingsJson ||
				existingType.icon !== def.icon;

			if (hasChanged) {
				statements.push(
					db
						.prepare(
							`UPDATE content_types
							 SET name = ?, description = ?, fields = ?, settings = ?, icon = ?, sort_order = ?, is_system = 1, updated_at = CURRENT_TIMESTAMP
							 WHERE slug = ?`
						)
						.bind(def.name, def.description, fieldsJson, settingsJson, def.icon, i, def.slug)
				);
			}
		}
	}

	if (statements.length > 0) {
		await db.batch(statements);
	}
}

/**
 * Get all content types (parsed).
 */
export async function getContentTypes(db: D1Database): Promise<ContentTypeParsed[]> {
	const result = await db
		.prepare('SELECT * FROM content_types ORDER BY sort_order ASC')
		.all<ContentType>();

	return (result.results || []).map(parseContentType);
}

/**
 * Get a content type by slug (parsed).
 */
export async function getContentTypeBySlug(
	db: D1Database,
	slug: string
): Promise<ContentTypeParsed | null> {
	const row = await db
		.prepare('SELECT * FROM content_types WHERE slug = ?')
		.bind(slug)
		.first<ContentType>();

	return row ? parseContentType(row) : null;
}

/**
 * Create a new content item.
 */
export async function createContentItem(
	db: D1Database,
	input: CreateContentItemInput
): Promise<ContentItemParsed | null> {
	// Resolve content type
	const contentType = await db
		.prepare('SELECT * FROM content_types WHERE slug = ?')
		.bind(input.contentTypeSlug)
		.first<ContentType>();

	if (!contentType) {
		return null;
	}

	const id = crypto.randomUUID();
	const slug = input.slug || generateSlug(input.title);
	const status = input.status || 'draft';
	const fieldsJson = JSON.stringify(input.fields);
	const publishedAt = status === 'published' ? new Date().toISOString() : null;
	const showInCommandPalette = input.showInCommandPalette !== false ? 1 : 0;
	const authorId = await resolveValidAuthorId(db, input.authorId);

	// Check slug uniqueness within this content type
	const existingSlug = await db
		.prepare('SELECT id FROM content_items WHERE content_type_id = ? AND slug = ?')
		.bind(contentType.id, slug)
		.first();

	if (existingSlug) {
		// Append a random suffix to make it unique
		const uniqueSlug = `${slug}-${crypto.randomUUID().slice(0, 8)}`;
		const row = await db
			.prepare(
				`INSERT INTO content_items (id, content_type_id, slug, title, status, fields, seo_title, seo_description, seo_image, author_id, show_in_command_palette, published_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
				 RETURNING *`
			)
			.bind(
				id,
				contentType.id,
				uniqueSlug,
				input.title,
				status,
				fieldsJson,
				input.seoTitle || null,
				input.seoDescription || null,
				input.seoImage || null,
				authorId,
				showInCommandPalette,
				publishedAt
			)
			.first<ContentItem>();

		return row ? parseContentItem(row) : null;
	}

	const row = await db
		.prepare(
			`INSERT INTO content_items (id, content_type_id, slug, title, status, fields, seo_title, seo_description, seo_image, author_id, show_in_command_palette, published_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			 RETURNING *`
		)
		.bind(
			id,
			contentType.id,
			slug,
			input.title,
			status,
			fieldsJson,
			input.seoTitle || null,
			input.seoDescription || null,
			input.seoImage || null,
			authorId,
			showInCommandPalette,
			publishedAt
		)
		.first<ContentItem>();

	if (row && input.tagIds && input.tagIds.length > 0) {
		await setItemTags(db, row.id, input.tagIds);
	}

	return row ? parseContentItem(row) : null;
}

/**
 * Get a content item by ID (parsed).
 */
export async function getContentItem(
	db: D1Database,
	id: string
): Promise<ContentItemParsed | null> {
	const row = await db
		.prepare('SELECT * FROM content_items WHERE id = ?')
		.bind(id)
		.first<ContentItem>();

	return row ? parseContentItem(row) : null;
}

/**
 * Get a content item by content type ID and slug (parsed).
 */
export async function getContentItemBySlug(
	db: D1Database,
	contentTypeId: string,
	slug: string
): Promise<ContentItemParsed | null> {
	const row = await db
		.prepare('SELECT * FROM content_items WHERE content_type_id = ? AND slug = ?')
		.bind(contentTypeId, slug)
		.first<ContentItem>();

	return row ? parseContentItem(row) : null;
}

/**
 * List content items for a type with pagination and filtering.
 */
export async function listContentItems(
	db: D1Database,
	contentTypeId: string,
	filters: ContentItemFilters = {}
): Promise<PaginatedResult<ContentItemParsed>> {
	const page = filters.page || 1;
	const pageSize = filters.pageSize || 12;
	const offset = (page - 1) * pageSize;
	const sortBy = filters.sortBy || 'created_at';
	const sortDirection = filters.sortDirection || 'desc';

	// Build WHERE clause
	const conditions: string[] = ['content_type_id = ?'];
	const params: unknown[] = [contentTypeId];

	if (filters.status) {
		conditions.push('status = ?');
		params.push(filters.status);
	}

	if (filters.authorId) {
		conditions.push('author_id = ?');
		params.push(filters.authorId);
	}

	if (filters.search) {
		conditions.push('(title LIKE ? OR slug LIKE ?)');
		const searchTerm = `%${filters.search}%`;
		params.push(searchTerm, searchTerm);
	}

	const whereClause = conditions.join(' AND ');

	// Get total count
	const countResult = await db
		.prepare(`SELECT COUNT(*) as count FROM content_items WHERE ${whereClause}`)
		.bind(...params)
		.first<{ count: number }>();

	const total = countResult?.count || 0;

	// Get items
	// Allowlist the sort column to prevent SQL injection
	const allowedSortColumns = [
		'created_at',
		'updated_at',
		'published_at',
		'title',
		'slug',
		'status'
	];
	const safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'created_at';
	const safeSortDir = sortDirection === 'asc' ? 'ASC' : 'DESC';

	const result = await db
		.prepare(
			`SELECT * FROM content_items WHERE ${whereClause}
			 ORDER BY ${safeSortBy} ${safeSortDir}
			 LIMIT ? OFFSET ?`
		)
		.bind(...params, pageSize, offset)
		.all<ContentItem>();

	const items = (result.results || []).map(parseContentItem);

	return {
		items,
		total,
		page,
		pageSize,
		totalPages: Math.ceil(total / pageSize)
	};
}

/**
 * Update a content item.
 */
export async function updateContentItem(
	db: D1Database,
	id: string,
	input: UpdateContentItemInput,
	actorId?: string
): Promise<ContentItemParsed | null> {
	// Get existing item
	const existing = await db
		.prepare('SELECT * FROM content_items WHERE id = ?')
		.bind(id)
		.first<ContentItem>();

	if (!existing) {
		return null;
	}

	const contentTypeRow = await db
		.prepare('SELECT fields, settings FROM content_types WHERE id = ?')
		.bind(existing.content_type_id)
		.first<{ fields: string; settings: string }>();
	const definitions = contentTypeRow
		? (JSON.parse(contentTypeRow.fields) as ContentFieldDefinition[])
		: [];
	const settings = contentTypeRow
		? (JSON.parse(contentTypeRow.settings) as ContentTypeSettings)
		: {};
	const existingFieldsObj = JSON.parse(existing.fields) as Record<string, unknown>;

	// Locked fields are only enforced once the item has ever been published —
	// keyed on published_at (has it EVER been published), not current status,
	// since an unpublish→edit→republish cycle must not be able to launder them.
	if (existing.published_at !== null) {
		if (input.fields) {
			const violations = getLockedFieldViolations(definitions, existingFieldsObj, input.fields);
			if (violations.length > 0) {
				throw new LockedContentError(
					`Cannot edit locked field(s) after publishing: ${violations.join(', ')}`
				);
			}
		}
		if (settings.lockTitleAndSlugAfterPublish) {
			if (input.title !== undefined && input.title !== existing.title) {
				throw new LockedContentError('Cannot edit the title after publishing');
			}
			if (input.slug !== undefined && input.slug !== existing.slug) {
				throw new LockedContentError('Cannot edit the slug after publishing');
			}
		}
	}

	const title = input.title ?? existing.title;
	const slug = input.slug ?? existing.slug;
	const status = input.status ?? existing.status;
	const fields = input.fields ? JSON.stringify(input.fields) : existing.fields;
	const seoTitle = input.seoTitle !== undefined ? input.seoTitle : existing.seo_title;
	const seoDescription =
		input.seoDescription !== undefined ? input.seoDescription : existing.seo_description;
	const seoImage = input.seoImage !== undefined ? input.seoImage : existing.seo_image;
	const showInCommandPalette =
		input.showInCommandPalette !== undefined
			? input.showInCommandPalette
				? 1
				: 0
			: (existing.show_in_command_palette ?? 1);

	// Set published_at only the first time this item is ever published — keyed
	// on published_at being null so far, not current status. Keying on status
	// meant an unpublish→republish cycle reset the first-publish date, which
	// also reopened every lock above.
	let publishedAt = existing.published_at;
	if (status === 'published' && existing.published_at === null) {
		publishedAt = new Date().toISOString();
	}

	// Resolution-provenance stamping: any field flagged stampProvenanceOnChange
	// that actually changed value bumps resolution_resolved_at/by, regardless
	// of publish-lock state (this is how a resolution status/note gets tracked).
	let resolutionResolvedAt = existing.resolution_resolved_at;
	let resolutionResolvedBy = existing.resolution_resolved_by;
	if (input.fields) {
		const stampFieldNames = definitions.filter((d) => d.stampProvenanceOnChange).map((d) => d.name);
		const changed = stampFieldNames.some(
			(name) => JSON.stringify(existingFieldsObj[name]) !== JSON.stringify(input.fields![name])
		);
		if (changed) {
			resolutionResolvedAt = new Date().toISOString();
			resolutionResolvedBy = actorId ?? null;
		}
	}

	const row = await db
		.prepare(
			`UPDATE content_items
			 SET title = ?, slug = ?, status = ?, fields = ?,
			     seo_title = ?, seo_description = ?, seo_image = ?, show_in_command_palette = ?,
			     published_at = ?, resolution_resolved_at = ?, resolution_resolved_by = ?,
			     updated_at = CURRENT_TIMESTAMP
			 WHERE id = ?
			 RETURNING *`
		)
		.bind(
			title,
			slug,
			status,
			fields,
			seoTitle,
			seoDescription,
			seoImage,
			showInCommandPalette,
			publishedAt,
			resolutionResolvedAt,
			resolutionResolvedBy,
			id
		)
		.first<ContentItem>();

	if (row && input.tagIds) {
		await setItemTags(db, id, input.tagIds);
	}

	return row ? parseContentItem(row) : null;
}

/**
 * Delete a content item.
 */
/**
 * Record an RFC 3161 timestamp-proof attempt (success or failure). Never
 * part of Create/UpdateContentItemInput — only called from the background
 * proof job and the manual retry endpoint, so a generic PUT payload can
 * never spoof proof state.
 */
export async function recordTimestampProofAttempt(
	db: D1Database,
	id: string,
	data: {
		hash: string;
		tsr: string | null;
		requestedAt: string;
		tsaUrl: string | null;
		error: string | null;
	}
): Promise<void> {
	await db
		.prepare(
			`UPDATE content_items
			 SET timestamp_proof_hash = ?, timestamp_proof_tsr = ?, timestamp_proof_requested_at = ?,
			     timestamp_proof_tsa_url = ?, timestamp_proof_error = ?
			 WHERE id = ?`
		)
		.bind(data.hash, data.tsr, data.requestedAt, data.tsaUrl, data.error, id)
		.run();
}

/** Record a discovered Wayback Machine snapshot. Safe to call repeatedly. */
export async function recordWaybackSnapshot(
	db: D1Database,
	id: string,
	data: { url: string; checkedAt: string }
): Promise<void> {
	await db
		.prepare(
			'UPDATE content_items SET wayback_snapshot_url = ?, wayback_checked_at = ? WHERE id = ?'
		)
		.bind(data.url, data.checkedAt, id)
		.run();
}

/**
 * Delete a content item.
 *
 * Throws LockedContentError if the item has ever been published and its
 * content type has timestamp proofs enabled — deleting it would erase the
 * proof/resolution history from the site's own record. Archiving remains
 * available for these items.
 */
export async function deleteContentItem(db: D1Database, id: string): Promise<boolean> {
	const existing = await db
		.prepare(
			`SELECT ci.published_at, ct.settings
			 FROM content_items ci JOIN content_types ct ON ct.id = ci.content_type_id
			 WHERE ci.id = ?`
		)
		.bind(id)
		.first<{ published_at: string | null; settings: string }>();

	if (existing && existing.published_at !== null) {
		const settings = JSON.parse(existing.settings) as ContentTypeSettings;
		if (settings.enableTimestampProof) {
			throw new LockedContentError(
				'Cannot delete a published item once its timestamp proof is enabled — archive it instead'
			);
		}
	}

	const result = await db.prepare('DELETE FROM content_items WHERE id = ?').bind(id).run();

	return (result.meta?.changes || 0) > 0;
}

/**
 * List CMS items that should appear in the global command palette.
 */
export async function getCommandPaletteContentItems(
	db: D1Database,
	limit = 20
): Promise<CommandPaletteContentItem[]> {
	const result = await db
		.prepare(
			`SELECT
				ct.slug AS content_type_slug,
				ct.name AS content_type_name,
				json_extract(ct.settings, '$.routePrefix') AS route_prefix,
				ci.id AS item_id,
				ci.slug AS item_slug,
				ci.title AS item_title,
				COALESCE(NULLIF(ci.seo_description, ''), NULLIF(ct.description, '')) AS item_description
			 FROM content_items ci
			 INNER JOIN content_types ct ON ct.id = ci.content_type_id
			 WHERE ci.status = 'published'
			   AND COALESCE(ci.show_in_command_palette, 1) = 1
			   AND COALESCE(json_extract(ct.settings, '$.showInCommandPalette'), 1) = 1
			 ORDER BY COALESCE(ci.published_at, ci.created_at) DESC, ci.updated_at DESC
			 LIMIT ?`
		)
		.bind(limit)
		.all<CommandPaletteContentRow>();

	return (result.results || []).map((row) => {
		const routePrefix = row.route_prefix || `/${row.content_type_slug}`;
		const descriptionSuffix = row.item_description ? `: ${row.item_description}` : '';

		return {
			id: `cms-${row.item_id}`,
			label: row.item_title,
			description: `${row.content_type_name}${descriptionSuffix}`,
			href: `${routePrefix}/${row.item_slug}`
		};
	});
}

/**
 * Create a content tag for a content type.
 */
export async function createContentTag(
	db: D1Database,
	contentTypeId: string,
	name: string
): Promise<ContentTagParsed | null> {
	const id = crypto.randomUUID();
	const slug = generateSlug(name);

	const row = await db
		.prepare(
			`INSERT INTO content_tags (id, content_type_id, name, slug)
			 VALUES (?, ?, ?, ?)
			 RETURNING *`
		)
		.bind(id, contentTypeId, name, slug)
		.first<ContentTag>();

	return row ? parseContentTag(row) : null;
}

/**
 * Get all tags for a content type.
 */
export async function getTagsForType(
	db: D1Database,
	contentTypeId: string
): Promise<ContentTagParsed[]> {
	const result = await db
		.prepare('SELECT * FROM content_tags WHERE content_type_id = ? ORDER BY name ASC')
		.bind(contentTypeId)
		.all<ContentTag>();

	return (result.results || []).map(parseContentTag);
}

/**
 * Delete a content tag.
 */
export async function deleteContentTag(db: D1Database, tagId: string): Promise<boolean> {
	const result = await db.prepare('DELETE FROM content_tags WHERE id = ?').bind(tagId).run();

	return (result.meta?.changes || 0) > 0;
}

/**
 * Set tags for a content item (replaces existing).
 */
export async function setItemTags(db: D1Database, itemId: string, tagIds: string[]): Promise<void> {
	const statements: any[] = [
		db.prepare('DELETE FROM content_item_tags WHERE content_item_id = ?').bind(itemId)
	];

	for (const tagId of tagIds) {
		statements.push(
			db
				.prepare('INSERT INTO content_item_tags (content_item_id, content_tag_id) VALUES (?, ?)')
				.bind(itemId, tagId)
		);
	}

	await db.batch(statements);
}

/**
 * Get tags for a content item.
 */
export async function getItemTags(db: D1Database, itemId: string): Promise<ContentTagParsed[]> {
	const result = await db
		.prepare(
			`SELECT ct.* FROM content_tags ct
			 INNER JOIN content_item_tags cit ON ct.id = cit.content_tag_id
			 WHERE cit.content_item_id = ?
			 ORDER BY ct.name ASC`
		)
		.bind(itemId)
		.all<ContentTag>();

	return (result.results || []).map(parseContentTag);
}

// ─── Content Type Management (CRUD) ───────────────────────────────────────────

/**
 * Get a content type by ID (parsed).
 */
export async function getContentTypeById(
	db: D1Database,
	id: string
): Promise<ContentTypeParsed | null> {
	const row = await db
		.prepare('SELECT * FROM content_types WHERE id = ?')
		.bind(id)
		.first<ContentType>();

	return row ? parseContentType(row) : null;
}

/**
 * Get all content type slugs from DB (includes both system and user-created).
 */
export async function getAllContentTypeSlugs(db: D1Database): Promise<string[]> {
	const result = await db
		.prepare('SELECT slug FROM content_types ORDER BY sort_order ASC')
		.all<{ slug: string }>();

	return (result.results || []).map((row) => row.slug);
}

/**
 * Check if a slug exists in the DB content types.
 */
export async function isContentTypeSlug(db: D1Database, slug: string): Promise<boolean> {
	const row = await db
		.prepare('SELECT id FROM content_types WHERE slug = ?')
		.bind(slug)
		.first<{ id: string }>();

	return row !== null;
}

/**
 * Create a new content type (user-created, not system).
 */
export async function createContentTypeInDB(
	db: D1Database,
	input: CreateContentTypeInput
): Promise<ContentTypeParsed | null> {
	const slug = input.slug || generateSlug(input.name);

	// Check if slug already exists
	const existing = await db
		.prepare('SELECT id FROM content_types WHERE slug = ?')
		.bind(slug)
		.first<{ id: string }>();

	if (existing) {
		return null; // Slug already taken
	}

	const id = crypto.randomUUID();
	const fieldsJson = JSON.stringify(input.fields || []);
	const settingsJson = JSON.stringify(input.settings || {});
	const icon = input.icon || 'document';

	// Get next sort_order
	const maxOrder = await db
		.prepare('SELECT MAX(sort_order) as max_order FROM content_types')
		.first<{ max_order: number | null }>();
	const sortOrder = (maxOrder?.max_order ?? -1) + 1;

	const row = await db
		.prepare(
			`INSERT INTO content_types (id, slug, name, description, fields, settings, icon, sort_order, is_system)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
			 RETURNING *`
		)
		.bind(
			id,
			slug,
			input.name,
			input.description || null,
			fieldsJson,
			settingsJson,
			icon,
			sortOrder
		)
		.first<ContentType>();

	return row ? parseContentType(row) : null;
}

/**
 * Update a content type.
 */
export async function updateContentTypeInDB(
	db: D1Database,
	id: string,
	input: UpdateContentTypeInput
): Promise<ContentTypeParsed | null> {
	// Build SET clause dynamically based on provided fields
	const setClauses: string[] = [];
	const params: unknown[] = [];

	if (input.name !== undefined) {
		setClauses.push('name = ?');
		params.push(input.name);
	}
	if (input.slug !== undefined) {
		setClauses.push('slug = ?');
		params.push(input.slug);
	}
	if (input.description !== undefined) {
		setClauses.push('description = ?');
		params.push(input.description);
	}
	if (input.icon !== undefined) {
		setClauses.push('icon = ?');
		params.push(input.icon);
	}
	if (input.fields !== undefined) {
		setClauses.push('fields = ?');
		params.push(JSON.stringify(input.fields));
	}
	if (input.settings !== undefined) {
		setClauses.push('settings = ?');
		params.push(JSON.stringify(input.settings));
	}

	if (setClauses.length === 0) {
		// Nothing to update, just return current
		return getContentTypeById(db, id);
	}

	setClauses.push('updated_at = CURRENT_TIMESTAMP');
	params.push(id);

	const row = await db
		.prepare(`UPDATE content_types SET ${setClauses.join(', ')} WHERE id = ? RETURNING *`)
		.bind(...params)
		.first<ContentType>();

	return row ? parseContentType(row) : null;
}

/**
 * Delete a content type (only non-system types).
 */
export async function deleteContentTypeFromDB(
	db: D1Database,
	id: string
): Promise<{ success: boolean; reason?: string }> {
	// Check if the type exists and whether it's a system type
	const existing = await db
		.prepare('SELECT id, is_system FROM content_types WHERE id = ?')
		.bind(id)
		.first<{ id: string; is_system: number }>();

	if (!existing) {
		return { success: false, reason: 'Content type not found' };
	}

	if (existing.is_system === 1) {
		return { success: false, reason: 'Cannot delete system content type' };
	}

	// Delete the type (cascade will handle items and tags)
	await db.prepare('DELETE FROM content_types WHERE id = ?').bind(id).run();

	return { success: true };
}

/** One published, publicly-reachable CMS URL, flattened for sitemap.xml. */
export interface SitemapContentRow {
	/** Content type slug — the first path segment (`/blog/...`). */
	typeSlug: string;
	/** Item slug — the second path segment (`/blog/hello-world`). */
	itemSlug: string;
	/** Best available last-modified timestamp, or null if the row has none. */
	lastmod: string | null;
}

/**
 * Every published content item as a `{typeSlug, itemSlug, lastmod}` row, for
 * sitemap.xml.
 *
 * One JOIN rather than a query per content type: a sitemap is regenerated on
 * every crawler hit, and fanning out across N types would put N round-trips on
 * a request that has no user waiting behind it but still bills D1 reads.
 *
 * Only `status = 'published'` is returned — the public `[contentType]` routes
 * filter the same way, so drafts and archived items never leak into the index.
 *
 * @param limit Hard cap on rows. The sitemap protocol allows 50,000 URLs per
 *   file; the default leaves generous headroom under that ceiling while keeping
 *   the response small enough to build in a Worker without streaming.
 */
export async function listPublishedContentForSitemap(
	db: D1Database,
	limit = 10000
): Promise<SitemapContentRow[]> {
	const result = await db
		.prepare(
			`SELECT t.slug AS type_slug,
			        i.slug AS item_slug,
			        COALESCE(i.updated_at, i.published_at, i.created_at) AS lastmod
			 FROM content_items i
			 JOIN content_types t ON t.id = i.content_type_id
			 WHERE i.status = 'published'
			 ORDER BY lastmod DESC
			 LIMIT ?`
		)
		.bind(limit)
		.all<{ type_slug: string; item_slug: string; lastmod: string | null }>();

	return (result.results || []).map((row) => ({
		typeSlug: row.type_slug,
		itemSlug: row.item_slug,
		lastmod: row.lastmod
	}));
}
