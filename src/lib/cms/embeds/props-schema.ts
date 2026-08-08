/**
 * Typed embed props.
 *
 * An embed can declare a `props` schema — a small, framework-free descriptor of
 * its editable fields. The editor uses it to auto-generate a props form (no more
 * hand-editing JSON), and these pure helpers coerce/validate the values. Kept
 * free of Svelte and DOM imports so it runs in Workers, Vitest, and the browser.
 */

export type EmbedPropType = 'string' | 'number' | 'boolean' | 'select';

export interface EmbedSelectOption {
	label: string;
	value: string;
}

export interface EmbedPropField {
	/** Prop key written into the embed's `data-props` object */
	key: string;
	/** Human label shown in the editor form */
	label: string;
	type: EmbedPropType;
	/** Default value; falls back to a per-type zero value when omitted */
	default?: unknown;
	/** Options for `select` fields */
	options?: EmbedSelectOption[];
	placeholder?: string;
	helpText?: string;
}

export type EmbedPropsSchema = EmbedPropField[];

export interface EmbedDefinition {
	/** Stable kebab-case id, also the value stored in data-svelte-embed */
	name: string;
	label: string;
	description: string;
	/** Optional typed schema; when present the editor renders a form for it */
	props?: EmbedPropsSchema;
	/** Concrete default props used when inserting a fresh embed */
	defaultProps: Record<string, unknown>;
}

/** The per-type zero value used when a field declares no explicit default */
function zeroValue(field: EmbedPropField): unknown {
	switch (field.type) {
		case 'number':
			return 0;
		case 'boolean':
			return false;
		case 'select':
			return field.options?.[0]?.value ?? '';
		case 'string':
		default:
			return '';
	}
}

/** The resolved default for a single field (explicit default, else zero value) */
export function defaultForField(field: EmbedPropField): unknown {
	return field.default !== undefined ? field.default : zeroValue(field);
}

/** Build a full default props object from a schema */
export function defaultPropsFromSchema(schema: EmbedPropsSchema): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	for (const field of schema) {
		result[field.key] = defaultForField(field);
	}
	return result;
}

/** Coerce one raw value to a field's declared type */
export function coercePropValue(field: EmbedPropField, raw: unknown): unknown {
	switch (field.type) {
		case 'number': {
			const n = typeof raw === 'number' ? raw : Number(raw);
			return Number.isFinite(n) ? n : defaultForField(field);
		}
		case 'boolean':
			return raw === true || raw === 'true' || raw === 'on' || raw === 1;
		case 'select': {
			const value = raw == null ? '' : String(raw);
			const allowed = field.options?.some((o) => o.value === value);
			return allowed ? value : defaultForField(field);
		}
		case 'string':
		default:
			// A missing value falls back to the default; an explicit '' is kept.
			return raw == null ? defaultForField(field) : String(raw);
	}
}

/** Coerce a raw props object to a typed props object, one entry per schema field */
export function coerceProps(
	schema: EmbedPropsSchema,
	raw: Record<string, unknown>
): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	for (const field of schema) {
		result[field.key] = coercePropValue(field, raw?.[field.key]);
	}
	return result;
}

/**
 * Build the editor form model for an embed: every schema key present, stored
 * values coerced in, missing keys filled from defaults.
 */
export function buildFormModel(
	schema: EmbedPropsSchema,
	props: Record<string, unknown>
): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	for (const field of schema) {
		result[field.key] =
			props && Object.prototype.hasOwnProperty.call(props, field.key)
				? coercePropValue(field, props[field.key])
				: defaultForField(field);
	}
	return result;
}

/** Validate a props object against a schema; returns human-readable errors */
export function validateProps(schema: EmbedPropsSchema, props: Record<string, unknown>): string[] {
	const errors: string[] = [];
	for (const field of schema) {
		const value = props?.[field.key];
		if (value === undefined) continue;
		if (field.type === 'number' && !Number.isFinite(typeof value === 'number' ? value : NaN)) {
			errors.push(`${field.label} must be a number`);
		}
		if (field.type === 'select') {
			const allowed = field.options?.some((o) => o.value === String(value));
			if (!allowed) errors.push(`${field.label} must be one of the allowed options`);
		}
	}
	return errors;
}

/**
 * Author-facing helper for an embed definition file. Fills `defaultProps` from
 * the `props` schema when not given explicitly, so a new embed is a single
 * declaration with no duplicated defaults.
 */
export function defineEmbed(input: {
	name: string;
	label: string;
	description: string;
	props?: EmbedPropsSchema;
	defaultProps?: Record<string, unknown>;
}): EmbedDefinition {
	const defaultProps =
		input.defaultProps ?? (input.props ? defaultPropsFromSchema(input.props) : {});
	return {
		name: input.name,
		label: input.label,
		description: input.description,
		props: input.props,
		defaultProps
	};
}
