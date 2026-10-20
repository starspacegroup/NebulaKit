/** File manager: kinds and icons by extension, folder paths, names, sizes and the upload queue. */

export interface FileEntry {
	id: string;
	name: string;
	type: 'file' | 'folder';
	parentId: string | null;
	/** Bytes. Folders have none. */
	size?: number;
	modifiedAt?: string;
}

export type FileKind =
	| 'folder'
	| 'image'
	| 'video'
	| 'audio'
	| 'pdf'
	| 'document'
	| 'spreadsheet'
	| 'presentation'
	| 'archive'
	| 'code'
	| 'text'
	| 'other';

const EXTENSIONS: Record<Exclude<FileKind, 'folder' | 'other'>, string[]> = {
	image: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif', 'bmp', 'ico', 'heic'],
	video: ['mp4', 'mov', 'webm', 'mkv', 'avi', 'm4v'],
	audio: ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'],
	pdf: ['pdf'],
	document: ['doc', 'docx', 'odt', 'rtf', 'pages'],
	spreadsheet: ['xls', 'xlsx', 'csv', 'ods', 'numbers', 'tsv'],
	presentation: ['ppt', 'pptx', 'odp', 'key'],
	archive: ['zip', 'tar', 'gz', 'tgz', '7z', 'rar', 'bz2'],
	code: [
		'js',
		'ts',
		'jsx',
		'tsx',
		'svelte',
		'json',
		'html',
		'css',
		'py',
		'rb',
		'go',
		'rs',
		'sh',
		'yaml',
		'yml',
		'sql'
	],
	text: ['txt', 'md', 'log']
};

/** Lower-case extension without the dot; empty for none ("Makefile", ".env", "name."). */
export function fileExtension(name: string): string {
	const dot = name.lastIndexOf('.');
	return dot <= 0 || dot === name.length - 1 ? '' : name.slice(dot + 1).toLowerCase();
}

export function fileKind(entry: Pick<FileEntry, 'name' | 'type'>): FileKind {
	if (entry.type === 'folder') return 'folder';
	const ext = fileExtension(entry.name);
	for (const [kind, list] of Object.entries(EXTENSIONS)) {
		if (list.includes(ext)) return kind as FileKind;
	}
	return 'other';
}

const ICONS: Record<FileKind, string> = {
	folder: '📁',
	image: '🖼️',
	video: '🎞️',
	audio: '🎵',
	pdf: '📕',
	document: '📄',
	spreadsheet: '📊',
	presentation: '📽️',
	archive: '🗜️',
	code: '🧩',
	text: '📝',
	other: '📎'
};

export function fileIcon(kind: FileKind): string {
	return ICONS[kind];
}

const KIND_LABELS: Record<FileKind, string> = {
	folder: 'Folder',
	image: 'Image',
	video: 'Video',
	audio: 'Audio',
	pdf: 'PDF',
	document: 'Document',
	spreadsheet: 'Spreadsheet',
	presentation: 'Presentation',
	archive: 'Archive',
	code: 'Code',
	text: 'Text',
	other: 'File'
};

export function kindLabel(kind: FileKind): string {
	return KIND_LABELS[kind];
}

/** "1.5 MB", "820 B". Decimal units, one decimal place from KB up. */
export function formatFileSize(bytes: number | undefined, locale = 'en-US'): string {
	if (bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return '';
	if (bytes < 1000) return `${bytes} B`;
	const units = ['KB', 'MB', 'GB', 'TB'];
	let value = bytes;
	let unit = -1;
	while (value >= 1000 && unit < units.length - 1) {
		value /= 1000;
		unit++;
	}
	const text = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);
	return `${text} ${units[unit]}`;
}

/** The folders from the root down to `folderId`; the root itself is not included. */
export function breadcrumbPath(
	entries: readonly FileEntry[],
	folderId: string | null
): FileEntry[] {
	const path: FileEntry[] = [];
	const seen = new Set<string>();
	let cursor = folderId ? entries.find((e) => e.id === folderId) : undefined;
	while (cursor && !seen.has(cursor.id)) {
		seen.add(cursor.id);
		path.unshift(cursor);
		cursor = cursor.parentId ? entries.find((e) => e.id === cursor?.parentId) : undefined;
	}
	return path;
}

export type FileSortKey = 'name' | 'size' | 'modified';

/** What is in a folder: folders first, then files, each ordered by the chosen key. */
export function childrenOf(
	entries: readonly FileEntry[],
	folderId: string | null,
	sort: { key: FileSortKey; direction: 'ascending' | 'descending' } = {
		key: 'name',
		direction: 'ascending'
	}
): FileEntry[] {
	const sign = sort.direction === 'ascending' ? 1 : -1;
	const value = (e: FileEntry): number | string =>
		sort.key === 'size'
			? (e.size ?? 0)
			: sort.key === 'modified'
				? Date.parse(e.modifiedAt ?? '') || 0
				: e.name;
	return entries
		.filter((e) => e.parentId === folderId)
		.sort((a, b) => {
			if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
			const x = value(a);
			const y = value(b);
			const order =
				typeof x === 'number' && typeof y === 'number'
					? x - y
					: String(x).localeCompare(String(y), undefined, { numeric: true });
			return order * sign || a.name.localeCompare(b.name);
		});
}

export const FILE_NAME_MESSAGES = {
	empty: 'Enter a name.',
	slash: 'A name cannot contain / or \\.',
	dots: 'A name cannot be only dots.',
	long: 'That name is too long.',
	taken: 'Something with that name is already here.'
};

/** An error message for a proposed name, or an empty string when it is fine. */
export function validateFileName(
	name: string,
	siblings: readonly FileEntry[],
	selfId?: string,
	messages = FILE_NAME_MESSAGES
): string {
	const clean = name.trim();
	if (!clean) return messages.empty;
	if (/[/\\]/.test(clean)) return messages.slash;
	if (/^\.+$/.test(clean)) return messages.dots;
	if (clean.length > 255) return messages.long;
	const taken = siblings.some(
		(s) => s.id !== selfId && s.name.toLocaleLowerCase() === clean.toLocaleLowerCase()
	);
	return taken ? messages.taken : '';
}

export function renameEntry(entries: readonly FileEntry[], id: string, name: string): FileEntry[] {
	return entries.map((e) => (e.id === id ? { ...e, name: name.trim() } : e));
}

/** Ids of an entry and everything beneath it. */
export function withDescendants(entries: readonly FileEntry[], ids: readonly string[]): string[] {
	const out = new Set(ids);
	let grew = true;
	while (grew) {
		grew = false;
		for (const e of entries) {
			if (e.parentId && out.has(e.parentId) && !out.has(e.id)) {
				out.add(e.id);
				grew = true;
			}
		}
	}
	return [...out];
}

export function deleteEntries(entries: readonly FileEntry[], ids: readonly string[]): FileEntry[] {
	const gone = new Set(withDescendants(entries, ids));
	return entries.filter((e) => !gone.has(e.id));
}

/** "Delete 3 items?" wording for the confirm dialog. */
export function deleteSummary(entries: readonly FileEntry[], ids: readonly string[]): string {
	const picked = entries.filter((e) => ids.includes(e.id));
	if (picked.length === 1) return `"${picked[0].name}"`;
	return `${picked.length} items`;
}

/* ----------------------------------------------------------- upload queue */

export type UploadStatus = 'queued' | 'uploading' | 'done' | 'error' | 'cancelled';

export interface UploadJob {
	id: string;
	name: string;
	size: number;
	/** 0–100. */
	progress: number;
	status: UploadStatus;
	error?: string;
}

/** Jobs for a batch of files; ones over `maxBytes` start out failed with a reason. */
export function enqueueUploads(
	queue: readonly UploadJob[],
	files: readonly { name: string; size: number }[],
	makeId: (name: string, index: number) => string,
	maxBytes = Infinity
): UploadJob[] {
	const jobs = files.map<UploadJob>((f, i) =>
		f.size > maxBytes
			? {
					id: makeId(f.name, i),
					name: f.name,
					size: f.size,
					progress: 0,
					status: 'error',
					error: `Larger than ${formatFileSize(maxBytes)}.`
				}
			: { id: makeId(f.name, i), name: f.name, size: f.size, progress: 0, status: 'queued' }
	);
	return [...queue, ...jobs];
}

export function setUploadProgress(
	queue: readonly UploadJob[],
	id: string,
	progress: number
): UploadJob[] {
	const value = Math.max(0, Math.min(100, Number.isFinite(progress) ? progress : 0));
	return queue.map((j) => {
		if (j.id !== id || j.status === 'cancelled' || j.status === 'error') return j;
		return { ...j, progress: value, status: value >= 100 ? 'done' : 'uploading' };
	});
}

export function cancelUpload(queue: readonly UploadJob[], id: string): UploadJob[] {
	return queue.map((j) =>
		j.id === id && (j.status === 'queued' || j.status === 'uploading')
			? { ...j, status: 'cancelled' }
			: j
	);
}

export function failUpload(queue: readonly UploadJob[], id: string, error: string): UploadJob[] {
	return queue.map((j) =>
		j.id === id && j.status !== 'done' ? { ...j, status: 'error', error } : j
	);
}

export function clearFinishedUploads(queue: readonly UploadJob[]): UploadJob[] {
	return queue.filter((j) => j.status === 'queued' || j.status === 'uploading');
}

export function isUploadActive(job: UploadJob): boolean {
	return job.status === 'queued' || job.status === 'uploading';
}

/** "2 of 3 uploaded", "Uploading 1 file", "All uploads finished". */
export function queueSummary(queue: readonly UploadJob[]): string {
	if (queue.length === 0) return '';
	const active = queue.filter(isUploadActive).length;
	const done = queue.filter((j) => j.status === 'done').length;
	if (active > 0) return `${done} of ${queue.length} uploaded`;
	const failed = queue.filter((j) => j.status === 'error').length;
	return failed > 0 ? `${done} uploaded, ${failed} failed` : 'All uploads finished';
}

/** The modified date alone ("Oct 13, 2026"), or an empty string when there is none. */
export function formatModified(
	iso: string | undefined,
	locale = 'en-US',
	timeZone = 'UTC'
): string {
	if (!iso || Number.isNaN(Date.parse(iso))) return '';
	return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone }).format(new Date(iso));
}

/** "3 items", "1 item", "Empty". */
export function folderSummary(count: number): string {
	if (count === 0) return 'Empty';
	return `${count} ${count === 1 ? 'item' : 'items'}`;
}
