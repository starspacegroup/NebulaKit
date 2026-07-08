/**
 * Media upload validation and key helpers (pure, unit-testable).
 * Images only — SVG is deliberately excluded (stored-XSS vector when
 * served inline).
 */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
	'image/png': 'png',
	'image/jpeg': 'jpg',
	'image/gif': 'gif',
	'image/webp': 'webp'
};

export type UploadValidation = { ok: true; ext: string } | { ok: false; error: string };

export function validateUpload(input: { type: string; size: number }): UploadValidation {
	const ext = ALLOWED_IMAGE_TYPES[input.type];
	if (!ext) {
		return {
			ok: false,
			error: `Unsupported file type "${input.type}" — allowed: png, jpeg, gif, webp`
		};
	}
	if (!Number.isFinite(input.size) || input.size <= 0) {
		return { ok: false, error: 'Empty upload' };
	}
	if (input.size > MAX_UPLOAD_BYTES) {
		return {
			ok: false,
			error: `File too large (${Math.round(input.size / 1024 / 1024)} MB) — max 10 MB`
		};
	}
	return { ok: true, ext };
}

/** R2 object key for an upload */
export function buildMediaKey(ext: string, uuid: string): string {
	return `uploads/${uuid}.${ext}`;
}

/** Public URL for an R2 media key */
export function mediaUrlForKey(key: string): string {
	return `/media/${key}`;
}

/** Guard for the media-serving route: only uploads/, no traversal */
export function isValidMediaKey(key: string): boolean {
	return (
		key.startsWith('uploads/') &&
		!key.includes('..') &&
		!key.includes('//') &&
		/^[a-zA-Z0-9/_.-]+$/.test(key)
	);
}
