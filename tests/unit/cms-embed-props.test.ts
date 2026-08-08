/**
 * Tests for typed embed props helpers ($lib/cms/embeds/props-schema)
 */
import { describe, expect, it } from 'vitest';

import {
	buildFormModel,
	coercePropValue,
	coerceProps,
	defaultForField,
	defaultPropsFromSchema,
	defineEmbed,
	validateProps,
	type EmbedPropField,
	type EmbedPropsSchema
} from '../../src/lib/cms/embeds/props-schema';

const schema: EmbedPropsSchema = [
	{ key: 'title', label: 'Title', type: 'string', default: 'Note' },
	{ key: 'count', label: 'Count', type: 'number', default: 3 },
	{ key: 'open', label: 'Open', type: 'boolean', default: false },
	{
		key: 'variant',
		label: 'Variant',
		type: 'select',
		default: 'info',
		options: [
			{ label: 'Info', value: 'info' },
			{ label: 'Warning', value: 'warning' }
		]
	}
];

describe('defaultForField', () => {
	it('uses the explicit default when present', () => {
		expect(defaultForField({ key: 'a', label: 'A', type: 'string', default: 'x' })).toBe('x');
		expect(defaultForField({ key: 'a', label: 'A', type: 'number', default: 0 })).toBe(0);
		expect(defaultForField({ key: 'a', label: 'A', type: 'boolean', default: false })).toBe(false);
	});

	it('falls back to per-type zero values', () => {
		expect(defaultForField({ key: 'a', label: 'A', type: 'string' })).toBe('');
		expect(defaultForField({ key: 'a', label: 'A', type: 'number' })).toBe(0);
		expect(defaultForField({ key: 'a', label: 'A', type: 'boolean' })).toBe(false);
		expect(
			defaultForField({
				key: 'a',
				label: 'A',
				type: 'select',
				options: [{ label: 'One', value: 'one' }]
			})
		).toBe('one');
		expect(defaultForField({ key: 'a', label: 'A', type: 'select' })).toBe('');
	});
});

describe('defaultPropsFromSchema', () => {
	it('builds a full defaults object', () => {
		expect(defaultPropsFromSchema(schema)).toEqual({
			title: 'Note',
			count: 3,
			open: false,
			variant: 'info'
		});
	});
});

describe('coercePropValue', () => {
	const num: EmbedPropField = { key: 'n', label: 'N', type: 'number', default: 7 };
	const bool: EmbedPropField = { key: 'b', label: 'B', type: 'boolean' };
	const sel: EmbedPropField = {
		key: 's',
		label: 'S',
		type: 'select',
		default: 'info',
		options: [
			{ label: 'Info', value: 'info' },
			{ label: 'Warning', value: 'warning' }
		]
	};

	it('coerces strings', () => {
		const f: EmbedPropField = { key: 't', label: 'T', type: 'string' };
		expect(coercePropValue(f, 42)).toBe('42');
		expect(coercePropValue(f, null)).toBe('');
		expect(coercePropValue(f, undefined)).toBe('');
	});

	it('coerces numbers, falling back to the default for junk', () => {
		expect(coercePropValue(num, '12')).toBe(12);
		expect(coercePropValue(num, 5)).toBe(5);
		expect(coercePropValue(num, 'abc')).toBe(7);
		expect(coercePropValue(num, NaN)).toBe(7);
	});

	it('coerces booleans from checkbox-ish values', () => {
		expect(coercePropValue(bool, true)).toBe(true);
		expect(coercePropValue(bool, 'true')).toBe(true);
		expect(coercePropValue(bool, 'on')).toBe(true);
		expect(coercePropValue(bool, 1)).toBe(true);
		expect(coercePropValue(bool, false)).toBe(false);
		expect(coercePropValue(bool, 'nope')).toBe(false);
	});

	it('constrains selects to allowed options', () => {
		expect(coercePropValue(sel, 'warning')).toBe('warning');
		expect(coercePropValue(sel, 'bogus')).toBe('info');
		expect(coercePropValue(sel, null)).toBe('info');
		expect(coercePropValue({ ...sel, options: undefined }, 'x')).toBe('info');
	});
});

describe('coerceProps', () => {
	it('produces one coerced entry per schema field', () => {
		expect(coerceProps(schema, { title: 5, count: '9', open: 'on', variant: 'warning' })).toEqual({
			title: '5',
			count: 9,
			open: true,
			variant: 'warning'
		});
	});

	it('fills missing keys from defaults', () => {
		expect(coerceProps(schema, {})).toEqual(defaultPropsFromSchema(schema));
	});
});

describe('buildFormModel', () => {
	it('coerces stored values and fills gaps with defaults', () => {
		expect(buildFormModel(schema, { count: '10' })).toEqual({
			title: 'Note',
			count: 10,
			open: false,
			variant: 'info'
		});
	});
});

describe('validateProps', () => {
	it('flags non-finite numbers and out-of-range selects', () => {
		const errors = validateProps(schema, { count: Number.NaN, variant: 'bogus' });
		expect(errors).toHaveLength(2);
		expect(errors.join(' ')).toContain('Count');
		expect(errors.join(' ')).toContain('Variant');
	});

	it('passes valid props and ignores undefined values', () => {
		expect(validateProps(schema, { count: 3, variant: 'info' })).toEqual([]);
		expect(validateProps(schema, {})).toEqual([]);
	});
});

describe('defineEmbed', () => {
	it('derives defaultProps from the schema when omitted', () => {
		const def = defineEmbed({
			name: 'demo',
			label: 'Demo',
			description: 'd',
			props: schema
		});
		expect(def.defaultProps).toEqual(defaultPropsFromSchema(schema));
		expect(def.props).toBe(schema);
	});

	it('respects an explicit defaultProps', () => {
		const def = defineEmbed({
			name: 'demo',
			label: 'Demo',
			description: 'd',
			props: schema,
			defaultProps: { title: 'Custom' }
		});
		expect(def.defaultProps).toEqual({ title: 'Custom' });
	});

	it('defaults to empty props for a schema-less embed', () => {
		const def = defineEmbed({ name: 'x', label: 'X', description: 'd' });
		expect(def.defaultProps).toEqual({});
		expect(def.props).toBeUndefined();
	});
});
