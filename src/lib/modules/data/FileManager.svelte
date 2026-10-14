<!--
	FileManager — browse, upload and tidy files. Folders open in place with a
	breadcrumb trail back out; the list can be a table-like list or a grid of
	tiles. Pick files with the "Upload files" button or drop them anywhere on
	the manager; each goes into a queue with its own progress bar and a Cancel
	button. Rename happens in place (Enter saves, Escape cancels, a taken name
	is explained), several items can be selected for a confirmed delete, and
	every type gets an icon and a word ("Spreadsheet"), never the icon alone.

	The module never uploads: it queues, you listen for `upload`, do the work
	and bind `uploads` back with `setUploadProgress()` and friends.

	<FileManager label="Files" bind:entries bind:folderId bind:uploads on:upload={…} />
-->
<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import AlertDialog from '$lib/ui/AlertDialog.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import Progress from '$lib/ui/Progress.svelte';
	import { uid } from '$lib/ui/logic';
	import ActionMenu from './parts/ActionMenu.svelte';
	import {
		breadcrumbPath,
		cancelUpload,
		childrenOf,
		clearFinishedUploads,
		deleteEntries,
		deleteSummary,
		enqueueUploads,
		fileIcon,
		fileKind,
		folderSummary,
		formatFileSize,
		formatModified,
		isUploadActive,
		kindLabel,
		queueSummary,
		renameEntry,
		validateFileName,
		type FileEntry,
		type FileSortKey,
		type UploadJob
	} from './file-logic';
	import { selectionState, toggleAll, toggleSelected } from './logic';

	export let label = 'Files';
	export let entries: FileEntry[] = [];
	/** The folder being shown; null is the top. Bind it. */
	export let folderId: string | null = null;
	export let uploads: UploadJob[] = [];
	export let selected: string[] = [];
	export let view: 'list' | 'grid' = 'list';
	export let sortKey: FileSortKey = 'name';
	export let sortDirection: 'ascending' | 'descending' = 'ascending';
	/** As an input's accept: ".pdf,image/*". */
	export let accept = '';
	export let maxBytes = Infinity;
	export let rootLabel = 'All files';
	export let locale = 'en-US';
	export let timeZone = 'UTC';
	/** Heading level of the folder name. */
	export let level: 2 | 3 | 4 | 5 | 6 = 3;
	export let loading = false;
	export let newId: (name: string, index: number) => string = () => uid('file');
	export let copy = {
		upload: 'Upload files',
		newFolder: 'New folder',
		folderName: 'Folder name',
		create: 'Create',
		cancel: 'Cancel',
		list: 'List',
		grid: 'Grid',
		view: 'View',
		sortBy: 'Sort by',
		name: 'Name',
		size: 'Size',
		modified: 'Modified',
		ascending: 'Ascending',
		descending: 'Descending',
		selectAll: 'Select all',
		select: 'Select',
		open: 'Open',
		rename: 'Rename',
		delete: 'Delete',
		deleteSelected: 'Delete selected',
		save: 'Save',
		actions: 'Actions for',
		uploads: 'Uploads',
		cancelUpload: 'Cancel upload of',
		clearFinished: 'Clear finished',
		dropHere: 'Drop files to upload',
		empty: 'This folder is empty.',
		emptyHint: 'Drop files here or use Upload files.',
		confirmTitle: 'Delete permanently?',
		confirmBody: 'This cannot be undone.',
		loading: 'Loading files',
		breadcrumb: 'Folder path',
		status: {
			queued: 'Waiting',
			uploading: 'Uploading',
			done: 'Done',
			error: 'Failed',
			cancelled: 'Cancelled'
		}
	};

	const dispatch = createEventDispatcher<{
		open: { entry: FileEntry };
		navigate: { folderId: string | null };
		upload: { files: File[]; jobs: UploadJob[]; folderId: string | null };
		cancelupload: { id: string };
		rename: { id: string; name: string };
		delete: { ids: string[] };
		createfolder: { entry: FileEntry };
		selection: { selected: string[] };
	}>();

	const prefix = uid('files');
	let root: HTMLElement;
	let picker: HTMLInputElement;
	let announcement = '';
	let dragging = 0;
	let renaming: string | null = null;
	let renameDraft = '';
	let renameError = '';
	let creating = false;
	let folderDraft = '';
	let folderError = '';
	let confirmOpen = false;
	let pendingDelete: string[] = [];

	$: heading = `h${level}`;
	$: trail = breadcrumbPath(entries, folderId);
	$: current = trail[trail.length - 1];
	$: items = childrenOf(entries, folderId, { key: sortKey, direction: sortDirection });
	$: ids = items.map((e) => e.id);
	$: allState = selectionState(selected, ids);
	$: finished = uploads.filter((u) => !isUploadActive(u)).length;
	$: sortValue = `${sortKey}:${sortDirection}`;

	function sizeLine(entry: FileEntry): string {
		return entry.type === 'folder'
			? folderSummary(childrenOf(entries, entry.id).length)
			: formatFileSize(entry.size, locale);
	}

	function select(next: string[]) {
		selected = next;
		dispatch('selection', { selected });
	}

	async function goTo(id: string | null) {
		folderId = id;
		select([]);
		renaming = null;
		const name = id ? entries.find((e) => e.id === id)?.name : rootLabel;
		announcement = `${name}: ${folderSummary(childrenOf(entries, id).length)}.`;
		dispatch('navigate', { folderId: id });
		await tick();
		root.querySelector<HTMLElement>(`#${prefix}-title`)?.focus();
	}

	function open(entry: FileEntry) {
		if (entry.type === 'folder') goTo(entry.id);
		else dispatch('open', { entry });
	}

	function take(list: FileList | File[] | null | undefined) {
		const files = [...(list ?? [])].filter((f) => accepts(f));
		if (files.length === 0) return;
		const before = uploads.length;
		uploads = enqueueUploads(uploads, files, newId, maxBytes);
		const jobs = uploads.slice(before);
		announcement = `${files.length} ${files.length === 1 ? 'file' : 'files'} added to the upload queue.`;
		dispatch('upload', { files, jobs, folderId });
	}

	function accepts(file: File): boolean {
		if (!accept.trim()) return true;
		const name = file.name.toLowerCase();
		return accept
			.split(',')
			.map((a) => a.trim().toLowerCase())
			.filter(Boolean)
			.some((rule) =>
				rule.startsWith('.')
					? name.endsWith(rule)
					: rule.endsWith('/*')
						? file.type.startsWith(rule.slice(0, -1))
						: file.type === rule
			);
	}

	function onPick() {
		take(picker.files);
		picker.value = '';
	}

	function onDragEnter(event: DragEvent) {
		if (!event.dataTransfer?.types?.includes('Files')) return;
		event.preventDefault();
		dragging += 1;
	}

	function onDragOver(event: DragEvent) {
		if (dragging > 0) event.preventDefault();
	}

	function onDragLeave() {
		dragging = Math.max(0, dragging - 1);
	}

	function onDrop(event: DragEvent) {
		if (dragging === 0) return;
		event.preventDefault();
		dragging = 0;
		take(event.dataTransfer?.files);
	}

	function cancel(job: UploadJob) {
		uploads = cancelUpload(uploads, job.id);
		announcement = `Upload of ${job.name} cancelled.`;
		dispatch('cancelupload', { id: job.id });
	}

	async function beginRename(entry: FileEntry) {
		renaming = entry.id;
		renameDraft = entry.name;
		renameError = '';
		await tick();
		const input = root.querySelector<HTMLInputElement>(`#${prefix}-rename`);
		input?.focus();
		const dot = entry.type === 'file' ? entry.name.lastIndexOf('.') : -1;
		input?.setSelectionRange(0, dot > 0 ? dot : entry.name.length);
	}

	async function endRename(id: string) {
		renaming = null;
		await tick();
		root.querySelector<HTMLElement>(`[data-entry="${id}"]`)?.focus();
	}

	function commitRename(entry: FileEntry) {
		const error = validateFileName(renameDraft, items, entry.id);
		renameError = error;
		if (error) return;
		const name = renameDraft.trim();
		if (name !== entry.name) {
			entries = renameEntry(entries, entry.id, name);
			announcement = `Renamed to ${name}.`;
			dispatch('rename', { id: entry.id, name });
		}
		endRename(entry.id);
	}

	function onRenameKey(event: KeyboardEvent, entry: FileEntry) {
		if (event.key === 'Escape') {
			event.preventDefault();
			endRename(entry.id);
		}
	}

	async function beginFolder() {
		creating = true;
		folderDraft = '';
		folderError = '';
		await tick();
		root.querySelector<HTMLInputElement>(`#${prefix}-folder`)?.focus();
	}

	function commitFolder() {
		const error = validateFileName(folderDraft, items);
		folderError = error;
		if (error) return;
		const entry: FileEntry = {
			id: newId(folderDraft, 0),
			name: folderDraft.trim(),
			type: 'folder',
			parentId: folderId
		};
		entries = [...entries, entry];
		creating = false;
		announcement = `Folder ${entry.name} created.`;
		dispatch('createfolder', { entry });
		tick().then(() => root.querySelector<HTMLElement>(`[data-entry="${entry.id}"]`)?.focus());
	}

	function onFolderKey(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			creating = false;
		}
	}

	function askDelete(list: string[]) {
		pendingDelete = list;
		confirmOpen = true;
	}

	async function confirmDelete() {
		const list = pendingDelete;
		pendingDelete = [];
		entries = deleteEntries(entries, list);
		select(selected.filter((id) => entries.some((e) => e.id === id)));
		if (folderId && !entries.some((e) => e.id === folderId)) folderId = null;
		announcement = `${list.length === 1 ? 'Item' : `${list.length} items`} deleted.`;
		dispatch('delete', { ids: list });
		await tick();
		root.querySelector<HTMLElement>(`#${prefix}-title`)?.focus();
	}

	function onMenu(entry: FileEntry, action: string) {
		if (action === 'open') open(entry);
		else if (action === 'rename') beginRename(entry);
		else if (action === 'delete') askDelete([entry.id]);
	}

	function onSort(event: Event) {
		const [key, direction] = (event.currentTarget as HTMLSelectElement).value.split(':');
		sortKey = key as FileSortKey;
		sortDirection = direction as 'ascending' | 'descending';
	}
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<section
	class="files"
	class:files--dragging={dragging > 0}
	aria-label={label}
	aria-busy={loading || undefined}
	bind:this={root}
	on:dragenter={onDragEnter}
	on:dragover={onDragOver}
	on:dragleave={onDragLeave}
	on:drop={onDrop}
>
	<div class="files__bar">
		<nav aria-label={copy.breadcrumb}>
			<ol class="files__crumbs">
				<li>
					{#if folderId === null}
						<span aria-current="page">{rootLabel}</span>
					{:else}
						<button type="button" class="files__crumb" on:click={() => goTo(null)}
							>{rootLabel}</button
						>
					{/if}
				</li>
				{#each trail as crumb, i (crumb.id)}
					<li>
						<span aria-hidden="true">/</span>
						{#if i === trail.length - 1}
							<span aria-current="page">{crumb.name}</span>
						{:else}
							<button type="button" class="files__crumb" on:click={() => goTo(crumb.id)}
								>{crumb.name}</button
							>
						{/if}
					</li>
				{/each}
			</ol>
		</nav>
		<div class="files__tools">
			<button type="button" class="files__primary" on:click={() => picker.click()}
				>{copy.upload}</button
			>
			<input
				bind:this={picker}
				type="file"
				multiple
				{accept}
				hidden
				tabindex="-1"
				on:change={onPick}
			/>
			<button type="button" class="files__btn" on:click={beginFolder}>{copy.newFolder}</button>
			<div class="files__views" role="group" aria-label={copy.view}>
				<button
					type="button"
					class="files__btn"
					aria-pressed={view === 'list'}
					on:click={() => (view = 'list')}>{copy.list}</button
				>
				<button
					type="button"
					class="files__btn"
					aria-pressed={view === 'grid'}
					on:click={() => (view = 'grid')}>{copy.grid}</button
				>
			</div>
			<label class="files__sort">
				<span class="sr-only">{copy.sortBy}</span>
				<select value={sortValue} on:change={onSort} aria-label={copy.sortBy}>
					<option value="name:ascending">{copy.name}, {copy.ascending}</option>
					<option value="name:descending">{copy.name}, {copy.descending}</option>
					<option value="size:descending">{copy.size}, {copy.descending}</option>
					<option value="size:ascending">{copy.size}, {copy.ascending}</option>
					<option value="modified:descending">{copy.modified}, {copy.descending}</option>
					<option value="modified:ascending">{copy.modified}, {copy.ascending}</option>
				</select>
			</label>
		</div>
	</div>

	<svelte:element this={heading} id="{prefix}-title" class="files__title" tabindex="-1">
		{current ? current.name : rootLabel}
		<span class="files__count">({items.length})</span>
	</svelte:element>

	{#if creating}
		<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
		<form class="files__form" on:submit|preventDefault={commitFolder} on:keydown={onFolderKey}>
			<label for="{prefix}-folder">{copy.folderName}</label>
			<input
				id="{prefix}-folder"
				type="text"
				bind:value={folderDraft}
				autocomplete="off"
				aria-invalid={folderError ? 'true' : undefined}
				aria-describedby={folderError ? `${prefix}-folder-err` : undefined}
			/>
			<button type="submit" class="files__primary">{copy.create}</button>
			<button type="button" class="files__btn" on:click={() => (creating = false)}
				>{copy.cancel}</button
			>
			{#if folderError}<p id="{prefix}-folder-err" class="files__error" role="alert">
					{folderError}
				</p>{/if}
		</form>
	{/if}

	{#if selected.length > 0}
		<div class="files__selbar" role="region" aria-label="Selection">
			<strong>{selected.length} selected</strong>
			<button
				type="button"
				class="files__btn files__btn--danger"
				on:click={() => askDelete(selected)}>{copy.deleteSelected}</button
			>
			<button type="button" class="files__btn" on:click={() => select([])}>Clear selection</button>
		</div>
	{/if}

	{#if loading}
		<p role="status">{copy.loading}</p>
	{:else if items.length === 0}
		<EmptyState title={copy.empty} description={copy.emptyHint} icon="📂" />
	{:else}
		<label class="files__all">
			<input
				type="checkbox"
				checked={allState === 'all'}
				indeterminate={allState === 'some'}
				on:change={() => select(toggleAll(selected, ids))}
			/>
			{copy.selectAll}
		</label>
		<ul class="files__list files__list--{view}" aria-labelledby="{prefix}-title">
			{#each items as entry (entry.id)}
				{@const kind = fileKind(entry)}
				<li
					class="files__item"
					class:files__item--selected={selected.includes(entry.id)}
					data-entry={entry.id}
					tabindex="-1"
				>
					<label class="files__check">
						<input
							type="checkbox"
							aria-label="{copy.select} {entry.name}"
							checked={selected.includes(entry.id)}
							on:change={() => select(toggleSelected(selected, entry.id))}
						/>
					</label>
					<span class="files__icon" aria-hidden="true">{fileIcon(kind)}</span>
					<div class="files__main">
						{#if renaming === entry.id}
							<form class="files__rename" on:submit|preventDefault={() => commitRename(entry)}>
								<label class="sr-only" for="{prefix}-rename">{copy.rename} {entry.name}</label>
								<input
									id="{prefix}-rename"
									type="text"
									bind:value={renameDraft}
									autocomplete="off"
									aria-invalid={renameError ? 'true' : undefined}
									aria-describedby={renameError ? `${prefix}-rename-err` : undefined}
									on:keydown={(e) => onRenameKey(e, entry)}
								/>
								<button type="submit" class="files__btn">{copy.save}</button>
								<button type="button" class="files__btn" on:click={() => endRename(entry.id)}
									>{copy.cancel}</button
								>
								{#if renameError}
									<p id="{prefix}-rename-err" class="files__error" role="alert">{renameError}</p>
								{/if}
							</form>
						{:else}
							<button type="button" class="files__name" on:click={() => open(entry)}>
								{entry.name}<span class="sr-only">, {kindLabel(kind)}</span>
							</button>
							<span class="files__meta">
								{kindLabel(kind)} · {sizeLine(entry)}
								{#if entry.modifiedAt}· {formatModified(entry.modifiedAt, locale, timeZone)}{/if}
							</span>
						{/if}
					</div>
					<div class="files__menu">
						<ActionMenu
							label="{copy.actions} {entry.name}"
							items={[
								{ id: 'open', label: copy.open },
								{ id: 'rename', label: copy.rename },
								{ id: 'delete', label: copy.delete, danger: true }
							]}
							on:select={(e) => onMenu(entry, e.detail.id)}
						/>
					</div>
				</li>
			{/each}
		</ul>
	{/if}

	{#if uploads.length > 0}
		<section class="files__uploads" aria-label={copy.uploads}>
			<div class="files__uphead">
				<p class="files__summary" role="status">{queueSummary(uploads)}</p>
				{#if finished > 0}
					<button
						type="button"
						class="files__btn"
						on:click={() => (uploads = clearFinishedUploads(uploads))}>{copy.clearFinished}</button
					>
				{/if}
			</div>
			<ul class="files__queue">
				{#each uploads as job (job.id)}
					<li class="files__job">
						<div class="files__jobtop">
							<span class="files__jobname">{job.name}</span>
							<span class="files__meta"
								>{copy.status[job.status]}{job.error ? `: ${job.error}` : ''}</span
							>
							{#if isUploadActive(job)}
								<button type="button" class="files__btn" on:click={() => cancel(job)}
									>{copy.cancel}<span class="sr-only"> {copy.cancelUpload} {job.name}</span></button
								>
							{/if}
						</div>
						{#if job.status === 'queued' || job.status === 'uploading' || job.status === 'done'}
							<Progress
								value={job.progress}
								label={job.name}
								tone={job.status === 'done' ? 'success' : 'primary'}
							/>
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if dragging > 0}
		<div class="files__drop" aria-hidden="true">{copy.dropHere}</div>
	{/if}
	<p class="sr-only" role="status" aria-live="polite">{announcement}</p>

	<AlertDialog
		bind:open={confirmOpen}
		title={copy.confirmTitle}
		description="{deleteSummary(entries, pendingDelete)}. {copy.confirmBody}"
		confirmLabel={copy.delete}
		cancelLabel={copy.cancel}
		tone="danger"
		on:confirm={confirmDelete}
		on:cancel={() => (pendingDelete = [])}
	/>
</section>

<style>
	.files {
		position: relative;
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-md);
		min-width: 0;
	}

	.files--dragging {
		outline: 2px dashed var(--color-primary);
		outline-offset: 4px;
	}

	.files__drop {
		position: absolute;
		inset: 0;
		z-index: 5;
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		place-items: center;
		border-radius: var(--radius-lg);
		background: color-mix(in srgb, var(--color-primary) 16%, var(--color-background));
		font-size: 1.125rem;
		font-weight: 700;
		pointer-events: none;
	}

	.files__bar,
	.files__tools,
	.files__views,
	.files__selbar,
	.files__uphead,
	.files__jobtop {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--spacing-sm);
	}

	.files__bar {
		justify-content: space-between;
	}

	.files__crumbs {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--spacing-xs);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.files__crumbs li {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-xs);
	}

	.files__crumb {
		min-height: 2.75rem;
		padding: 0 var(--spacing-xs);
		border: 0;
		background: transparent;
		color: var(--color-primary);
		font: inherit;
		text-decoration: underline;
		cursor: pointer;
	}

	.files__title {
		margin: 0;
		font-size: 1.125rem;
	}

	.files__count,
	.files__meta {
		color: var(--color-text-secondary);
		font-size: 0.875rem;
		font-weight: 400;
	}

	.files__btn,
	.files__primary {
		min-height: 2.75rem;
		padding: 0.5rem 1rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-text);
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}

	.files__btn[aria-pressed='true'] {
		border-color: var(--color-primary);
		background: color-mix(in srgb, var(--color-primary) 16%, var(--color-surface));
		box-shadow: inset 0 -3px 0 var(--color-primary);
	}

	.files__primary {
		border-color: var(--color-primary-solid);
		background: var(--color-primary-solid);
		color: var(--color-on-solid);
	}

	.files__btn--danger {
		color: var(--color-danger);
	}

	.files__btn:hover {
		background: var(--color-surface-hover);
	}

	.files__sort select {
		min-height: 2.75rem;
	}

	.files__form {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--spacing-sm);
		padding: var(--spacing-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
	}

	.files__form input,
	.files__rename input {
		min-height: 2.75rem;
		box-sizing: border-box;
	}

	.files__error {
		flex-basis: 100%;
		margin: 0;
		color: var(--color-error);
		font-size: 0.875rem;
	}

	.files__selbar {
		padding: var(--spacing-sm) var(--spacing-md);
		border: 1px solid var(--color-primary);
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--color-primary) 10%, var(--color-background));
	}

	.files__all {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-sm);
		min-height: 2.75rem;
		cursor: pointer;
	}

	.files__list {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-sm);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.files__list--grid {
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 11rem), 1fr));
	}

	.files__item {
		display: grid;
		grid-template-columns: auto auto minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--spacing-sm);
		padding: var(--spacing-xs) var(--spacing-sm);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-background);
	}

	.files__list--grid .files__item {
		grid-template-columns: auto 1fr auto;
		grid-template-areas:
			'check . menu'
			'icon icon icon'
			'main main main';
		justify-items: center;
		text-align: center;
		padding: var(--spacing-sm);
	}

	.files__list--grid .files__check {
		grid-area: check;
	}

	.files__list--grid .files__icon {
		grid-area: icon;
		font-size: 2.5rem;
	}

	.files__list--grid .files__main {
		grid-area: main;
		justify-items: center;
		width: 100%;
	}

	.files__list--grid .files__menu {
		grid-area: menu;
	}

	.files__item--selected {
		border-color: var(--color-primary);
		background: color-mix(in srgb, var(--color-primary) 8%, var(--color-background));
	}

	.files__item:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.files__check {
		display: inline-grid;
		place-items: center;
		min-width: 2.75rem;
		min-height: 2.75rem;
		cursor: pointer;
	}

	.files__check input,
	.files__all input {
		width: 1.125rem;
		height: 1.125rem;
		accent-color: var(--color-primary-solid);
	}

	.files__icon {
		font-size: 1.5rem;
		line-height: 1;
	}

	.files__main {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		min-width: 0;
	}

	.files__name {
		justify-self: start;
		min-height: 2.75rem;
		max-width: 100%;
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--color-text);
		font: inherit;
		font-weight: 600;
		text-align: start;
		overflow-wrap: anywhere;
		cursor: pointer;
	}

	.files__name:hover {
		text-decoration: underline;
	}

	.files__rename {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-xs);
	}

	.files__rename input {
		flex: 1 1 8rem;
		min-width: 0;
	}

	.files__uploads {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-sm);
		padding: var(--spacing-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
	}

	.files__summary {
		margin: 0;
		font-weight: 600;
	}

	.files__queue {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-sm);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.files__job {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-xs);
	}

	.files__jobname {
		flex: 1 1 8rem;
		min-width: 0;
		overflow-wrap: anywhere;
		font-weight: 600;
	}

	.files__btn:focus-visible,
	.files__primary:focus-visible,
	.files__crumb:focus-visible,
	.files__name:focus-visible,
	.files__check input:focus-visible,
	.files__all input:focus-visible,
	.files__form input:focus-visible,
	.files__rename input:focus-visible,
	.files__sort select:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	@media (min-width: 40rem) {
		.files__list--list .files__item {
			padding-inline: var(--spacing-md);
		}
	}
</style>
