import { describe, expect, it } from 'vitest';
import type {
	ContentFieldDefinition,
	ContentItem,
	ContentTag,
	ContentType
} from '../../src/lib/cms/types';
import {
	generateSlug,
	getDefaultFieldValues,
	parseContentItem,
	parseContentTag,
	parseContentType,
	validateFields
} from '../../src/lib/cms/utils';

describe('CMS Utils', () => {
	describe('generateSlug', () => {
		it('should convert a simple title to a slug', () => {
			expect(generateSlug('Hello World')).toBe('hello-world');
		});

		it('should handle special characters', () => {
			expect(generateSlug('Hello, World! How are you?')).toBe('hello-world-how-are-you');
		});

		it('should collapse multiple spaces and hyphens', () => {
			expect(generateSlug('Hello   World---Test')).toBe('hello-world-test');
		});

		it('should trim leading and trailing hyphens', () => {
			expect(generateSlug('---Hello World---')).toBe('hello-world');
		});

		it('should handle empty strings', () => {
			expect(generateSlug('')).toBe('');
		});

		it('should handle strings with only special characters', () => {
			expect(generateSlug('!@#$%^&*()')).toBe('');
		});

		it('should preserve numbers', () => {
			expect(generateSlug('Top 10 Tips for 2024')).toBe('top-10-tips-for-2024');
		});

		it('should handle unicode by stripping it', () => {
			expect(generateSlug('Café Résumé')).toBe('caf-rsum');
		});
	});

	describe('parseContentType', () => {
		it('should parse a D1 content type row', () => {
			const row: ContentType = {
				id: 'ct-1',
				slug: 'blog',
				name: 'Blog Posts',
				description: 'Blog articles',
				fields: JSON.stringify([{ name: 'body', label: 'Body', type: 'richtext' }]),
				settings: JSON.stringify({ hasDrafts: true }),
				icon: 'article',
				sort_order: 0,
				is_system: 0,
				created_at: '2024-01-01T00:00:00Z',
				updated_at: '2024-01-01T00:00:00Z'
			};

			const parsed = parseContentType(row);
			expect(parsed.id).toBe('ct-1');
			expect(parsed.slug).toBe('blog');
			expect(parsed.name).toBe('Blog Posts');
			expect(parsed.fields).toEqual([{ name: 'body', label: 'Body', type: 'richtext' }]);
			expect(parsed.settings).toEqual({ hasDrafts: true, showInCommandPalette: true });
			expect(parsed.sortOrder).toBe(0);
		});
	});

	describe('parseContentItem', () => {
		it('should parse a D1 content item row', () => {
			const row: ContentItem = {
				id: 'ci-1',
				content_type_id: 'ct-1',
				slug: 'hello-world',
				title: 'Hello World',
				status: 'published',
				fields: JSON.stringify({ body: 'Hello!' }),
				seo_title: 'Hello World - Blog',
				seo_description: 'A greeting',
				seo_image: null,
				author_id: 'user-1',
				published_at: '2024-01-01T00:00:00Z',
				created_at: '2024-01-01T00:00:00Z',
				updated_at: '2024-01-01T00:00:00Z'
			};

			const parsed = parseContentItem(row);
			expect(parsed.id).toBe('ci-1');
			expect(parsed.contentTypeId).toBe('ct-1');
			expect(parsed.slug).toBe('hello-world');
			expect(parsed.status).toBe('published');
			expect(parsed.fields).toEqual({ body: 'Hello!' });
			expect(parsed.seoTitle).toBe('Hello World - Blog');
			expect(parsed.authorId).toBe('user-1');
			expect(parsed.showInCommandPalette).toBe(true);
		});
	});

	describe('parseContentTag', () => {
		it('should parse a D1 content tag row', () => {
			const row: ContentTag = {
				id: 'tag-1',
				content_type_id: 'ct-1',
				name: 'JavaScript',
				slug: 'javascript',
				created_at: '2024-01-01T00:00:00Z'
			};

			const parsed = parseContentTag(row);
			expect(parsed.id).toBe('tag-1');
			expect(parsed.contentTypeId).toBe('ct-1');
			expect(parsed.name).toBe('JavaScript');
			expect(parsed.slug).toBe('javascript');
		});
	});

	describe('validateFields', () => {
		const definitions: ContentFieldDefinition[] = [
			{ name: 'title', label: 'Title', type: 'text', required: true },
			{
				name: 'body',
				label: 'Body',
				type: 'textarea',
				required: true,
				validation: { minLength: 10, maxLength: 5000 }
			},
			{
				name: 'count',
				label: 'Count',
				type: 'number',
				validation: { min: 1, max: 100 }
			},
			{
				name: 'category',
				label: 'Category',
				type: 'select',
				options: [
					{ label: 'News', value: 'news' },
					{ label: 'Tutorial', value: 'tutorial' }
				]
			},
			{ name: 'website', label: 'Website', type: 'url' },
			{ name: 'contact', label: 'Contact', type: 'email' }
		];

		it('should return empty array for valid fields', () => {
			const errors = validateFields(
				{
					title: 'Hello',
					body: 'This is a long enough body text',
					count: 5,
					category: 'news',
					website: 'https://example.com',
					contact: 'test@example.com'
				},
				definitions
			);
			expect(errors).toEqual([]);
		});

		it('should require required fields', () => {
			const errors = validateFields({ body: 'Long enough text here' }, definitions);
			expect(errors).toContain('Title is required');
		});

		it('should validate required fields with empty string', () => {
			const errors = validateFields({ title: '', body: 'Long enough text' }, definitions);
			expect(errors).toContain('Title is required');
		});

		it('should validate text min length', () => {
			const errors = validateFields({ title: 'Hi', body: 'Short' }, definitions);
			expect(errors).toContain('Body must be at least 10 characters');
		});

		it('should validate text max length', () => {
			const errors = validateFields({ title: 'Hi', body: 'a'.repeat(5001) }, definitions);
			expect(errors).toContain('Body must be at most 5000 characters');
		});

		it('should validate number min', () => {
			const errors = validateFields(
				{ title: 'Hi', body: 'Long enough text here', count: 0 },
				definitions
			);
			expect(errors).toContain('Count must be at least 1');
		});

		it('should validate number max', () => {
			const errors = validateFields(
				{ title: 'Hi', body: 'Long enough text here', count: 101 },
				definitions
			);
			expect(errors).toContain('Count must be at most 100');
		});

		it('should validate NaN numbers', () => {
			const errors = validateFields(
				{ title: 'Hi', body: 'Long enough text here', count: 'abc' },
				definitions
			);
			expect(errors).toContain('Count must be a number');
		});

		it('should validate select options', () => {
			const errors = validateFields(
				{ title: 'Hi', body: 'Long enough text here', category: 'invalid' },
				definitions
			);
			expect(errors).toContain('Category has an invalid selection');
		});

		it('should validate URLs', () => {
			const errors = validateFields(
				{ title: 'Hi', body: 'Long enough text here', website: 'not-a-url' },
				definitions
			);
			expect(errors).toContain('Website must be a valid URL');
		});

		it('should validate emails', () => {
			const errors = validateFields(
				{ title: 'Hi', body: 'Long enough text here', contact: 'not-an-email' },
				definitions
			);
			expect(errors).toContain('Contact must be a valid email address');
		});

		it('should skip validation for empty optional fields', () => {
			const errors = validateFields({ title: 'Hi', body: 'Long enough text here' }, definitions);
			// Only count, category, website, contact are optional – no errors for them
			expect(errors).toEqual([]);
		});

		it('should validate multiselect options', () => {
			const multiDefs: ContentFieldDefinition[] = [
				{
					name: 'tags',
					label: 'Tags',
					type: 'multiselect',
					options: [
						{ label: 'A', value: 'a' },
						{ label: 'B', value: 'b' }
					]
				}
			];
			const errors = validateFields({ tags: ['a', 'c'] }, multiDefs);
			expect(errors).toContain('Tags contains an invalid selection: c');
		});

		it('should validate text pattern', () => {
			const patternDefs: ContentFieldDefinition[] = [
				{
					name: 'code',
					label: 'Code',
					type: 'text',
					validation: { pattern: '^[A-Z]{3}$', message: 'Code must be 3 uppercase letters' }
				}
			];
			const errors = validateFields({ code: 'abc' }, patternDefs);
			expect(errors).toContain('Code must be 3 uppercase letters');
		});
	});

	describe('getDefaultFieldValues', () => {
		it('should return defaults from field definitions', () => {
			const definitions: ContentFieldDefinition[] = [
				{ name: 'category', label: 'Category', type: 'select', defaultValue: 'general' },
				{ name: 'body', label: 'Body', type: 'richtext' },
				{ name: 'public', label: 'Public', type: 'boolean', defaultValue: true }
			];

			const defaults = getDefaultFieldValues(definitions);
			expect(defaults).toEqual({ category: 'general', public: true });
		});

		it('should return empty object when no defaults', () => {
			const definitions: ContentFieldDefinition[] = [
				{ name: 'title', label: 'Title', type: 'text' }
			];
			expect(getDefaultFieldValues(definitions)).toEqual({});
		});
	});
});
