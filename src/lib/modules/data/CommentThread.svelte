<!--
	CommentThread — a conversation: nested replies down to three levels (deeper
	replies sit beside their parent), a compose box with a character allowance,
	edit and delete on your own comments (delete asks first), reactions as toggle
	buttons with counts, and a button to collapse any branch. Bind `comments`
	(a flat list with `parentId`); you hear about every change as an event, so
	saving is yours to do.

	<CommentThread {comments} currentUser={{ id: 'u1', name: 'Ada' }} {now} bind:comments />
-->
<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import AlertDialog from '$lib/ui/AlertDialog.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import { uid } from '$lib/ui/logic';
	import {
		addThreadComment,
		buildTree,
		countComments,
		deleteThreadComment,
		editThreadComment,
		MAX_COMMENT_DEPTH,
		setReactions,
		toggleReaction,
		type CommentAuthor,
		type ThreadComment
	} from './comment-logic';
	import { isoString, type DateInput } from './time-logic';
	import CommentForm from './parts/CommentForm.svelte';
	import CommentItem from './parts/CommentItem.svelte';

	export let label = 'Comments';
	export let comments: ThreadComment[] = [];
	export let currentUser: CommentAuthor;
	export let now: DateInput = new Date();
	export let locale = 'en-US';
	export let timeZone = 'UTC';
	export let maxLength = 1000;
	export let maxDepth = MAX_COMMENT_DEPTH;
	export let offeredReactions: string[] = ['👍', '❤️', '🎉'];
	/** Heading level of the thread title. */
	export let level: 2 | 3 | 4 | 5 | 6 = 3;
	export let newId: () => string = () => uid('comment');
	export let copy = {
		compose: 'Add a comment',
		post: 'Post comment',
		postReply: 'Post reply',
		reply: 'Reply',
		replyTo: 'Reply to',
		to: 'to',
		comment: 'comment',
		edit: 'Edit',
		delete: 'Delete',
		save: 'Save',
		cancel: 'Cancel',
		edited: 'edited',
		deleted: 'This comment was deleted.',
		editLabel: 'Edit your comment',
		reactions: 'Reactions',
		react: 'React with',
		show: 'Show',
		hide: 'Hide',
		replyOne: 'reply',
		replyMany: 'replies',
		empty: 'No comments yet. Start the conversation.',
		confirmTitle: 'Delete this comment?',
		confirmBody: 'This cannot be undone.',
		confirm: 'Delete'
	};

	const dispatch = createEventDispatcher<{
		change: { comments: ThreadComment[] };
		post: { comment: ThreadComment };
		edit: { id: string; body: string };
		delete: { id: string };
		react: { id: string; emoji: string; active: boolean };
	}>();

	const prefix = uid('thread');
	let collapsed: string[] = [];
	let editing: string | null = null;
	let replying: string | null = null;
	let confirming: string | null = null;
	let confirmOpen = false;
	let announcement = '';
	let title: HTMLElement;
	let root: HTMLElement;

	$: heading = `h${level}`;
	$: tree = buildTree(comments, maxDepth);
	$: total = countComments(tree);
	$: stamp = isoString(now);
	$: ctx = {
		prefix,
		userId: currentUser.id,
		now,
		locale,
		timeZone,
		maxDepth,
		maxLength,
		offered: offeredReactions,
		collapsed,
		editing,
		replying,
		copy
	};

	function commit(next: ThreadComment[]) {
		comments = next;
		dispatch('change', { comments });
	}

	async function focusComment(id: string) {
		await tick();
		root?.querySelector<HTMLElement>(`[id="${prefix}-${id}"]`)?.focus();
	}

	function post(parentId: string | null, text: string) {
		const comment: ThreadComment = {
			id: newId(),
			parentId,
			author: currentUser,
			body: text,
			createdAt: stamp
		};
		commit(addThreadComment(comments, comment));
		dispatch('post', { comment });
		announcement = parentId ? 'Reply posted.' : 'Comment posted.';
		return comment.id;
	}

	async function onAct(
		event: CustomEvent<{ type: string; id: string; emoji?: string; text?: string }>
	) {
		const { type, id, emoji, text } = event.detail;
		if (type === 'reply') {
			replying = replying === id ? null : id;
			editing = null;
		} else if (type === 'edit') {
			editing = id;
			replying = null;
		} else if (type === 'cancel') {
			editing = null;
			replying = null;
			focusComment(id);
		} else if (type === 'save') {
			commit(editThreadComment(comments, id, text ?? '', stamp));
			dispatch('edit', { id, body: text ?? '' });
			editing = null;
			announcement = 'Comment updated.';
			focusComment(id);
		} else if (type === 'post-reply') {
			replying = null;
			collapsed = collapsed.filter((c) => c !== id);
			const created = post(id, text ?? '');
			focusComment(created);
		} else if (type === 'delete') {
			confirming = id;
			confirmOpen = true;
		} else if (type === 'toggle') {
			collapsed = collapsed.includes(id) ? collapsed.filter((c) => c !== id) : [...collapsed, id];
		} else if (type === 'react' && emoji) {
			const target = comments.find((c) => c.id === id);
			const next = toggleReaction(target?.reactions, emoji, currentUser.id);
			commit(setReactions(comments, id, next));
			const active = (next[emoji] ?? []).includes(currentUser.id);
			dispatch('react', { id, emoji, active });
			announcement = `${emoji} ${active ? 'added' : 'removed'}.`;
		}
	}

	async function confirmDelete() {
		const id = confirming;
		confirming = null;
		if (!id) return;
		commit(deleteThreadComment(comments, id));
		dispatch('delete', { id });
		announcement = 'Comment deleted.';
		await tick();
		title?.focus();
	}

	function cancelDelete() {
		const id = confirming;
		confirming = null;
		if (id) focusComment(id);
	}
</script>

<section class="thread" aria-labelledby="{prefix}-title" bind:this={root}>
	<svelte:element
		this={heading}
		id="{prefix}-title"
		class="thread__title"
		tabindex="-1"
		bind:this={title}
	>
		{label} <span class="thread__count">({total})</span>
	</svelte:element>

	<CommentForm
		label={copy.compose}
		{maxLength}
		submitLabel={copy.post}
		cancelLabel={copy.cancel}
		on:submit={(e) => post(null, e.detail.text)}
	/>

	{#if tree.length === 0}
		<EmptyState title={copy.empty} />
	{:else}
		<ul class="thread__list">
			{#each tree as node (node.comment.id)}
				<CommentItem {node} {ctx} on:act={onAct} />
			{/each}
		</ul>
	{/if}

	<p class="sr-only" role="status" aria-live="polite">{announcement}</p>

	<AlertDialog
		bind:open={confirmOpen}
		title={copy.confirmTitle}
		description={copy.confirmBody}
		confirmLabel={copy.confirm}
		cancelLabel={copy.cancel}
		tone="danger"
		on:confirm={confirmDelete}
		on:cancel={cancelDelete}
	/>
</section>

<style>
	.thread {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-lg);
		min-width: 0;
	}

	.thread__title {
		margin: 0;
		font-size: 1.125rem;
	}

	.thread__title:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.thread__count {
		color: var(--color-text-secondary);
		font-weight: 400;
	}

	.thread__list {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-sm);
		margin: 0;
		padding: 0;
	}

	/* Digits that change keep their width, so a live count or time never nudges what is beside it. */
	.thread__count {
		font-variant-numeric: tabular-nums;
	}
</style>
