import ChatInterface from '$lib/components/ChatInterface.svelte';
import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';

/**
 * Basic smoke tests for ChatInterface component
 * More comprehensive tests are in tests/unit/chat-interface.test.ts
 */

describe('ChatInterface Component - Basic Tests', () => {
	it('should render without crashing', () => {
		const { container } = render(ChatInterface);
		expect(container).toBeTruthy();
	});

	it('should render in text mode by default', () => {
		render(ChatInterface);
		expect(screen.getByPlaceholderText(/message ai assistant/i)).toBeTruthy();
	});

	it('should have accessible chat messages region', () => {
		render(ChatInterface);
		expect(screen.getByRole('region', { name: /chat messages/i })).toBeTruthy();
	});

	it('should render send button with aria label', () => {
		render(ChatInterface);
		expect(screen.getByRole('button', { name: /send message/i })).toBeTruthy();
	});

	it('should render voice toggle button when voice is available', () => {
		render(ChatInterface, { props: { voiceAvailable: true } });
		expect(screen.getByRole('button', { name: /start voice chat/i })).toBeTruthy();
	});

	it('should not render voice toggle button when voice is unavailable', () => {
		render(ChatInterface, { props: { voiceAvailable: false } });
		expect(screen.queryByRole('button', { name: /start voice chat/i })).toBeNull();
	});
});
