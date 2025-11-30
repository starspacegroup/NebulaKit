import VoiceButton from '$lib/components/VoiceButton.svelte';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('VoiceButton', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('Rendering', () => {
		it('should render the voice button', () => {
			render(VoiceButton);
			const button = screen.getByRole('button');
			expect(button).toBeTruthy();
		});

		it('should show static wave bars when inactive', () => {
			render(VoiceButton, { isActive: false });
			const waveContainer = document.querySelector('.wave-container');
			expect(waveContainer).toBeTruthy();
			const bars = document.querySelectorAll('.wave-bar.static');
			expect(bars.length).toBe(5); // 5 static bars
		});

		it('should show wave bars when active and listening', () => {
			render(VoiceButton, { isActive: true, state: 'listening' });
			const waveContainer = document.querySelector('.wave-container');
			expect(waveContainer).toBeTruthy();
			const bars = document.querySelectorAll('.wave-bar');
			expect(bars.length).toBe(5); // 5 bars as defined in component
		});

		it('should show wave bars when active and processing', () => {
			render(VoiceButton, { isActive: true, state: 'processing' });
			const waveContainer = document.querySelector('.wave-container');
			expect(waveContainer).toBeTruthy();
		});

		it('should show wave bars when active and speaking', () => {
			render(VoiceButton, { isActive: true, state: 'speaking' });
			const waveContainer = document.querySelector('.wave-container');
			expect(waveContainer).toBeTruthy();
		});

		it('should show stop icon when active but idle', () => {
			render(VoiceButton, { isActive: true, state: 'idle' });
			const button = screen.getByRole('button');
			expect(button.innerHTML).toContain('rect'); // Stop icon is a rect
		});
	});

	describe('Accessibility', () => {
		it('should have appropriate label when inactive', () => {
			render(VoiceButton, { isActive: false });
			const button = screen.getByRole('button');
			expect(button.getAttribute('aria-label')).toBe('Start voice chat');
			expect(button.getAttribute('title')).toBe('Start voice chat');
		});

		it('should have appropriate label when listening', () => {
			render(VoiceButton, { isActive: true, state: 'listening' });
			const button = screen.getByRole('button');
			expect(button.getAttribute('aria-label')).toBe('Listening to your voice');
			expect(button.getAttribute('title')).toBe('Listening to your voice');
		});

		it('should have appropriate label when processing', () => {
			render(VoiceButton, { isActive: true, state: 'processing' });
			const button = screen.getByRole('button');
			expect(button.getAttribute('aria-label')).toBe('Processing your message');
			expect(button.getAttribute('title')).toBe('Processing your message');
		});

		it('should have appropriate label when speaking', () => {
			render(VoiceButton, { isActive: true, state: 'speaking' });
			const button = screen.getByRole('button');
			expect(button.getAttribute('aria-label')).toBe('AI is responding');
			expect(button.getAttribute('title')).toBe('AI is responding');
		});

		it('should have appropriate label when active but idle', () => {
			render(VoiceButton, { isActive: true, state: 'idle' });
			const button = screen.getByRole('button');
			expect(button.getAttribute('aria-label')).toBe('Stop voice chat');
			expect(button.getAttribute('title')).toBe('Stop voice chat');
		});

		it('should hide decorative elements from screen readers', () => {
			render(VoiceButton, { isActive: false });
			const waveContainer = document.querySelector('.wave-container');
			expect(waveContainer?.getAttribute('aria-hidden')).toBe('true');
		});
	});

	describe('Button States', () => {
		it('should apply inactive class when not active', () => {
			render(VoiceButton, { isActive: false });
			const button = screen.getByRole('button');
			expect(button.classList.contains('inactive')).toBe(true);
		});

		it('should apply listening class when active and listening', () => {
			render(VoiceButton, { isActive: true, state: 'listening' });
			const button = screen.getByRole('button');
			expect(button.classList.contains('active')).toBe(true);
			expect(button.classList.contains('listening')).toBe(true);
		});

		it('should apply processing class when active and processing', () => {
			render(VoiceButton, { isActive: true, state: 'processing' });
			const button = screen.getByRole('button');
			expect(button.classList.contains('active')).toBe(true);
			expect(button.classList.contains('processing')).toBe(true);
		});

		it('should apply speaking class when active and speaking', () => {
			render(VoiceButton, { isActive: true, state: 'speaking' });
			const button = screen.getByRole('button');
			expect(button.classList.contains('active')).toBe(true);
			expect(button.classList.contains('speaking')).toBe(true);
		});

		it('should be disabled when disabled prop is true', () => {
			render(VoiceButton, { disabled: true });
			const button = screen.getByRole('button');
			expect(button.hasAttribute('disabled')).toBe(true);
		});

		it('should not be disabled when disabled prop is false', () => {
			render(VoiceButton, { disabled: false });
			const button = screen.getByRole('button');
			expect(button.hasAttribute('disabled')).toBe(false);
		});
	});

	describe('Interactions', () => {
		it('should call onClick handler when clicked', async () => {
			const onClick = vi.fn();
			render(VoiceButton, { onClick });

			const button = screen.getByRole('button');
			await fireEvent.click(button);

			expect(onClick).toHaveBeenCalledTimes(1);
		});

		it('should not call onClick when disabled', async () => {
			const onClick = vi.fn();
			render(VoiceButton, { onClick, disabled: true });

			const button = screen.getByRole('button');
			await fireEvent.click(button);

			// onClick should not be called because button is disabled
			expect(onClick).toHaveBeenCalledTimes(0);
		});

		it('should call onClick multiple times when clicked multiple times', async () => {
			const onClick = vi.fn();
			render(VoiceButton, { onClick });

			const button = screen.getByRole('button');
			await fireEvent.click(button);
			await fireEvent.click(button);
			await fireEvent.click(button);

			expect(onClick).toHaveBeenCalledTimes(3);
		});
	});

	describe('Animation', () => {
		it('should show wave bars when active and animating', () => {
			render(VoiceButton, { isActive: true, state: 'listening' });
			const bars = document.querySelectorAll('.wave-bar');
			expect(bars.length).toBe(5);
		});

		it('should show static wave bars when inactive', () => {
			render(VoiceButton, { isActive: false, state: 'idle' });
			const bars = document.querySelectorAll('.wave-bar.static');
			expect(bars.length).toBe(5);
		});

		it('should have height styles on wave bars', () => {
			render(VoiceButton, { isActive: true, state: 'listening' });
			const bars = document.querySelectorAll('.wave-bar');
			bars.forEach((bar) => {
				expect((bar as HTMLElement).style.height).toBeTruthy();
			});
		});
	});

	describe('State Transitions', () => {
		it('should update display when state changes from idle to listening', async () => {
			const { component } = render(VoiceButton, { isActive: true, state: 'idle' });

			// Initially should show stop icon
			let button = screen.getByRole('button');
			expect(button.innerHTML).toContain('rect');

			// Update to listening state
			await component.$set({ state: 'listening' });

			// Should now show wave bars
			const waveContainer = document.querySelector('.wave-container');
			expect(waveContainer).toBeTruthy();
		});

		it('should update label when state changes', async () => {
			const { component } = render(VoiceButton, { isActive: true, state: 'listening' });

			let button = screen.getByRole('button');
			expect(button.getAttribute('aria-label')).toBe('Listening to your voice');

			await component.$set({ state: 'processing' });
			expect(button.getAttribute('aria-label')).toBe('Processing your message');

			await component.$set({ state: 'speaking' });
			expect(button.getAttribute('aria-label')).toBe('AI is responding');
		});

		it('should update classes when state changes', async () => {
			const { component } = render(VoiceButton, { isActive: true, state: 'listening' });

			let button = screen.getByRole('button');
			expect(button.classList.contains('listening')).toBe(true);

			await component.$set({ state: 'processing' });
			expect(button.classList.contains('listening')).toBe(false);
			expect(button.classList.contains('processing')).toBe(true);

			await component.$set({ state: 'speaking' });
			expect(button.classList.contains('processing')).toBe(false);
			expect(button.classList.contains('speaking')).toBe(true);
		});
	});

	describe('CSS Classes', () => {
		it('should have voice-button class', () => {
			render(VoiceButton);
			const button = screen.getByRole('button');
			expect(button.classList.contains('voice-button')).toBe(true);
		});

		it('should have button-content wrapper', () => {
			render(VoiceButton);
			const buttonContent = document.querySelector('.button-content');
			expect(buttonContent).toBeTruthy();
		});

		it('should apply all relevant classes for each state', () => {
			const states: Array<'idle' | 'listening' | 'processing' | 'speaking'> = [
				'idle',
				'listening',
				'processing',
				'speaking'
			];

			states.forEach((state) => {
				const { unmount } = render(VoiceButton, { isActive: true, state });
				const button = screen.getByRole('button');

				expect(button.classList.contains('voice-button')).toBe(true);
				expect(button.classList.contains('active')).toBe(true);

				if (state !== 'idle') {
					expect(button.classList.contains(state)).toBe(true);
				}

				unmount();
			});
		});
	});
});
