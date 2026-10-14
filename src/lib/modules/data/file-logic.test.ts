import { describe, expect, it } from 'vitest';
import {
	breadcrumbPath,
	cancelUpload,
	childrenOf,
	clearFinishedUploads,
	deleteEntries,
	deleteSummary,
	enqueueUploads,
	failUpload,
	fileExtension,
	fileIcon,
	fileKind,
	folderSummary,
	formatModified,
	formatFileSize,
	isUploadActive,
	kindLabel,
	queueSummary,
	renameEntry,
	setUploadProgress,
	validateFileName,
	withDescendants,
	type FileEntry,
	type UploadJob
} from './file-logic';

const f = (
	id: string,
	name: string,
	parentId: string | null,
	extra: Partial<FileEntry> = {}
): FileEntry => ({
	id,
	name,
	type: 'file',
	parentId,
	...extra
});
const dir = (id: string, name: string, parentId: string | null): FileEntry => ({
	id,
	name,
	type: 'folder',
	parentId
});
const tree: FileEntry[] = [
	dir('d1', 'Docs', null),
	dir('d2', 'Reports', 'd1'),
	f('f1', 'b.pdf', 'd2', { size: 2000, modifiedAt: '2026-01-02T00:00:00Z' }),
	f('f2', 'a.png', null, { size: 500, modifiedAt: '2026-03-01T00:00:00Z' }),
	f('f3', 'c.txt', null, { size: 9000 }),
	dir('d3', 'Archive', null)
];

describe('kinds', () => {
	it('reads extensions', () => {
		expect(fileExtension('Photo.JPG')).toBe('jpg');
		expect(fileExtension('archive.tar.gz')).toBe('gz');
		expect(fileExtension('Makefile')).toBe('');
		expect(fileExtension('.env')).toBe('');
		expect(fileExtension('name.')).toBe('');
	});
	it('classifies', () => {
		expect(fileKind({ name: 'x', type: 'folder' })).toBe('folder');
		const cases: Record<string, string> = {
			'a.png': 'image',
			'a.mp4': 'video',
			'a.mp3': 'audio',
			'a.pdf': 'pdf',
			'a.docx': 'document',
			'a.csv': 'spreadsheet',
			'a.pptx': 'presentation',
			'a.zip': 'archive',
			'a.ts': 'code',
			'a.md': 'text',
			'a.xyz': 'other',
			Makefile: 'other'
		};
		for (const [name, kind] of Object.entries(cases))
			expect(fileKind({ name, type: 'file' })).toBe(kind);
	});
	it('has an icon and a label for every kind', () => {
		for (const k of [
			'folder',
			'image',
			'video',
			'audio',
			'pdf',
			'document',
			'spreadsheet',
			'presentation',
			'archive',
			'code',
			'text',
			'other'
		] as const) {
			expect(fileIcon(k)).not.toBe('');
			expect(kindLabel(k)).not.toBe('');
		}
	});
});

describe('formatFileSize', () => {
	it('scales', () => {
		expect(formatFileSize(0)).toBe('0 B');
		expect(formatFileSize(999)).toBe('999 B');
		expect(formatFileSize(1500)).toBe('1.5 KB');
		expect(formatFileSize(2_000_000)).toBe('2 MB');
		expect(formatFileSize(3.2e9)).toBe('3.2 GB');
		expect(formatFileSize(5e15)).toBe('5,000 TB');
		expect(formatFileSize(1500, 'de-DE')).toBe('1,5 KB');
	});
	it('is blank for nonsense', () => {
		expect(formatFileSize(undefined)).toBe('');
		expect(formatFileSize(-1)).toBe('');
		expect(formatFileSize(NaN)).toBe('');
	});
});

describe('folders', () => {
	it('builds breadcrumbs', () => {
		expect(breadcrumbPath(tree, null)).toEqual([]);
		expect(breadcrumbPath(tree, 'd2').map((e) => e.name)).toEqual(['Docs', 'Reports']);
		expect(breadcrumbPath(tree, 'nope')).toEqual([]);
	});
	it('survives a cycle', () => {
		const loop = [dir('a', 'A', 'b'), dir('b', 'B', 'a')];
		expect(
			breadcrumbPath(loop, 'a')
				.map((e) => e.id)
				.sort()
		).toEqual(['a', 'b']);
	});
	it('lists a folder, folders first, by the chosen key', () => {
		expect(childrenOf(tree, null).map((e) => e.name)).toEqual([
			'Archive',
			'Docs',
			'a.png',
			'c.txt'
		]);
		expect(
			childrenOf(tree, null, { key: 'size', direction: 'descending' }).map((e) => e.name)
		).toEqual(['Archive', 'Docs', 'c.txt', 'a.png']);
		expect(
			childrenOf(tree, null, { key: 'modified', direction: 'ascending' }).map((e) => e.name)
		).toEqual(['Archive', 'Docs', 'c.txt', 'a.png']);
		expect(childrenOf(tree, 'd2').map((e) => e.name)).toEqual(['b.pdf']);
		expect(childrenOf(tree, 'd3')).toEqual([]);
	});
	it('breaks ties by name', () => {
		const same = [f('1', 'b', null, { size: 1 }), f('2', 'a', null, { size: 1 })];
		expect(
			childrenOf(same, null, { key: 'size', direction: 'ascending' }).map((e) => e.name)
		).toEqual(['a', 'b']);
	});
});

describe('names', () => {
	const siblings = childrenOf(tree, null);
	it('accepts good names and rejects bad ones', () => {
		expect(validateFileName('new.txt', siblings)).toBe('');
		expect(validateFileName('  ', siblings)).toBe('Enter a name.');
		expect(validateFileName('a/b', siblings)).toContain('/');
		expect(validateFileName('a\\b', siblings)).toContain('/');
		expect(validateFileName('..', siblings)).toContain('dots');
		expect(validateFileName('x'.repeat(256), siblings)).toBe('That name is too long.');
		expect(validateFileName('A.PNG', siblings)).toContain('already here');
		expect(validateFileName('docs', siblings)).toContain('already here');
	});
	it('lets an item keep its own name, and takes custom copy', () => {
		expect(validateFileName('a.png', siblings, 'f2')).toBe('');
		expect(
			validateFileName('', [], undefined, { empty: 'E', slash: '', dots: '', long: '', taken: '' })
		).toBe('E');
	});
	it('renames with trimming', () => {
		const r = renameEntry(tree, 'f2', '  z.png ');
		expect(r.find((e) => e.id === 'f2')?.name).toBe('z.png');
		expect(r.find((e) => e.id === 'f3')).toBe(tree[4]);
	});
});

describe('deleting', () => {
	it('collects descendants and deletes them', () => {
		expect(withDescendants(tree, ['d1']).sort()).toEqual(['d1', 'd2', 'f1']);
		expect(deleteEntries(tree, ['d1']).map((e) => e.id)).toEqual(['f2', 'f3', 'd3']);
		expect(deleteEntries(tree, ['f2'])).toHaveLength(5);
		expect(deleteEntries(tree, [])).toHaveLength(6);
	});
	it('summarises for the confirm text', () => {
		expect(deleteSummary(tree, ['f2'])).toBe('"a.png"');
		expect(deleteSummary(tree, ['f2', 'f3'])).toBe('2 items');
	});
});

describe('upload queue', () => {
	const ids = (n: string, i: number) => `${n}-${i}`;
	it('enqueues, failing oversized files up front', () => {
		const q = enqueueUploads(
			[],
			[
				{ name: 'a.png', size: 10 },
				{ name: 'big.zip', size: 5_000_000 }
			],
			ids,
			1_000_000
		);
		expect(q[0]).toMatchObject({ id: 'a.png-0', status: 'queued', progress: 0 });
		expect(q[1]).toMatchObject({ status: 'error', error: 'Larger than 1 MB.' });
		expect(enqueueUploads(q, [{ name: 'c', size: 1 }], ids)).toHaveLength(3);
	});
	const q0: UploadJob[] = [
		{ id: 'a', name: 'a', size: 1, progress: 0, status: 'queued' },
		{ id: 'b', name: 'b', size: 1, progress: 0, status: 'queued' }
	];
	it('tracks progress, clamping and completing', () => {
		let q = setUploadProgress(q0, 'a', 40);
		expect(q[0]).toMatchObject({ progress: 40, status: 'uploading' });
		q = setUploadProgress(q, 'a', 250);
		expect(q[0]).toMatchObject({ progress: 100, status: 'done' });
		expect(setUploadProgress(q, 'b', -5)[1].progress).toBe(0);
		expect(setUploadProgress(q, 'b', NaN)[1].progress).toBe(0);
		expect(setUploadProgress(q, 'zz', 5)).toEqual(q);
	});
	it('ignores progress for cancelled or failed jobs', () => {
		const q = cancelUpload(q0, 'a');
		expect(setUploadProgress(q, 'a', 50)[0].status).toBe('cancelled');
		const failed = failUpload(q0, 'a', 'boom');
		expect(setUploadProgress(failed, 'a', 50)[0].status).toBe('error');
	});
	it('cancels only active jobs', () => {
		const done = setUploadProgress(q0, 'a', 100);
		expect(cancelUpload(done, 'a')[0].status).toBe('done');
		expect(cancelUpload(q0, 'b')[1].status).toBe('cancelled');
	});
	it('fails a job unless it is done', () => {
		const done = setUploadProgress(q0, 'a', 100);
		expect(failUpload(done, 'a', 'x')[0].status).toBe('done');
		expect(failUpload(q0, 'a', 'x')[0]).toMatchObject({ status: 'error', error: 'x' });
	});
	it('clears finished jobs and summarises', () => {
		let q = setUploadProgress(q0, 'a', 100);
		expect(queueSummary(q)).toBe('1 of 2 uploaded');
		expect(isUploadActive(q[0])).toBe(false);
		expect(isUploadActive(q[1])).toBe(true);
		expect(clearFinishedUploads(q)).toHaveLength(1);
		q = cancelUpload(q, 'b');
		expect(queueSummary(q)).toBe('All uploads finished');
		q = failUpload(setUploadProgress(q0, 'a', 100), 'b', 'x');
		expect(queueSummary(q)).toBe('1 uploaded, 1 failed');
		expect(queueSummary([])).toBe('');
	});
});

describe('display helpers', () => {
	it('formats the modified date', () => {
		expect(formatModified('2026-10-13T23:30:00Z')).toBe('Oct 13, 2026');
		expect(formatModified('2026-10-13T23:30:00Z', 'en-US', 'Asia/Tokyo')).toBe('Oct 14, 2026');
		expect(formatModified(undefined)).toBe('');
		expect(formatModified('nope')).toBe('');
	});
	it('summarises a folder', () => {
		expect(folderSummary(0)).toBe('Empty');
		expect(folderSummary(1)).toBe('1 item');
		expect(folderSummary(4)).toBe('4 items');
	});
});
