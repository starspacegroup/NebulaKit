<!--
	CommentItem — one comment and, recursively, its replies. State lives in the
	parent (`ctx`); this component only draws and reports what was pressed as an
	`act` event, which each level forwards upward.
-->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Avatar from '$lib/ui/Avatar.svelte';
	import {
		canReplyAtDepth,
		countReplies,
		reactionSummary,
		type CommentNode
	} from '../comment-logic';
	import { absoluteTimeText, isoString, relativeTimeText, type DateInput } from '../time-logic';
	import CommentForm from './CommentForm.svelte';

	type Ctx = {
		prefix: string;
		userId: string;
		now: DateInput;
		locale: string;
		timeZone: string;
		maxDepth: number;
		maxLength: number;
		offered: string[];
		collapsed: string[];
		editing: string | null;
		replying: string | null;
		copy: Record<string, string>;
	};

	export let node: CommentNode;
	export let ctx: Ctx;

	const dispatch = createEventDispatcher<{
		act: { type: string; id: string; emoji?: string; text?: string };
	}>();

	$: comment = node.comment;
	$: mine = comment.author.id === ctx.userId && !comment.deleted;
	$: replies = countReplies(node);
	$: collapsed = ctx.collapsed.includes(comment.id);
	$: summary = reactionSummary(comment.reactions, ctx.offered, ctx.userId);
	$: editing = ctx.editing === comment.id;
	$: replying = ctx.replying === comment.id;

	function act(type: string, extra: { emoji?: string; text?: string } = {}) {
		dispatch('act', { type, id: comment.id, ...extra });
	}
</script>

<li class="citem" id="{ctx.prefix}-{comment.id}" tabindex="-1">
	<article class="citem__article" aria-labelledby="{ctx.prefix}-{comment.id}-who">
		<header class="citem__head">
			<Avatar name={comment.author.name} src={comment.author.avatar} size="sm" />
			<strong id="{ctx.prefix}-{comment.id}-who">{comment.author.name}</strong>
			<time
				class="citem__time"
				datetime={isoString(comment.createdAt)}
				title={absoluteTimeText(comment.createdAt, ctx)}
				>{relativeTimeText(comment.createdAt, ctx.now, ctx)}</time
			>
			{#if comment.editedAt && !comment.deleted}
				<span class="citem__edited" title={absoluteTimeText(comment.editedAt, ctx)}
					>({ctx.copy.edited})</span
				>
			{/if}
		</header>

		{#if comment.deleted}
			<p class="citem__deleted">{ctx.copy.deleted}</p>
		{:else if editing}
			<CommentForm
				label={ctx.copy.editLabel}
				hideLabel
				value={comment.body}
				maxLength={ctx.maxLength}
				submitLabel={ctx.copy.save}
				cancelLabel={ctx.copy.cancel}
				cancelable
				autofocus
				on:submit={(e) => act('save', { text: e.detail.text })}
				on:cancel={() => act('cancel')}
			/>
		{:else}
			<p class="citem__body">{comment.body}</p>
		{/if}

		{#if !comment.deleted && !editing}
			<div class="citem__reactions" role="group" aria-label={ctx.copy.reactions}>
				{#each summary as item (item.emoji)}
					<button
						type="button"
						class="citem__react"
						aria-pressed={item.mine}
						on:click={() => act('react', { emoji: item.emoji })}
					>
						<span aria-hidden="true">{item.emoji}</span>
						<span class="sr-only">{ctx.copy.react} {item.emoji}</span>
						{#if item.count > 0}<span class="citem__n">{item.count}</span>{/if}
					</button>
				{/each}
			</div>
		{/if}

		<div class="citem__actions">
			{#if !comment.deleted && canReplyAtDepth(node.depth, ctx.maxDepth)}
				<button
					type="button"
					class="citem__btn"
					aria-expanded={replying}
					on:click={() => act('reply')}
					>{ctx.copy.reply}<span class="sr-only"> {ctx.copy.to} {comment.author.name}</span></button
				>
			{/if}
			{#if mine && !editing}
				<button type="button" class="citem__btn" on:click={() => act('edit')}
					>{ctx.copy.edit}<span class="sr-only"> {ctx.copy.comment}</span></button
				>
				<button type="button" class="citem__btn citem__btn--danger" on:click={() => act('delete')}
					>{ctx.copy.delete}<span class="sr-only"> {ctx.copy.comment}</span></button
				>
			{/if}
			{#if replies > 0}
				<button
					type="button"
					class="citem__btn"
					aria-expanded={!collapsed}
					aria-controls="{ctx.prefix}-{comment.id}-replies"
					on:click={() => act('toggle')}
				>
					{collapsed ? ctx.copy.show : ctx.copy.hide}
					{replies}
					{replies === 1 ? ctx.copy.replyOne : ctx.copy.replyMany}
				</button>
			{/if}
		</div>

		{#if replying}
			<div class="citem__reply">
				<CommentForm
					label="{ctx.copy.replyTo} {comment.author.name}"
					maxLength={ctx.maxLength}
					submitLabel={ctx.copy.postReply}
					cancelLabel={ctx.copy.cancel}
					cancelable
					autofocus
					on:submit={(e) => act('post-reply', { text: e.detail.text })}
					on:cancel={() => act('cancel')}
				/>
			</div>
		{/if}
	</article>

	{#if node.children.length > 0}
		<ul class="citem__replies" id="{ctx.prefix}-{comment.id}-replies" hidden={collapsed}>
			{#each node.children as child (child.comment.id)}
				<svelte:self node={child} {ctx} on:act />
			{/each}
		</ul>
	{/if}
</li>

<style>
	.citem {
		list-style: none;
		border-radius: var(--radius-md);
	}

	.citem:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.citem__article {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-sm);
		padding: var(--spacing-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-background);
	}

	.citem__head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--spacing-sm);
	}

	.citem__time,
	.citem__edited {
		color: var(--color-text-secondary);
		font-size: 0.8125rem;
	}

	.citem__body {
		margin: 0;
		overflow-wrap: anywhere;
		white-space: pre-wrap;
	}

	.citem__deleted {
		margin: 0;
		color: var(--color-text-secondary);
		font-style: italic;
	}

	.citem__reactions,
	.citem__actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-xs);
	}

	.citem__react,
	.citem__btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--spacing-xs);
		min-width: 2.75rem;
		min-height: 2.75rem;
		padding: 0 var(--spacing-md);
		border: 1px solid var(--color-border);
		border-radius: 999px;
		background: var(--color-surface);
		color: var(--color-text);
		font: inherit;
		font-size: 0.9rem;
		cursor: pointer;
	}

	.citem__btn {
		border-color: transparent;
		background: transparent;
		border-radius: var(--radius-md);
		font-weight: 600;
	}

	.citem__btn--danger {
		color: var(--color-danger);
	}

	.citem__react[aria-pressed='true'] {
		border-color: var(--color-primary);
		background: color-mix(in srgb, var(--color-primary) 16%, var(--color-surface));
		font-weight: 700;
	}

	.citem__react:hover,
	.citem__btn:hover {
		background: var(--color-surface-hover);
	}

	.citem__n {
		font-variant-numeric: tabular-nums;
	}

	.citem__react:focus-visible,
	.citem__btn:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.citem__replies {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-sm);
		margin: var(--spacing-sm) 0 0;
		padding: 0;
		padding-inline-start: var(--spacing-md);
		border-inline-start: 2px solid var(--color-border);
		margin-inline-start: var(--spacing-sm);
	}

	.citem__replies[hidden] {
		display: none;
	}
</style>
