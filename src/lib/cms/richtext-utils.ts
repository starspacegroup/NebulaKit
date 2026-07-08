/**
 * Rich text editor helpers (pure, unit-testable).
 */

/** Extract image Files from a DataTransfer-like object (drop or paste) */
export function extractImageFiles(
	dataTransfer: { files?: ArrayLike<File> } | null | undefined
): File[] {
	const files = dataTransfer?.files;
	if (!files || files.length === 0) {
		return [];
	}
	const images: File[] = [];
	for (let i = 0; i < files.length; i++) {
		const file = files[i];
		if (file && file.type.startsWith('image/')) {
			images.push(file);
		}
	}
	return images;
}

/** Upload one image to the admin upload endpoint; returns its public URL */
export async function uploadImage(
	file: File,
	fetchFn: typeof fetch = fetch
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
	const formData = new FormData();
	formData.append('file', file);

	try {
		const res = await fetchFn('/api/admin/upload', { method: 'POST', body: formData });
		const body = await res.json().catch(() => ({}));
		if (!res.ok) {
			return { ok: false, error: body.message || 'Upload failed' };
		}
		return { ok: true, url: body.url };
	} catch {
		return { ok: false, error: 'Upload failed' };
	}
}
