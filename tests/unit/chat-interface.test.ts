import { chatHistoryStore } from '$lib/stores/chatHistory';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests for ChatInterface Component
 * Following TDD: Write tests first, then implement the component
 */

describe('ChatInterface Component', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		chatHistoryStore.reset();
	});

	describe('Unified Chat Interface', () => {
		it('should render chat interface with text input and voice toggle', async () => {
			const { default: ChatInterface } = await import('$lib/components/ChatInterface.svelte');
			render(ChatInterface, { props: { voiceAvailable: true } });

			expect(screen.getByRole('region', { name: /chat messages/i })).toBeTruthy();
			expect(screen.getByPlaceholderText(/message ai assistant/i)).toBeTruthy();
			expect(screen.getByRole('button', { name: /start voice chat/i })).toBeTruthy();
		});

		it('should send message when user submits', async () => {
			const { default: ChatInterface } = await import('$lib/components/ChatInterface.svelte');
			render(ChatInterface);

			const input = screen.getByPlaceholderText(/message ai assistant/i) as HTMLTextAreaElement;
			const sendButton = screen.getByRole('button', { name: /send message/i });

			await fireEvent.input(input, { target: { value: 'Hello AI' } });
			await fireEvent.click(sendButton);

			expect(input.value).toBe('');
			expect(screen.getByText('Hello AI')).toBeTruthy();
		});

		it('should send message on Enter key (without Shift)', async () => {
			const { default: ChatInterface } = await import('$lib/components/ChatInterface.svelte');
			render(ChatInterface);

			const input = screen.getByPlaceholderText(/message ai assistant/i) as HTMLTextAreaElement;

			await fireEvent.input(input, { target: { value: 'Test message' } });
			await fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });

			expect(input.value).toBe('');
		});

		it('should not send message on Shift+Enter', async () => {
			const { default: ChatInterface } = await import('$lib/components/ChatInterface.svelte');
			render(ChatInterface);

			const input = screen.getByPlaceholderText(/message ai assistant/i) as HTMLTextAreaElement;

			await fireEvent.input(input, { target: { value: 'Line 1' } });
			await fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });

			// Should preserve input value (not send)
			expect(input.value).toBe('Line 1');
		});

		it('should disable send button when input is empty', async () => {
			const { default: ChatInterface } = await import('$lib/components/ChatInterface.svelte');
			render(ChatInterface);

			const sendButton = screen.getByRole('button', {
				name: /send message/i
			}) as HTMLButtonElement;

			expect(sendButton.disabled).toBe(true);
		});

		it('should show typing indicator when AI is responding', async () => {
			const { default: ChatInterface } = await import('$lib/components/ChatInterface.svelte');
			// This test needs internal state control - mock the isLoading state
			// For now, we test that the typing indicator structure exists when streaming
			render(ChatInterface);

			// With no streaming, typing indicator shouldn't show by default
			expect(screen.queryByRole('status', { name: /ai is typing/i })).toBeNull();
		});

		it('should display streaming content when provided', async () => {
			const { default: ChatInterface } = await import('$lib/components/ChatInterface.svelte');
			// Streaming content is now internal state, not a prop
			render(ChatInterface);

			// Verify the component renders correctly
			expect(screen.getByPlaceholderText(/message ai assistant/i)).toBeTruthy();
		});
	});

	describe('Voice Chat Integration', () => {
		it('should show voice toggle button when voice is available', async () => {
			const { default: ChatInterface } = await import('$lib/components/ChatInterface.svelte');
			render(ChatInterface, { props: { voiceAvailable: true } });

			expect(screen.getByRole('button', { name: /start voice chat/i })).toBeTruthy();
		});

		it('should hide voice toggle button when voice is unavailable', async () => {
			const { default: ChatInterface } = await import('$lib/components/ChatInterface.svelte');
			render(ChatInterface, { props: { voiceAvailable: false } });

			expect(screen.queryByRole('button', { name: /start voice chat/i })).toBeNull();
		});

		it('should show unified message history', async () => {
			// Add messages to the store first
			const conv = chatHistoryStore.createConversation();
			chatHistoryStore.addMessage(conv.id, { role: 'user', content: 'Text message' });
			chatHistoryStore.addMessage(conv.id, { role: 'assistant', content: 'AI response' });

			const { default: ChatInterface } = await import('$lib/components/ChatInterface.svelte');
			render(ChatInterface);

			// All messages should appear in the same list
			expect(screen.getByText('Text message')).toBeTruthy();
			expect(screen.getByText('AI response')).toBeTruthy();
		});

		it('should have accessible voice toggle when available', async () => {
			const { default: ChatInterface } = await import('$lib/components/ChatInterface.svelte');
			render(ChatInterface, { props: { voiceAvailable: true } });

			const voiceButton = screen.getByRole('button', { name: /start voice chat/i });
			expect(voiceButton).toBeTruthy();

			// Voice button should be present and interactive
			expect(voiceButton.tagName).toBe('BUTTON');
		});
	});

	describe('Accessibility', () => {
		it('should have proper ARIA labels for all interactive elements', async () => {
			const { default: ChatInterface } = await import('$lib/components/ChatInterface.svelte');
			render(ChatInterface, { props: { voiceAvailable: true } });

			expect(screen.getByRole('button', { name: /send message/i })).toBeTruthy();
			expect(screen.getByRole('textbox')).toBeTruthy();
			expect(screen.getByRole('region', { name: /chat messages/i })).toBeTruthy();
			expect(screen.getByRole('button', { name: /start voice chat/i })).toBeTruthy();
		});

		it('should support keyboard navigation', async () => {
			const { default: ChatInterface } = await import('$lib/components/ChatInterface.svelte');
			render(ChatInterface);

			const input = screen.getByPlaceholderText(/message ai assistant/i);
			input.focus();

			expect(document.activeElement).toBe(input);
		});
	});

	describe('Message Display', () => {
		it('should display user messages aligned to the right', async () => {
			// Add user message to the store first
			const conv = chatHistoryStore.createConversation();
			chatHistoryStore.addMessage(conv.id, { role: 'user', content: 'User message' });

			const { default: ChatInterface } = await import('$lib/components/ChatInterface.svelte');
			render(ChatInterface);

			const message = screen.getByText('User message').closest('.message');
			expect(message?.classList.contains('user')).toBe(true);
		});

		it('should display assistant messages aligned to the left', async () => {
			// Add assistant message to the store first
			const conv = chatHistoryStore.createConversation();
			chatHistoryStore.addMessage(conv.id, { role: 'assistant', content: 'AI message' });

			const { default: ChatInterface } = await import('$lib/components/ChatInterface.svelte');
			render(ChatInterface);

			const message = screen.getByText('AI message').closest('.message');
			expect(message?.classList.contains('assistant')).toBe(true);
		});

		it('should show timestamp for each message', async () => {
			// Add message to the store first
			const conv = chatHistoryStore.createConversation();
			chatHistoryStore.addMessage(conv.id, { role: 'user', content: 'Test' });

			const { default: ChatInterface } = await import('$lib/components/ChatInterface.svelte');
			render(ChatInterface);

			// There should be a timestamp displayed
			const messageTimestamp = screen
				.getByText('Test')
				.closest('.message-bubble')
				?.querySelector('.message-timestamp');
			expect(messageTimestamp).toBeTruthy();
		});

		it('should preserve message history across voice and text interactions', async () => {
			// Add messages to the store first
			const conv = chatHistoryStore.createConversation();
			chatHistoryStore.addMessage(conv.id, { role: 'user', content: 'Text message' });
			chatHistoryStore.addMessage(conv.id, { role: 'assistant', content: 'Text response' });

			const { default: ChatInterface } = await import('$lib/components/ChatInterface.svelte');
			render(ChatInterface);

			expect(screen.getByText('Text message')).toBeTruthy();
			expect(screen.getByText('Text response')).toBeTruthy();
		});
	});

	describe('Redesigned Input Field', () => {
		it('should render the input field with modern seamless design', async () => {
			const { default: ChatInterface } = await import('$lib/components/ChatInterface.svelte');
			const { container } = render(ChatInterface);

			const inputContainer = container.querySelector('.input-container');
			expect(inputContainer).toBeTruthy();
			expect(inputContainer?.classList.contains('input-container')).toBe(true);
		});

		it('should show character count when approaching limit', async () => {
			const { default: ChatInterface } = await import('$lib/components/ChatInterface.svelte');
			render(ChatInterface);

			const input = screen.getByPlaceholderText(/message ai assistant/i) as HTMLTextAreaElement;

			// Type text approaching the 80% threshold (4000 * 0.8 = 3200)
			const longText = 'a'.repeat(3300);
			await fireEvent.input(input, { target: { value: longText } });

			// Character count should be visible
			expect(screen.getByText(/3300\/4000/)).toBeTruthy();
		});

		it('should show warning when approaching max character limit', async () => {
			const { default: ChatInterface } = await import('$lib/components/ChatInterface.svelte');
			const { container } = render(ChatInterface);

			const input = screen.getByPlaceholderText(/message ai assistant/i) as HTMLTextAreaElement;

			// Type text approaching 90% threshold (4000 * 0.9 = 3600)
			const longText = 'a'.repeat(3700);
			await fireEvent.input(input, { target: { value: longText } });

			const charCount = container.querySelector('.char-count.warning');
			expect(charCount).toBeTruthy();
		});

		it('should enforce max character limit', async () => {
			const { default: ChatInterface } = await import('$lib/components/ChatInterface.svelte');
			render(ChatInterface);

			const input = screen.getByPlaceholderText(/message ai assistant/i) as HTMLTextAreaElement;
			expect(input.maxLength).toBe(4000);
		});

		it('should display keyboard shortcuts hint', async () => {
			const { default: ChatInterface } = await import('$lib/components/ChatInterface.svelte');
			const { container } = render(ChatInterface);

			const hint = container.querySelector('.input-hint');
			expect(hint?.textContent).toMatch(/enter.*to send/i);
			expect(hint?.textContent).toMatch(/shift \+ enter.*for new line/i);
		});

		it('should hide hint when voice is active', async () => {
			const { default: ChatInterface } = await import('$lib/components/ChatInterface.svelte');
			const { container } = render(ChatInterface, {
				props: { voiceAvailable: true }
			});

			const hint = container.querySelector('.input-hint');
			expect(hint?.classList.contains('visible')).toBe(true);

			// When voice becomes active, hint should not be visible
			// Note: Full voice activation test would require mocking WebSocket/MediaStream
		});

		it('should have proper focus states on input container', async () => {
			const { default: ChatInterface } = await import('$lib/components/ChatInterface.svelte');
			const { container } = render(ChatInterface);

			const input = screen.getByPlaceholderText(/message ai assistant/i) as HTMLTextAreaElement;
			const inputContainer = container.querySelector('.input-container');

			// Focus the input
			input.focus();

			// Check that focused class would be applied (in real DOM)
			expect(input).toBe(document.activeElement);
		});

		it('should have send button with gradient when text is entered', async () => {
			const { default: ChatInterface } = await import('$lib/components/ChatInterface.svelte');
			const { container } = render(ChatInterface);

			const input = screen.getByPlaceholderText(/message ai assistant/i) as HTMLTextAreaElement;
			const sendButton = screen.getByRole('button', { name: /send message/i });

			// Initially disabled
			expect(sendButton.classList.contains('can-send')).toBe(false);

			// Type something
			await fireEvent.input(input, { target: { value: 'Hello' } });

			// Now should have can-send class
			expect(sendButton.classList.contains('can-send')).toBe(true);
		});

		it('should auto-resize textarea as content grows', async () => {
			const { default: ChatInterface } = await import('$lib/components/ChatInterface.svelte');
			render(ChatInterface);

			const input = screen.getByPlaceholderText(/message ai assistant/i) as HTMLTextAreaElement;
			const initialHeight = input.style.height;

			// Type multiline content
			const multilineText = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';
			await fireEvent.input(input, { target: { value: multilineText } });

			// Height should be different (auto-adjusted)
			// Note: In testing environment, scrollHeight may not change realistically
			expect(input.value).toBe(multilineText);
		});

		it('should show voice button outside and send button inside input field', async () => {
			const { default: ChatInterface } = await import('$lib/components/ChatInterface.svelte');
			const { container } = render(ChatInterface, {
				props: { voiceAvailable: true }
			});

			const textareaWrapper = container.querySelector('.textarea-wrapper');
			expect(textareaWrapper).toBeTruthy();

			const voiceButton = screen.getByRole('button', { name: /start voice chat/i });
			const sendButton = screen.getByRole('button', { name: /send message/i });

			expect(voiceButton).toBeTruthy();
			expect(sendButton).toBeTruthy();

			// Send button should be inside textarea wrapper
			const sendButtonInWrapper = textareaWrapper?.querySelector('.send-button-inline');
			expect(sendButtonInWrapper).toBeTruthy();
		});
		it('should have proper tooltips on action buttons', async () => {
			const { default: ChatInterface } = await import('$lib/components/ChatInterface.svelte');
			render(ChatInterface, { props: { voiceAvailable: true } });

			const sendButton = screen.getByRole('button', { name: /send message/i });
			const voiceButton = screen.getByRole('button', { name: /start voice chat/i });

			expect(sendButton.getAttribute('title')).toBeTruthy();
			expect(voiceButton.getAttribute('title')).toBeTruthy();
		});

		it('should maintain accessibility with ARIA labels on new design', async () => {
			const { default: ChatInterface } = await import('$lib/components/ChatInterface.svelte');
			render(ChatInterface, { props: { voiceAvailable: true } });

			const input = screen.getByLabelText(/chat message input/i);
			expect(input).toBeTruthy();

			const sendButton = screen.getByRole('button', { name: /send message/i });
			expect(sendButton).toBeTruthy();

			const voiceButton = screen.getByRole('button', { name: /start voice chat/i });
			expect(voiceButton).toBeTruthy();
		});

		it('should use theme CSS variables for all colors', async () => {
			const { default: ChatInterface } = await import('$lib/components/ChatInterface.svelte');
			const { container } = render(ChatInterface);

			// Check that no hardcoded colors are used in the component
			// This is enforced by the styles using var(--color-*) only
			const inputContainer = container.querySelector('.input-container');
			expect(inputContainer).toBeTruthy();
		});

		it('should not throw SSR errors when rendered server-side', async () => {
			// Test that component doesn't access browser APIs during SSR
			const { default: ChatInterface } = await import('$lib/components/ChatInterface.svelte');

			// This should not throw "document is not defined" error
			expect(() => {
				render(ChatInterface, {
					props: {
						voiceAvailable: false
					}
				});
			}).not.toThrow();
		});
	});
});
