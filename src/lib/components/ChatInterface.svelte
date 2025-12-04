<script lang="ts">
	import { chatHistoryStore, currentMessages } from '$lib/stores/chatHistory';
	import { onDestroy, onMount } from 'svelte';
	import { quintOut } from 'svelte/easing';
	import { fade, fly } from 'svelte/transition';
	import VoiceButton from './VoiceButton.svelte';

	// Voice availability is passed from server - defaults to false for safety
	export let voiceAvailable = false;

	// Use store-based messages
	$: messages = $currentMessages.map((msg) => ({
		...msg,
		timestamp: msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp)
	}));

	let isLoading = false;
	let streamingContent = '';

	let input = '';
	let chatContainer: HTMLDivElement;
	let textareaElement: HTMLTextAreaElement;
	let audioContext: AudioContext | null = null;
	let mediaStream: MediaStream | null = null;
	let realtimeWs: WebSocket | null = null;
	let isVoiceActive = false;
	let voiceState: 'idle' | 'listening' | 'processing' | 'speaking' = 'idle';
	let currentUserTranscript = '';
	let currentAssistantId: string | null = null;
	let pendingUserMessageId: string | null = null;
	let isFocused = false;
	let audioQueue: ArrayBuffer[] = [];
	let isPlayingAudio = false;
	let audioProcessor: ScriptProcessorNode | null = null;
	let sessionConfigured = false;

	// Input state
	const MAX_INPUT_LENGTH = 4000;
	$: inputLength = input.length;
	$: canSend = input.trim().length > 0 && !isLoading && !isVoiceActive;
	$: showCharCount = inputLength > MAX_INPUT_LENGTH * 0.8;

	onMount(() => {
		scrollToBottom();
		autoResizeTextarea();
	});

	onDestroy(() => {
		if (realtimeWs) {
			realtimeWs.close();
		}
		if (mediaStream) {
			mediaStream.getTracks().forEach((track) => track.stop());
		}
		if (audioProcessor) {
			audioProcessor.disconnect();
		}
		if (audioContext) {
			audioContext.close();
		}
	});

	function scrollToBottom() {
		if (chatContainer && chatContainer.scrollHeight) {
			setTimeout(() => {
				if (chatContainer) {
					chatContainer.scrollTop = chatContainer.scrollHeight;
				}
			}, 100);
		}
	}

	function autoResizeTextarea() {
		if (textareaElement) {
			textareaElement.style.height = 'auto';
			textareaElement.style.height = textareaElement.scrollHeight + 'px';
		}
	}

	async function sendMessage() {
		if (!canSend) return;

		// Ensure we have a current conversation
		let conversationId = $chatHistoryStore.currentConversationId;
		if (!conversationId) {
			const conv = chatHistoryStore.createConversation();
			conversationId = conv.id;
		}

		// Add user message to store
		chatHistoryStore.addMessage(conversationId, {
			role: 'user',
			content: input.trim()
		});

		input = '';
		isLoading = true;
		autoResizeTextarea();
		scrollToBottom();

		try {
			// Stream response from API
			const response = await fetch('/api/chat/stream', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ messages: $currentMessages })
			});

			if (!response.ok) {
				throw new Error('Failed to send message');
			}

			const reader = response.body?.getReader();
			if (!reader) throw new Error('No response body');

			const decoder = new TextDecoder();
			let assistantContent = '';

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				const chunk = decoder.decode(value);
				const lines = chunk.split('\n');

				for (const line of lines) {
					if (line.startsWith('data: ')) {
						const data = line.slice(6);
						if (data === '[DONE]') continue;

						try {
							const parsed = JSON.parse(data);
							if (parsed.content) {
								assistantContent += parsed.content;
								streamingContent = assistantContent;
							}
						} catch (e) {
							console.error('Failed to parse SSE:', e);
						}
					}
				}
			}

			// Add complete assistant message to store
			chatHistoryStore.addMessage(conversationId, {
				role: 'assistant',
				content: assistantContent
			});
			streamingContent = '';
		} catch (err) {
			console.error('Send message error:', err);
			// Show error message
			chatHistoryStore.addMessage(conversationId, {
				role: 'assistant',
				content: 'Sorry, I encountered an error. Please try again.'
			});
		} finally {
			isLoading = false;
			scrollToBottom();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	}

	async function toggleVoiceChat() {
		if (isVoiceActive) {
			stopVoiceChat();
		} else {
			await startVoiceChat();
		}
	}

	async function startVoiceChat() {
		try {
			// Get ephemeral token
			const response = await fetch('/api/chat/voice/session', {
				method: 'POST'
			});

			if (!response.ok) {
				if (response.status === 403) {
					// Voice chat not enabled
					voiceAvailable = false;
					const errorData = await response
						.json()
						.catch(() => ({ error: 'Voice chat is not enabled' }));
					alert(
						errorData.error || 'Voice chat is not enabled. Please enable it in admin settings.'
					);
					return;
				}
				throw new Error('Failed to create voice session');
			}

			const { token, model } = await response.json();

			// Get microphone access with specific constraints for OpenAI Realtime API
			mediaStream = await navigator.mediaDevices.getUserMedia({
				audio: {
					channelCount: 1, // Mono
					echoCancellation: true,
					noiseSuppression: true
				}
			});

			// Setup audio context - browser will handle sample rate
			audioContext = new AudioContext();

			const source = audioContext.createMediaStreamSource(mediaStream);

			// Setup audio processor to capture and send audio to WebSocket
			// Using ScriptProcessorNode (deprecated but widely supported)
			const bufferSize = 4096;
			audioProcessor = audioContext.createScriptProcessor(bufferSize, 1, 1);

			source.connect(audioProcessor);
			audioProcessor.connect(audioContext.destination);

			// Set voice active BEFORE connecting WebSocket so UI updates
			isVoiceActive = true;
			voiceState = 'listening';

			// Connect to OpenAI Realtime API via WebSocket
			const wsModel = model || 'gpt-4o-realtime-preview-2024-12-17';
			console.log('Connecting to OpenAI Realtime API with model:', wsModel);
			console.log('Token length:', token?.length, 'Token prefix:', token?.substring(0, 20) + '...');

			realtimeWs = new WebSocket(`wss://api.openai.com/v1/realtime?model=${wsModel}`, [
				'realtime',
				`openai-insecure-api-key.${token}`,
				'openai-beta.realtime-v1'
			]);

			realtimeWs.onopen = () => {
				console.log('Voice chat WebSocket connected successfully');
				console.log('WebSocket readyState:', realtimeWs?.readyState);
				// Don't send session.update here - wait for session.created event
			};

			// Setup audio processor callback (will only send when sessionConfigured is true)
			if (audioProcessor) {
				audioProcessor.onaudioprocess = (e) => {
					// Only send audio after session is configured
					if (!sessionConfigured || !realtimeWs || realtimeWs.readyState !== WebSocket.OPEN) return;

					const inputData = e.inputBuffer.getChannelData(0);

					// Resample to 24kHz if needed (OpenAI expects 24kHz)
					const targetSampleRate = 24000;
					const currentSampleRate = audioContext?.sampleRate || 48000;

					let resampledData: Float32Array;
					if (currentSampleRate !== targetSampleRate) {
						const ratio = currentSampleRate / targetSampleRate;
						const newLength = Math.floor(inputData.length / ratio);
						resampledData = new Float32Array(newLength);
						for (let i = 0; i < newLength; i++) {
							resampledData[i] = inputData[Math.floor(i * ratio)];
						}
					} else {
						resampledData = inputData;
					}

					// Convert Float32 to Int16 PCM
					const pcm16 = new Int16Array(resampledData.length);
					for (let i = 0; i < resampledData.length; i++) {
						// Clamp to [-1, 1] and convert to Int16 range
						const s = Math.max(-1, Math.min(1, resampledData[i]));
						pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
					}

					// Convert to base64
					const base64 = arrayBufferToBase64(pcm16.buffer);

					// Send to OpenAI
					realtimeWs.send(
						JSON.stringify({
							type: 'input_audio_buffer.append',
							audio: base64
						})
					);
				};
			}

			realtimeWs.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data);

					// Log ALL events for debugging
					console.log('Realtime event received:', data.type, data);

					// Handle session.created - now we can configure our session
					if (data.type === 'session.created') {
						console.log('Session created:', data.session?.id);
						console.log('Full session data:', JSON.stringify(data.session, null, 2));
						// Now send our session configuration
						if (realtimeWs && realtimeWs.readyState === WebSocket.OPEN) {
							const sessionConfig = {
								type: 'session.update',
								session: {
									modalities: ['text', 'audio'],
									voice: 'alloy',
									input_audio_format: 'pcm16',
									output_audio_format: 'pcm16',
									input_audio_transcription: {
										model: 'whisper-1'
									},
									turn_detection: {
										type: 'server_vad',
										threshold: 0.5,
										prefix_padding_ms: 300,
										silence_duration_ms: 500
									},
									temperature: 0.8
								}
							};
							console.log('Sending session.update:', JSON.stringify(sessionConfig, null, 2));
							realtimeWs.send(JSON.stringify(sessionConfig));
						}
					}

					// Handle session.updated - session is now fully configured, can start audio
					if (data.type === 'session.updated') {
						console.log('Session configured and ready:', data.session?.id);
						sessionConfigured = true;
					}

					// Track when user starts speaking
					if (data.type === 'input_audio_buffer.speech_started') {
						voiceState = 'listening';
					}

					// Track when user stops speaking (processing begins)
					if (data.type === 'input_audio_buffer.speech_stopped') {
						voiceState = 'processing';
					}

					// Handle user input transcription
					if (data.type === 'conversation.item.input_audio_transcription.completed') {
						const transcript = data.transcript;
						if (transcript) {
							if (pendingUserMessageId) {
								// Update the placeholder message with actual transcript
								messages = messages.map((msg) =>
									msg.id === pendingUserMessageId ? { ...msg, content: transcript } : msg
								);
								pendingUserMessageId = null;
							} else {
								// No pending message, add new one (shouldn't happen often)
								const userMessage = {
									id: Date.now().toString(),
									role: 'user' as const,
									content: transcript,
									timestamp: new Date()
								};
								messages = [...messages, userMessage];
							}
							currentUserTranscript = '';
							scrollToBottom();
						}
					}

					// Handle live user transcription (while speaking)
					if (data.type === 'conversation.item.input_audio_transcription.delta') {
						currentUserTranscript += data.delta;
						voiceState = 'listening';
					}

					// Handle audio response from AI
					if (data.type === 'response.audio.delta') {
						voiceState = 'speaking';
						// Decode and queue audio for playback
						if (data.delta) {
							const audioData = base64ToArrayBuffer(data.delta);
							audioQueue.push(audioData);
							playNextAudioChunk();
						}
					}

					// Handle AI response transcript
					if (data.type === 'response.audio_transcript.delta') {
						voiceState = 'speaking';
						if (!currentAssistantId) {
							// First, ensure user message exists before assistant response
							if (!pendingUserMessageId) {
								// Create placeholder for user message (will be updated with transcript)
								pendingUserMessageId = Date.now().toString();
								const userPlaceholder = {
									id: pendingUserMessageId,
									role: 'user' as const,
									content: currentUserTranscript || '...',
									timestamp: new Date()
								};
								messages = [...messages, userPlaceholder];
							}

							// Now start new assistant message
							currentAssistantId = (Date.now() + 1).toString();
							const assistantMessage = {
								id: currentAssistantId,
								role: 'assistant' as const,
								content: data.delta || '',
								timestamp: new Date()
							};
							messages = [...messages, assistantMessage];
						} else {
							// Update existing assistant message
							messages = messages.map((msg) =>
								msg.id === currentAssistantId
									? { ...msg, content: msg.content + (data.delta || '') }
									: msg
							);
						}
						scrollToBottom();
					}

					// Handle AI response completion - back to listening
					if (data.type === 'response.done') {
						console.log('Response done - full data:', JSON.stringify(data, null, 2));
						console.log('Response status:', data.response?.status);
						console.log('Response output:', data.response?.output);

						// Check if response was cancelled or had no output
						if (data.response?.status === 'cancelled') {
							console.warn('Response was cancelled');
						} else if (!data.response?.output || data.response.output.length === 0) {
							console.warn('Response had no output items');
						}

						currentAssistantId = null;
						voiceState = 'listening';
					}

					if (data.type === 'response.audio_transcript.done') {
						currentAssistantId = null;
						voiceState = 'listening';
					}

					// Handle errors from the API
					if (data.type === 'error') {
						console.error('Realtime API error:', data.error);
						const errorCode = data.error?.code;
						const errorMessage = data.error?.message || 'Unknown error';

						// Handle various error types
						if (errorCode === 'session_expired' || errorCode === 'invalid_session') {
							stopVoiceChat();
							alert('Voice session expired. Please start again.');
						} else if (errorCode === 'rate_limit_exceeded') {
							stopVoiceChat();
							alert('Rate limit exceeded. Please wait a moment and try again.');
						} else if (errorCode === 'invalid_api_key' || errorCode === 'authentication_error') {
							stopVoiceChat();
							alert('Authentication error. Please check your API key configuration.');
						} else if (errorCode === 'model_not_found' || errorCode === 'invalid_model') {
							stopVoiceChat();
							alert('Voice model not available. Please check your configuration.');
						} else {
							// Log but don't necessarily stop for unknown errors
							console.warn(`Voice chat error (${errorCode}): ${errorMessage}`);
						}
					}
				} catch (err) {
					console.error('Failed to parse WebSocket message:', err);
				}
			};

			realtimeWs.onerror = (err) => {
				console.error('Voice chat WebSocket error event:', err);
				console.error('WebSocket readyState at error:', realtimeWs?.readyState);
				// Don't stop immediately - wait for close event
			};

			realtimeWs.onclose = (event) => {
				console.log('Voice chat WebSocket closed');
				console.log('Close code:', event.code);
				console.log('Close reason:', event.reason || '(no reason provided)');
				console.log('Was clean close:', event.wasClean);

				// Only stop if we're still supposed to be active
				if (isVoiceActive) {
					// Check if it was a clean close or an error
					if (event.code !== 1000) {
						console.error('WebSocket closed unexpectedly with code:', event.code);
						// Show helpful error message based on close code
						if (event.code === 1006) {
							// Abnormal closure - could be network issue or server rejection
							console.error('Connection closed abnormally (1006). This typically means:');
							console.error('- Invalid or expired authentication token');
							console.error('- Network connectivity issue');
							console.error('- Server rejected the connection');
						} else if (event.code === 1008) {
							// Policy violation
							console.error('Connection closed due to policy violation (1008).');
						} else if (event.code === 1011) {
							// Server error
							console.error('Server encountered an error (1011).');
						} else if (event.code === 1002) {
							console.error('Protocol error (1002).');
						} else if (event.code === 1003) {
							console.error('Unsupported data (1003).');
						}
					}
					stopVoiceChat();
				}
			};
		} catch (err) {
			console.error('Failed to start voice chat:', err);
			if (err instanceof Error && err.message.includes('Permission denied')) {
				alert('Microphone permission denied. Please allow microphone access to use voice chat.');
			} else if (err instanceof Error) {
				alert(`Failed to start voice chat: ${err.message}`);
			}
			stopVoiceChat();
		}
	}

	function arrayBufferToBase64(buffer: ArrayBuffer): string {
		const bytes = new Uint8Array(buffer);
		let binary = '';
		for (let i = 0; i < bytes.byteLength; i++) {
			binary += String.fromCharCode(bytes[i]);
		}
		return btoa(binary);
	}

	function base64ToArrayBuffer(base64: string): ArrayBuffer {
		const binaryString = atob(base64);
		const bytes = new Uint8Array(binaryString.length);
		for (let i = 0; i < binaryString.length; i++) {
			bytes[i] = binaryString.charCodeAt(i);
		}
		return bytes.buffer;
	}

	async function playNextAudioChunk() {
		if (isPlayingAudio || audioQueue.length === 0 || !audioContext) return;

		isPlayingAudio = true;
		const audioData = audioQueue.shift()!;

		try {
			// Convert Int16 PCM to Float32 for AudioContext
			const pcm16 = new Int16Array(audioData);
			const float32 = new Float32Array(pcm16.length);
			for (let i = 0; i < pcm16.length; i++) {
				float32[i] = pcm16[i] / 32768.0;
			}

			// Create audio buffer at 24kHz (OpenAI Realtime API output sample rate)
			// This must match the API's output rate, not the AudioContext's rate
			const OPENAI_OUTPUT_SAMPLE_RATE = 24000;
			const audioBuffer = audioContext.createBuffer(1, float32.length, OPENAI_OUTPUT_SAMPLE_RATE);
			audioBuffer.getChannelData(0).set(float32);

			// Create and play buffer source
			const source = audioContext.createBufferSource();
			source.buffer = audioBuffer;
			source.connect(audioContext.destination);

			source.onended = () => {
				isPlayingAudio = false;
				// Play next chunk if available
				if (audioQueue.length > 0) {
					playNextAudioChunk();
				}
			};

			source.start(0);
		} catch (err) {
			console.error('Audio playback error:', err);
			isPlayingAudio = false;
			// Try next chunk
			if (audioQueue.length > 0) {
				playNextAudioChunk();
			}
		}
	}

	function stopVoiceChat() {
		isVoiceActive = false;
		voiceState = 'idle';
		currentUserTranscript = '';
		currentAssistantId = null;
		pendingUserMessageId = null;
		audioQueue = [];
		isPlayingAudio = false;
		sessionConfigured = false;

		if (realtimeWs) {
			realtimeWs.close();
			realtimeWs = null;
		}

		if (audioProcessor) {
			audioProcessor.disconnect();
			audioProcessor.onaudioprocess = null;
			audioProcessor = null;
		}

		if (mediaStream) {
			mediaStream.getTracks().forEach((track) => track.stop());
			mediaStream = null;
		}

		if (audioContext) {
			audioContext.close();
			audioContext = null;
		}
	}
</script>

<svelte:head>
	<title>AI Chat - NebulaKit</title>
</svelte:head>

<div class="chat-interface">
	<!-- Messages container -->
	<div class="chat-messages" bind:this={chatContainer} role="region" aria-label="Chat messages">
		{#each messages as message (message.id)}
			<div
				class="message"
				class:user={message.role === 'user'}
				class:assistant={message.role === 'assistant'}
				in:fly={{ y: 20, duration: 400, easing: quintOut }}
			>
				<div class="message-avatar">
					{#if message.role === 'user'}
						<svg
							width="20"
							height="20"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
							<circle cx="12" cy="7" r="4" />
						</svg>
					{:else}
						<svg
							width="20"
							height="20"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<path d="M12 2L2 7l10 5 10-5-10-5z" />
							<path d="M2 17l10 5 10-5" />
							<path d="M2 12l10 5 10-5" />
						</svg>
					{/if}
				</div>
				<div class="message-bubble">
					<div class="message-content">{message.content}</div>
					<div class="message-timestamp">
						{message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
					</div>
				</div>
			</div>
		{/each}

		{#if currentUserTranscript && isVoiceActive}
			<div class="message user streaming" in:fade={{ duration: 200 }}>
				<div class="message-avatar">
					<svg
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
						<circle cx="12" cy="7" r="4" />
					</svg>
				</div>
				<div class="message-bubble">
					<div class="message-content">{currentUserTranscript}<span class="cursor">|</span></div>
				</div>
			</div>
		{/if}

		{#if streamingContent}
			<div class="message assistant streaming" in:fade={{ duration: 200 }}>
				<div class="message-avatar">
					<svg
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<path d="M12 2L2 7l10 5 10-5-10-5z" />
						<path d="M2 17l10 5 10-5" />
						<path d="M2 12l10 5 10-5" />
					</svg>
				</div>
				<div class="message-bubble">
					<div class="message-content">{streamingContent}<span class="cursor">|</span></div>
				</div>
			</div>
		{/if}

		{#if isLoading && !streamingContent}
			<div
				class="message assistant"
				in:fade={{ duration: 200 }}
				role="status"
				aria-label="AI is typing"
			>
				<div class="message-avatar">
					<svg
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<path d="M12 2L2 7l10 5 10-5-10-5z" />
						<path d="M2 17l10 5 10-5" />
						<path d="M2 12l10 5 10-5" />
					</svg>
				</div>
				<div class="message-bubble">
					<div class="typing-indicator">
						<span></span>
						<span></span>
						<span></span>
					</div>
				</div>
			</div>
		{/if}
	</div>

	<!-- Unified Input Area -->
	<div class="unified-input-area">
		<!-- Main input container -->
		<div class="input-wrapper">
			<div class="input-container" class:focused={isFocused}>
				<!-- Input field with send button inside -->
				<div class="textarea-wrapper">
					<textarea
						bind:this={textareaElement}
						bind:value={input}
						on:input={autoResizeTextarea}
						on:keydown={handleKeydown}
						on:focus={() => (isFocused = true)}
						on:blur={() => (isFocused = false)}
						placeholder={isVoiceActive ? 'Voice chat is active' : 'Message AI assistant'}
						class="chat-input"
						class:voice-active={isVoiceActive}
						class:has-send-button={!isVoiceActive}
						rows="1"
						maxlength={MAX_INPUT_LENGTH}
						disabled={isVoiceActive}
						aria-label="Chat message input"
					></textarea>

					<!-- Character count (shows when approaching limit) -->
					{#if showCharCount}
						<div
							class="char-count"
							class:warning={inputLength > MAX_INPUT_LENGTH * 0.9}
							in:fade={{ duration: 200 }}
						>
							{inputLength}/{MAX_INPUT_LENGTH}
						</div>
					{/if}

					<!-- Send button (inside input) -->
					{#if !isVoiceActive}
						<button
							on:click={sendMessage}
							disabled={!canSend}
							class="send-button-inline"
							class:can-send={canSend}
							aria-label="Send message"
							title="Send message (Enter)"
						>
							<svg
								width="20"
								height="20"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<path d="M22 2L11 13" />
								<path d="M22 2L15 22L11 13L2 9L22 2z" />
							</svg>
						</button>
					{/if}
				</div>

				<!-- Voice toggle button (on the right) -->
				{#if voiceAvailable}
					<VoiceButton isActive={isVoiceActive} state={voiceState} onClick={toggleVoiceChat} />
				{/if}
			</div>
			<!-- Input hint -->
			<div class="input-hint" class:visible={!isVoiceActive}>
				<span class="hint-text">
					<kbd>Enter</kbd> to send • <kbd>Shift + Enter</kbd> for new line
				</span>
			</div>
		</div>
	</div>
</div>

<style>
	.chat-interface {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--color-background);
		position: relative;
	}

	.chat-messages {
		flex: 1;
		overflow-y: auto;
		padding: var(--spacing-lg);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-lg);
		max-width: 1200px;
		width: 100%;
		margin: 0 auto;
	}

	.message {
		display: flex;
		gap: var(--spacing-md);
		max-width: 75%;
		animation: slideIn 0.3s ease-out;
	}

	@keyframes slideIn {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.message.user {
		align-self: flex-end;
		flex-direction: row-reverse;
	}

	.message.assistant {
		align-self: flex-start;
	}

	.message-avatar {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		color: var(--color-text);
	}

	.message.user .message-avatar {
		background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
		border: none;
		color: white;
	}

	.message-bubble {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xs);
		min-width: 0;
	}

	.message-content {
		background: var(--color-surface);
		padding: var(--spacing-md) var(--spacing-lg);
		border-radius: var(--radius-lg);
		border: 1px solid var(--color-border);
		word-wrap: break-word;
		white-space: pre-wrap;
		font-size: 0.938rem;
		line-height: 1.6;
		box-shadow: var(--shadow-sm);
		position: relative;
	}

	.message.user .message-content {
		background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
		color: white;
		border: none;
	}

	.message.streaming .message-content {
		border-color: var(--color-primary);
		animation: pulse 2s ease-in-out infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4);
		}
		50% {
			box-shadow: 0 0 0 8px rgba(59, 130, 246, 0);
		}
	}

	.cursor {
		display: inline-block;
		animation: blink 1s steps(2) infinite;
		color: var(--color-primary);
		font-weight: bold;
	}

	@keyframes blink {
		50% {
			opacity: 0;
		}
	}

	.message-timestamp {
		font-size: 0.75rem;
		color: var(--color-text-secondary);
		padding: 0 var(--spacing-sm);
	}

	.typing-indicator {
		display: flex;
		gap: 6px;
		padding: var(--spacing-sm);
	}

	.typing-indicator span {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--color-text-secondary);
		animation: typing 1.4s infinite;
	}

	.typing-indicator span:nth-child(2) {
		animation-delay: 0.2s;
	}

	.typing-indicator span:nth-child(3) {
		animation-delay: 0.4s;
	}

	@keyframes typing {
		0%,
		60%,
		100% {
			transform: translateY(0);
			opacity: 0.7;
		}
		30% {
			transform: translateY(-10px);
			opacity: 1;
		}
	}

	.unified-input-area {
		padding: var(--spacing-md) var(--spacing-lg) var(--spacing-lg);
		border-top: 1px solid var(--color-border);
		background: var(--color-surface);
		backdrop-filter: blur(12px);
		position: relative;
	}

	.input-wrapper {
		max-width: 1200px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-sm);
	}

	.input-container {
		display: flex;
		gap: var(--spacing-sm);
		align-items: flex-end;
		background: var(--color-background);
		border: 2px solid var(--color-border);
		border-radius: var(--radius-xl);
		padding: var(--spacing-sm);
		transition: all var(--transition-base);
		box-shadow: var(--shadow-sm);
	}

	.input-container.focused {
		border-color: var(--color-primary);
		box-shadow:
			0 0 0 4px rgba(59, 130, 246, 0.08),
			var(--shadow-md);
	}

	.input-container:hover:not(.focused) {
		border-color: var(--color-text-secondary);
	}

	.textarea-wrapper {
		flex: 1;
		position: relative;
		display: flex;
		align-items: flex-end;
	}

	.chat-input {
		flex: 1;
		background: transparent;
		border: none;
		padding: var(--spacing-sm) var(--spacing-md);
		font-family: var(--font-sans);
		font-size: 0.938rem;
		color: var(--color-text);
		resize: none;
		min-height: 44px;
		max-height: 200px;
		line-height: 1.6;
		transition: opacity var(--transition-fast);
		scrollbar-width: thin;
		scrollbar-color: var(--color-border) transparent;
	}

	.chat-input.has-send-button {
		padding-right: 52px;
	}

	.chat-input::-webkit-scrollbar {
		width: 6px;
	}

	.chat-input::-webkit-scrollbar-track {
		background: transparent;
	}

	.chat-input::-webkit-scrollbar-thumb {
		background: var(--color-border);
		border-radius: var(--radius-sm);
	}

	.chat-input::-webkit-scrollbar-thumb:hover {
		background: var(--color-text-secondary);
	}

	.chat-input:focus {
		outline: none;
	}

	.chat-input::placeholder {
		color: var(--color-text-secondary);
		opacity: 0.7;
	}

	.chat-input:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.char-count {
		position: absolute;
		right: var(--spacing-sm);
		bottom: var(--spacing-xs);
		font-size: 0.688rem;
		color: var(--color-text-secondary);
		background: var(--color-background);
		padding: 2px var(--spacing-xs);
		border-radius: var(--radius-sm);
		pointer-events: none;
		transition: color var(--transition-fast);
	}

	.char-count.warning {
		color: var(--color-warning);
		font-weight: 600;
	}

	.send-button-inline {
		position: absolute;
		right: var(--spacing-xs);
		bottom: var(--spacing-xs);
		width: 36px;
		height: 36px;
		border-radius: var(--radius-md);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all var(--transition-base);
		flex-shrink: 0;
		border: none;
		background: var(--color-surface);
		color: var(--color-text-secondary);
	}

	.send-button-inline:hover:not(:disabled) {
		background: var(--color-surface-hover);
		color: var(--color-text);
		transform: scale(1.05);
	}

	.send-button-inline.can-send {
		background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
		color: white;
		box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
	}

	.send-button-inline.can-send:hover {
		box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
		transform: scale(1.08) translateY(-1px);
	}

	.send-button-inline.can-send:active {
		transform: scale(0.98);
	}

	.send-button-inline:disabled {
		opacity: 0.4;
		cursor: not-allowed;
		transform: none;
	}

	.input-hint {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0 var(--spacing-sm);
		opacity: 0;
		transition: opacity var(--transition-base);
	}

	.input-hint.visible {
		opacity: 1;
	}

	.hint-text {
		font-size: 0.75rem;
		color: var(--color-text-secondary);
		display: flex;
		align-items: center;
		gap: var(--spacing-xs);
	}

	.hint-text kbd {
		background: var(--color-background);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		padding: 2px 6px;
		font-family: var(--font-mono);
		font-size: 0.688rem;
		color: var(--color-text);
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
	}

	@media (max-width: 768px) {
		.message {
			max-width: 90%;
		}

		.unified-input-area {
			padding: var(--spacing-sm) var(--spacing-md) var(--spacing-md);
		}

		.chat-messages {
			padding: var(--spacing-md);
			gap: var(--spacing-md);
		}

		.input-container {
			border-radius: var(--radius-lg);
		}

		.hint-text {
			font-size: 0.688rem;
		}

		.hint-text kbd {
			padding: 1px 4px;
			font-size: 0.625rem;
		}
	}
</style>
