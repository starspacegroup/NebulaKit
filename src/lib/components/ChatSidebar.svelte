<script lang="ts">
	import { chatHistoryStore, type Conversation } from '$lib/stores/chatHistory';
	import { quintOut } from 'svelte/easing';
	import { fade, fly, slide } from 'svelte/transition';

	export let isOpen = true;

	$: conversations = $chatHistoryStore.conversations;
	$: currentId = $chatHistoryStore.currentConversationId;

	function handleNewChat() {
		chatHistoryStore.createConversation();
	}

	function handleSelectConversation(id: string) {
		chatHistoryStore.selectConversation(id);
	}

	function handleDeleteConversation(e: Event, id: string) {
		e.stopPropagation();
		chatHistoryStore.deleteConversation(id);
	}

	function formatDate(date: Date): string {
		const now = new Date();
		const diff = now.getTime() - date.getTime();
		const days = Math.floor(diff / (1000 * 60 * 60 * 24));

		if (days === 0) {
			return 'Today';
		} else if (days === 1) {
			return 'Yesterday';
		} else if (days < 7) {
			return `${days} days ago`;
		} else {
			return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
		}
	}

	// Group conversations by date
	function groupConversations(convs: Conversation[]) {
		const groups: { label: string; conversations: Conversation[] }[] = [];
		const today: Conversation[] = [];
		const yesterday: Conversation[] = [];
		const thisWeek: Conversation[] = [];
		const older: Conversation[] = [];

		const now = new Date();
		const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
		const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);

		for (const conv of convs) {
			const convDate = new Date(conv.updatedAt);
			if (convDate >= todayStart) {
				today.push(conv);
			} else if (convDate >= yesterdayStart) {
				yesterday.push(conv);
			} else if (convDate >= weekStart) {
				thisWeek.push(conv);
			} else {
				older.push(conv);
			}
		}

		if (today.length > 0) groups.push({ label: 'Today', conversations: today });
		if (yesterday.length > 0) groups.push({ label: 'Yesterday', conversations: yesterday });
		if (thisWeek.length > 0) groups.push({ label: 'This Week', conversations: thisWeek });
		if (older.length > 0) groups.push({ label: 'Older', conversations: older });

		return groups;
	}

	$: groupedConversations = groupConversations(conversations);
</script>

<aside class="chat-sidebar" class:open={isOpen} aria-label="Chat history">
	<div class="sidebar-header">
		<button
			class="new-chat-button"
			on:click={handleNewChat}
			aria-label="New chat"
			title="Start a new conversation"
		>
			<svg
				width="18"
				height="18"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<line x1="12" y1="5" x2="12" y2="19" />
				<line x1="5" y1="12" x2="19" y2="12" />
			</svg>
			<span>New Chat</span>
		</button>
	</div>

	<div class="conversations-list">
		{#if conversations.length === 0}
			<div class="empty-state" in:fade={{ duration: 200 }}>
				<svg
					width="40"
					height="40"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.5"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
				</svg>
				<p>No conversations yet</p>
				<span>Start a new chat to begin</span>
			</div>
		{:else}
			{#each groupedConversations as group (group.label)}
				<div class="conversation-group" in:slide={{ duration: 200 }}>
					<div class="group-label">{group.label}</div>
					{#each group.conversations as conversation (conversation.id)}
						<button
							class="conversation-item"
							class:selected={conversation.id === currentId}
							data-conversation-id={conversation.id}
							data-selected={conversation.id === currentId}
							on:click={() => handleSelectConversation(conversation.id)}
							aria-label="Select conversation: {conversation.title}"
							title={conversation.title}
							in:fly={{ x: -20, duration: 200, easing: quintOut }}
						>
							<svg
								class="conversation-icon"
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
							</svg>
							<span class="conversation-title">{conversation.title}</span>
							<button
								class="delete-button"
								on:click={(e) => handleDeleteConversation(e, conversation.id)}
								aria-label="Delete conversation"
								title="Delete this conversation"
							>
								<svg
									width="14"
									height="14"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<polyline points="3 6 5 6 21 6" />
									<path
										d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
									/>
								</svg>
							</button>
						</button>
					{/each}
				</div>
			{/each}
		{/if}
	</div>
</aside>

<style>
	.chat-sidebar {
		display: flex;
		flex-direction: column;
		width: 280px;
		min-width: 280px;
		height: 100%;
		background: var(--color-surface);
		border-right: 1px solid var(--color-border);
		overflow: hidden;
		transition: all var(--transition-base);
	}

	.chat-sidebar:not(.open) {
		width: 0;
		min-width: 0;
		border-right: none;
	}

	.sidebar-header {
		padding: var(--spacing-md);
		border-bottom: 1px solid var(--color-border);
	}

	.new-chat-button {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--spacing-sm);
		width: 100%;
		padding: var(--spacing-sm) var(--spacing-md);
		background: var(--color-background);
		color: var(--color-text);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.new-chat-button:hover {
		background: var(--color-surface-hover);
		border-color: var(--color-primary);
		color: var(--color-primary);
	}

	.new-chat-button:active {
		transform: scale(0.98);
	}

	.conversations-list {
		flex: 1;
		overflow-y: auto;
		padding: var(--spacing-sm);
		scrollbar-width: thin;
		scrollbar-color: var(--color-border) transparent;
	}

	.conversations-list::-webkit-scrollbar {
		width: 6px;
	}

	.conversations-list::-webkit-scrollbar-track {
		background: transparent;
	}

	.conversations-list::-webkit-scrollbar-thumb {
		background: var(--color-border);
		border-radius: var(--radius-sm);
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		padding: var(--spacing-xl);
		text-align: center;
		color: var(--color-text-secondary);
	}

	.empty-state svg {
		margin-bottom: var(--spacing-md);
		opacity: 0.5;
	}

	.empty-state p {
		margin: 0;
		font-weight: 500;
		color: var(--color-text);
	}

	.empty-state span {
		font-size: 0.813rem;
		margin-top: var(--spacing-xs);
	}

	.conversation-group {
		margin-bottom: var(--spacing-md);
	}

	.group-label {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		color: var(--color-text-secondary);
		padding: var(--spacing-sm) var(--spacing-sm);
		letter-spacing: 0.05em;
	}

	.conversation-item {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		width: 100%;
		padding: var(--spacing-sm) var(--spacing-md);
		background: transparent;
		border: none;
		border-radius: var(--radius-md);
		cursor: pointer;
		text-align: left;
		color: var(--color-text);
		font-size: 0.875rem;
		transition: all var(--transition-fast);
		position: relative;
	}

	.conversation-item:hover {
		background: var(--color-surface-hover);
	}

	.conversation-item.selected {
		background: var(--color-primary-subtle, rgba(59, 130, 246, 0.1));
		color: var(--color-primary);
	}

	.conversation-item.selected .conversation-icon {
		color: var(--color-primary);
	}

	.conversation-icon {
		flex-shrink: 0;
		color: var(--color-text-secondary);
	}

	.conversation-title {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.delete-button {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--spacing-xs);
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		color: var(--color-text-secondary);
		cursor: pointer;
		opacity: 0;
		transition: all var(--transition-fast);
	}

	.conversation-item:hover .delete-button,
	.conversation-item:focus-within .delete-button {
		opacity: 1;
	}

	.delete-button:hover {
		background: var(--color-error);
		color: white;
	}

	@media (max-width: 768px) {
		.chat-sidebar {
			position: absolute;
			left: 0;
			top: 0;
			bottom: 0;
			z-index: 100;
			width: 280px;
		}

		.chat-sidebar:not(.open) {
			transform: translateX(-100%);
		}
	}
</style>
