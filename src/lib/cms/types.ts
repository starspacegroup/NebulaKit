/**
 * CMS Type Definitions
 *
 * Core types for the content management system. Content types are defined
 * in code via the registry and synced to D1 for querying.
 */

/** Supported field types for content type definitions */
export type ContentFieldType =
	| 'text'
	| 'textarea'
	| 'richtext'
	| 'number'
	| 'boolean'
	| 'date'
	| 'datetime'
	| 'select'
	| 'multiselect'
	| 'image'
	| 'url'
	| 'email'
	| 'json'
	| 'color'
	| 'tasklist';

/** Validation rules for a content field */
export interface ContentFieldValidation {
	min?: number;
	max?: number;
	minLength?: number;
	maxLength?: number;
	pattern?: string;
	message?: string;
}

/** A single field definition within a content type */
export interface ContentFieldDefinition {
	/** Unique key for this field (used in JSON storage) */
	name: string;
	/** Display label */
	label: string;
	/** Field type */
	type: ContentFieldType;
	/** Whether the field is required */
	required?: boolean;
	/** Default value */
	defaultValue?: unknown;
	/** Options for select/multiselect fields */
	options?: { label: string; value: string }[];
	/** Placeholder text for input */
	placeholder?: string;
	/** Validation rules */
	validation?: ContentFieldValidation;
	/** Help text shown below the field */
	helpText?: string;
	/** Display order (lower = first) */
	sortOrder?: number;
	/** Once the item has ever been published, this field can no longer be changed */
	lockedAfterPublish?: boolean;
	/** Group name for visual grouping in forms */
	group?: string;
}

/** Settings for a content type */
export interface ContentTypeSettings {
	/** Support draft/published/archived status (default: true) */
	hasDrafts?: boolean;
	/** Support tagging (default: false) */
	hasTags?: boolean;
	/** Show SEO fields (title, description, image) (default: true) */
	hasSEO?: boolean;
	/** Track author (default: true) */
	hasAuthor?: boolean;
	/** URL prefix for public routes (default: /{slug}) */
	routePrefix?: string;
	/** Items per page on list views (default: 12) */
	listPageSize?: number;
	/** Default sort field (default: 'created_at') */
	defaultSort?: string;
	/** Default sort direction (default: 'desc') */
	defaultSortDirection?: 'asc' | 'desc';
	/** Whether this type is publicly listable (default: true) */
	isPublic?: boolean;
	/** Whether items of this type can appear in the command palette (default: true) */
	showInCommandPalette?: boolean;
	/** Once the item has ever been published, title/slug can no longer be changed */
	lockTitleAndSlugAfterPublish?: boolean;
	/** Archived items of this type still render publicly (grouped as "Archive") instead of 404ing */
	publicArchiveVisible?: boolean;
	/** Template to use for rendering items (default: 'default') */
	listTemplate?: string;
	/** Template to use for rendering single items (default: 'default') */
	itemTemplate?: string;
}

/**
 * Content Type Definition
 *
 * Developers add new content types by creating a definition object
 * and registering it in the content type registry.
 */
export interface ContentTypeDefinition {
	/** URL-friendly unique identifier (e.g., 'blog', 'faq', 'kb') */
	slug: string;
	/** Display name (e.g., 'Blog Posts', 'FAQ', 'Knowledge Base') */
	name: string;
	/** Short description of this content type */
	description: string;
	/** Icon identifier for admin UI */
	icon: string;
	/** Custom field definitions */
	fields: ContentFieldDefinition[];
	/** Content type settings */
	settings: ContentTypeSettings;
}

/** Content type as stored in D1 */
export interface ContentType {
	id: string;
	slug: string;
	name: string;
	description: string | null;
	fields: string; // JSON string of ContentFieldDefinition[]
	settings: string; // JSON string of ContentTypeSettings
	icon: string;
	sort_order: number;
	is_system: number; // 1 = code-defined (from registry), 0 = user-created
	created_at: string;
	updated_at: string;
}

/** Content type with parsed fields (for runtime use) */
export interface ContentTypeParsed {
	id: string;
	slug: string;
	name: string;
	description: string | null;
	fields: ContentFieldDefinition[];
	settings: ContentTypeSettings;
	icon: string;
	sortOrder: number;
	isSystem: boolean;
	createdAt: string;
	updatedAt: string;
}

/** Content item status */
export type ContentItemStatus = 'draft' | 'published' | 'archived';

/** Content item as stored in D1 */
export interface ContentItem {
	id: string;
	content_type_id: string;
	slug: string;
	title: string;
	status: ContentItemStatus;
	fields: string; // JSON string of field values
	seo_title: string | null;
	seo_description: string | null;
	seo_image: string | null;
	author_id: string | null;
	show_in_command_palette?: number;
	published_at: string | null;
	created_at: string;
	updated_at: string;
}

/** Content item with parsed fields (for runtime use) */
export interface ContentItemParsed {
	id: string;
	contentTypeId: string;
	slug: string;
	title: string;
	status: ContentItemStatus;
	fields: Record<string, unknown>;
	seoTitle: string | null;
	seoDescription: string | null;
	seoImage: string | null;
	authorId: string | null;
	showInCommandPalette: boolean;
	publishedAt: string | null;
	createdAt: string;
	updatedAt: string;
}

/** Content tag as stored in D1 */
export interface ContentTag {
	id: string;
	content_type_id: string;
	name: string;
	slug: string;
	created_at: string;
}

/** Tag with parsed fields */
export interface ContentTagParsed {
	id: string;
	contentTypeId: string;
	name: string;
	slug: string;
	createdAt: string;
}

/** Input for creating a content item */
export interface CreateContentItemInput {
	contentTypeSlug: string;
	title: string;
	slug?: string;
	status?: ContentItemStatus;
	fields: Record<string, unknown>;
	seoTitle?: string;
	seoDescription?: string;
	seoImage?: string;
	authorId?: string;
	showInCommandPalette?: boolean;
	tagIds?: string[];
}

/** Input for updating a content item */
export interface UpdateContentItemInput {
	title?: string;
	slug?: string;
	status?: ContentItemStatus;
	fields?: Record<string, unknown>;
	seoTitle?: string;
	seoDescription?: string;
	seoImage?: string;
	showInCommandPalette?: boolean;
	tagIds?: string[];
}

/** Paginated list result */
export interface PaginatedResult<T> {
	items: T[];
	total: number;
	page: number;
	pageSize: number;
	totalPages: number;
}

/** Query filters for listing content items */
export interface ContentItemFilters {
	status?: ContentItemStatus;
	authorId?: string;
	tagSlug?: string;
	search?: string;
	page?: number;
	pageSize?: number;
	sortBy?: string;
	sortDirection?: 'asc' | 'desc';
}

/** Input for creating a content type via admin UI */
export interface CreateContentTypeInput {
	name: string;
	slug?: string;
	description?: string;
	icon?: string;
	fields: ContentFieldDefinition[];
	settings: ContentTypeSettings;
}

/** Input for updating a content type via admin UI */
export interface UpdateContentTypeInput {
	name?: string;
	slug?: string;
	description?: string;
	icon?: string;
	fields?: ContentFieldDefinition[];
	settings?: ContentTypeSettings;
}

/** Thrown when an update would change a field locked after first publish */
export class LockedContentError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'LockedContentError';
	}
}
