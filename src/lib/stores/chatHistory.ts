import { derived, get, writable } from 'svelte/store';

export interface Message {
	id: string;
	role: 'user' | 'assistant' | 'system';
	content: string;
	timestamp: Date;
}

export interface Conversation {
	id: string;
	title: string;
	messages: Message[];
	createdAt: Date;
	updatedAt: Date;
}

export interface ChatHistoryState {
	conversations: Conversation[];
	currentConversationId: string | null;
	isLoading: boolean;
	isSidebarOpen: boolean;
	userId: string | null;
}

const STORAGE_KEY_PREFIX = 'nebulakit_chat_history';
const MAX_TITLE_LENGTH = 50;

function getStorageKey(userId: string | null): string {
	if (!userId) return STORAGE_KEY_PREFIX;
	return `${STORAGE_KEY_PREFIX}_${userId}`;
}

function generateId(): string {
	return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function truncateTitle(text: string): string {
	if (text.length <= MAX_TITLE_LENGTH) return text;
	return text.substring(0, MAX_TITLE_LENGTH) + '...';
}

function loadFromStorage(userId: string | null): ChatHistoryState {
	if (typeof window === 'undefined') {
		return createInitialState(userId);
	}

	try {
		const storageKey = getStorageKey(userId);
		const stored = localStorage.getItem(storageKey);
		if (stored) {
			const parsed = JSON.parse(stored);
			// Convert date strings back to Date objects
			return {
				...parsed,
				userId,
				conversations: parsed.conversations.map((conv: any) => ({
					...conv,
					createdAt: new Date(conv.createdAt),
					updatedAt: new Date(conv.updatedAt),
					messages: conv.messages.map((msg: any) => ({
						...msg,
						timestamp: new Date(msg.timestamp)
					}))
				}))
			};
		}
	} catch (e) {
		console.error('Failed to load chat history from storage:', e);
	}

	return createInitialState(userId);
}

function saveToStorage(state: ChatHistoryState): void {
	if (typeof window === 'undefined') return;
	if (!state.userId) return; // Don't save if no user is logged in

	try {
		const storageKey = getStorageKey(state.userId);
		localStorage.setItem(storageKey, JSON.stringify(state));
	} catch (e) {
		console.error('Failed to save chat history to storage:', e);
	}
}

function createInitialState(userId: string | null = null): ChatHistoryState {
	return {
		conversations: [],
		currentConversationId: null,
		isLoading: false,
		isSidebarOpen: true,
		userId
	};
}

function createChatHistoryStore() {
	const store = writable<ChatHistoryState>(createInitialState());
	const { subscribe, set, update } = store;

	// Subscribe to changes and persist
	subscribe((state) => {
		saveToStorage(state);
	});

	return {
		subscribe,

		/**
		 * Initialize the store for a specific user
		 * This loads the user's chat history from storage
		 */
		initializeForUser(userId: string): void {
			const storedState = loadFromStorage(userId);
			set(storedState);
		},

		reset(): void {
			const currentState = get(store);
			set(createInitialState(currentState.userId));
		},

		createConversation(title: string = 'New conversation'): Conversation {
			const now = new Date();
			const conversation: Conversation = {
				id: generateId(),
				title,
				messages: [],
				createdAt: now,
				updatedAt: now
			};

			update((state) => ({
				...state,
				conversations: [conversation, ...state.conversations],
				currentConversationId: conversation.id
			}));

			return conversation;
		},

		selectConversation(id: string): void {
			update((state) => ({
				...state,
				currentConversationId: id
			}));
		},

		getCurrentMessages(): Message[] {
			const state = get(store);
			if (!state.currentConversationId) return [];

			const conversation = state.conversations.find((c) => c.id === state.currentConversationId);
			return conversation?.messages || [];
		},

		getCurrentConversation(): Conversation | null {
			const state = get(store);
			if (!state.currentConversationId) return null;

			return state.conversations.find((c) => c.id === state.currentConversationId) || null;
		},

		addMessage(
			conversationId: string,
			message: { role: 'user' | 'assistant' | 'system'; content: string }
		): Message {
			const newMessage: Message = {
				id: generateId(),
				role: message.role,
				content: message.content,
				timestamp: new Date()
			};

			update((state) => {
				const conversations = state.conversations.map((conv) => {
					if (conv.id !== conversationId) return conv;

					// Update title from first user message if still default
					let title = conv.title;
					if (
						conv.title === 'New conversation' &&
						message.role === 'user' &&
						conv.messages.length === 0
					) {
						title = truncateTitle(message.content);
					}

					return {
						...conv,
						title,
						messages: [...conv.messages, newMessage],
						updatedAt: new Date()
					};
				});

				return {
					...state,
					conversations
				};
			});

			return newMessage;
		},

		updateMessage(conversationId: string, messageId: string, content: string): void {
			update((state) => ({
				...state,
				conversations: state.conversations.map((conv) => {
					if (conv.id !== conversationId) return conv;

					return {
						...conv,
						messages: conv.messages.map((msg) =>
							msg.id === messageId ? { ...msg, content } : msg
						),
						updatedAt: new Date()
					};
				})
			}));
		},

		deleteConversation(id: string): void {
			update((state) => {
				const newConversations = state.conversations.filter((c) => c.id !== id);
				let newCurrentId = state.currentConversationId;

				// If we deleted the current conversation, select another one
				if (state.currentConversationId === id) {
					newCurrentId = newConversations.length > 0 ? newConversations[0].id : null;
				}

				return {
					...state,
					conversations: newConversations,
					currentConversationId: newCurrentId
				};
			});
		},

		renameConversation(id: string, title: string): void {
			update((state) => ({
				...state,
				conversations: state.conversations.map((conv) =>
					conv.id === id ? { ...conv, title, updatedAt: new Date() } : conv
				)
			}));
		},

		clearAll(): void {
			update((state) => ({
				...state,
				conversations: [],
				currentConversationId: null
			}));
		},

		toggleSidebar(): void {
			update((state) => ({
				...state,
				isSidebarOpen: !state.isSidebarOpen
			}));
		},

		setSidebarOpen(isOpen: boolean): void {
			update((state) => ({
				...state,
				isSidebarOpen: isOpen
			}));
		},

		setLoading(isLoading: boolean): void {
			update((state) => ({
				...state,
				isLoading
			}));
		}
	};
}

export const chatHistoryStore = createChatHistoryStore();

// Derived store for the current conversation
export const currentConversation = derived(chatHistoryStore, ($store) => {
	if (!$store.currentConversationId) return null;
	return $store.conversations.find((c) => c.id === $store.currentConversationId) || null;
});

// Derived store for current messages
export const currentMessages = derived(
	currentConversation,
	($conversation) => $conversation?.messages || []
);
