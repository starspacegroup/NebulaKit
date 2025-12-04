import {
	chatHistoryStore,
	type ChatHistoryState,
	type Conversation
} from '$lib/stores/chatHistory';
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('Chat History Store', () => {
	beforeEach(() => {
		// Reset store state before each test
		chatHistoryStore.reset();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('Initial state', () => {
		it('should have empty conversations initially', () => {
			const state = get(chatHistoryStore) as ChatHistoryState;
			expect(state.conversations).toEqual([]);
		});

		it('should have no current conversation initially', () => {
			const state = get(chatHistoryStore) as ChatHistoryState;
			expect(state.currentConversationId).toBeNull();
		});

		it('should not be loading initially', () => {
			const state = get(chatHistoryStore) as ChatHistoryState;
			expect(state.isLoading).toBe(false);
		});
	});

	describe('Creating conversations', () => {
		it('should create a new conversation', () => {
			const conversation = chatHistoryStore.createConversation();

			expect(conversation).toBeDefined();
			expect(conversation.id).toBeDefined();
			expect(conversation.title).toBe('New conversation');
			expect(conversation.messages).toEqual([]);
			expect(conversation.createdAt).toBeInstanceOf(Date);
			expect(conversation.updatedAt).toBeInstanceOf(Date);
		});

		it('should add the new conversation to the list', () => {
			const conversation = chatHistoryStore.createConversation();
			const state = get(chatHistoryStore) as ChatHistoryState;

			expect(state.conversations).toHaveLength(1);
			expect(state.conversations[0].id).toBe(conversation.id);
		});

		it('should set the new conversation as current', () => {
			const conversation = chatHistoryStore.createConversation();
			const state = get(chatHistoryStore) as ChatHistoryState;

			expect(state.currentConversationId).toBe(conversation.id);
		});

		it('should create conversation with custom title', () => {
			const conversation = chatHistoryStore.createConversation('My Custom Chat');

			expect(conversation.title).toBe('My Custom Chat');
		});
	});

	describe('Selecting conversations', () => {
		it('should select an existing conversation', () => {
			const conv1 = chatHistoryStore.createConversation('First');
			const conv2 = chatHistoryStore.createConversation('Second');

			chatHistoryStore.selectConversation(conv1.id);
			const state = get(chatHistoryStore) as ChatHistoryState;

			expect(state.currentConversationId).toBe(conv1.id);
		});

		it('should return the selected conversation messages', () => {
			const conv = chatHistoryStore.createConversation();
			chatHistoryStore.addMessage(conv.id, {
				role: 'user',
				content: 'Hello'
			});

			chatHistoryStore.selectConversation(conv.id);
			const messages = chatHistoryStore.getCurrentMessages();

			expect(messages).toHaveLength(1);
			expect(messages[0].content).toBe('Hello');
		});
	});

	describe('Managing messages', () => {
		it('should add a message to a conversation', () => {
			const conv = chatHistoryStore.createConversation();

			chatHistoryStore.addMessage(conv.id, {
				role: 'user',
				content: 'Hello, AI!'
			});

			const state = get(chatHistoryStore) as ChatHistoryState;
			const conversation = state.conversations.find((c: Conversation) => c.id === conv.id);

			expect(conversation?.messages).toHaveLength(1);
			expect(conversation?.messages[0].content).toBe('Hello, AI!');
			expect(conversation?.messages[0].role).toBe('user');
			expect(conversation?.messages[0].id).toBeDefined();
			expect(conversation?.messages[0].timestamp).toBeInstanceOf(Date);
		});

		it('should update conversation title based on first user message', () => {
			const conv = chatHistoryStore.createConversation();

			chatHistoryStore.addMessage(conv.id, {
				role: 'user',
				content: 'How do I bake a chocolate cake?'
			});

			const state = get(chatHistoryStore) as ChatHistoryState;
			const conversation = state.conversations.find((c: Conversation) => c.id === conv.id);

			expect(conversation?.title).toBe('How do I bake a chocolate cake?');
		});

		it('should truncate long titles', () => {
			const conv = chatHistoryStore.createConversation();

			chatHistoryStore.addMessage(conv.id, {
				role: 'user',
				content:
					'This is a very long message that should be truncated when used as a title for the conversation in the sidebar'
			});

			const state = get(chatHistoryStore) as ChatHistoryState;
			const conversation = state.conversations.find((c: Conversation) => c.id === conv.id);

			expect(conversation?.title.length).toBeLessThanOrEqual(53); // 50 chars + '...'
		});

		it('should update the conversation updatedAt when adding a message', () => {
			const conv = chatHistoryStore.createConversation();
			const originalUpdatedAt = conv.updatedAt;

			chatHistoryStore.addMessage(conv.id, {
				role: 'user',
				content: 'Hello'
			});

			const state = get(chatHistoryStore) as ChatHistoryState;
			const conversation = state.conversations.find((c: Conversation) => c.id === conv.id);

			// updatedAt should be set when adding a message (same or later time)
			expect(conversation?.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt.getTime());
		});
	});

	describe('Deleting conversations', () => {
		it('should delete a conversation', () => {
			const conv1 = chatHistoryStore.createConversation('First');
			const conv2 = chatHistoryStore.createConversation('Second');

			chatHistoryStore.deleteConversation(conv1.id);
			const state = get(chatHistoryStore) as ChatHistoryState;

			expect(state.conversations).toHaveLength(1);
			expect(state.conversations[0].id).toBe(conv2.id);
		});

		it('should clear currentConversationId when deleting current conversation', () => {
			const conv = chatHistoryStore.createConversation();

			chatHistoryStore.deleteConversation(conv.id);
			const state = get(chatHistoryStore) as ChatHistoryState;

			expect(state.currentConversationId).toBeNull();
		});

		it('should select another conversation after deleting current', () => {
			const conv1 = chatHistoryStore.createConversation('First');
			chatHistoryStore.createConversation('Second');

			// conv2 should be current
			const currentState = get(chatHistoryStore) as ChatHistoryState;
			chatHistoryStore.deleteConversation(currentState.currentConversationId!);
			const state = get(chatHistoryStore) as ChatHistoryState;

			// Should fallback to conv1
			expect(state.currentConversationId).toBe(conv1.id);
		});
	});

	describe('Renaming conversations', () => {
		it('should rename a conversation', () => {
			const conv = chatHistoryStore.createConversation('Original Title');

			chatHistoryStore.renameConversation(conv.id, 'New Title');
			const state = get(chatHistoryStore) as ChatHistoryState;
			const conversation = state.conversations.find((c: Conversation) => c.id === conv.id);

			expect(conversation?.title).toBe('New Title');
		});
	});

	describe('Clearing all conversations', () => {
		it('should clear all conversations', () => {
			chatHistoryStore.createConversation('First');
			chatHistoryStore.createConversation('Second');
			chatHistoryStore.createConversation('Third');

			chatHistoryStore.clearAll();
			const state = get(chatHistoryStore) as ChatHistoryState;

			expect(state.conversations).toEqual([]);
			expect(state.currentConversationId).toBeNull();
		});
	});

	describe('Sorting conversations', () => {
		it('should sort conversations by most recent first', () => {
			const conv1 = chatHistoryStore.createConversation('First');
			const conv2 = chatHistoryStore.createConversation('Second');
			const conv3 = chatHistoryStore.createConversation('Third');

			const state = get(chatHistoryStore) as ChatHistoryState;

			// Most recently created should be first
			expect(state.conversations[0].id).toBe(conv3.id);
			expect(state.conversations[1].id).toBe(conv2.id);
			expect(state.conversations[2].id).toBe(conv1.id);
		});
	});
});
