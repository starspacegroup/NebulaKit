import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ContentProof from './ContentProof.svelte';
import type { ContentItemParsed } from '$lib/cms/types';

function makeItem(overrides: Partial<ContentItemParsed> = {}): ContentItemParsed {
	return {
		id: 'ci-1',
		contentTypeId: 'ct-1',
		slug: 'the-future',
		title: 'The Future',
		status: 'published',
		fields: {},
		seoTitle: null,
		seoDescription: null,
		seoImage: null,
		authorId: null,
		publishedAt: '2024-01-01T00:00:00.000Z',
		createdAt: '2024-01-01T00:00:00.000Z',
		updatedAt: '2024-01-01T00:00:00.000Z',
		timestampProofHash: null,
		timestampProofTsr: null,
		timestampProofRequestedAt: null,
		timestampProofTsaUrl: null,
		timestampProofError: null,
		waybackSnapshotUrl: null,
		waybackCheckedAt: null,
		resolutionResolvedAt: null,
		resolutionResolvedBy: null,
		...overrides
	} as ContentItemParsed;
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe('ContentProof', () => {
	it('shows a pending message before the proof job has run', () => {
		render(ContentProof, { props: { item: makeItem() } });
		expect(screen.getByText(/being requested/i)).toBeTruthy();
	});

	it('shows the hash, download link, and verify command on success', () => {
		const item = makeItem({
			timestampProofRequestedAt: '2024-01-01T00:00:01.000Z',
			timestampProofHash: 'abc123',
			timestampProofTsr: 'YmFzZTY0'
		});
		const { container } = render(ContentProof, { props: { item } });

		expect(screen.getByText('abc123')).toBeTruthy();
		const downloadLink = container.querySelector('.proof-download') as HTMLAnchorElement;
		expect(downloadLink).toBeTruthy();
		expect(downloadLink.getAttribute('download')).toBe('the-future.tsr');
		expect(downloadLink.getAttribute('href')).toBe(
			'data:application/timestamp-reply;base64,YmFzZTY0'
		);
		expect(screen.getByText(/openssl ts -verify/)).toBeTruthy();
	});

	it('copies the hash to the clipboard when the copy button is clicked', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });

		const item = makeItem({
			timestampProofRequestedAt: '2024-01-01T00:00:01.000Z',
			timestampProofHash: 'abc123',
			timestampProofTsr: 'YmFzZTY0'
		});
		render(ContentProof, { props: { item } });

		await fireEvent.click(screen.getByText('Copy'));

		expect(writeText).toHaveBeenCalledWith('abc123');
		expect(screen.getByText('Copied')).toBeTruthy();

		vi.unstubAllGlobals();
	});

	it('shows the TSA error without a download link when the request failed', () => {
		const item = makeItem({
			timestampProofRequestedAt: '2024-01-01T00:00:01.000Z',
			timestampProofHash: 'abc123',
			timestampProofTsr: null,
			timestampProofError: 'TSA request failed: HTTP 500'
		});
		const { container } = render(ContentProof, { props: { item } });

		expect(screen.getByText(/TSA request failed: HTTP 500/)).toBeTruthy();
		expect(container.querySelector('.proof-download')).toBeNull();
	});

	it('shows a Wayback link when a snapshot exists', () => {
		const item = makeItem({
			waybackSnapshotUrl: 'https://web.archive.org/web/20240101000000/https://davis9001.dev/x'
		});
		render(ContentProof, { props: { item } });

		const link = screen.getByText('View archived snapshot') as HTMLAnchorElement;
		expect(link.getAttribute('href')).toBe(
			'https://web.archive.org/web/20240101000000/https://davis9001.dev/x'
		);
	});

	it('shows a pending message when no Wayback snapshot exists yet', () => {
		render(ContentProof, { props: { item: makeItem() } });
		expect(screen.getByText(/Snapshot capture pending/)).toBeTruthy();
	});
});
