/**
 * OpenAI Chat Service
 * Handles streaming text chat and realtime voice chat with OpenAI API
 */

export interface ChatMessage {
	role: 'user' | 'assistant' | 'system';
	content: string;
}

export interface AIKey {
	id: string;
	name: string;
	provider: string;
	apiKey: string;
	enabled: boolean;
	voiceEnabled?: boolean;
	voiceModel?: string;
}

export interface RealtimeSessionResponse {
	token: string;
}

/**
 * Get the first enabled OpenAI API key from KV storage
 */
export async function getEnabledOpenAIKey(platform: App.Platform): Promise<AIKey | null> {
	try {
		const keysList = await platform.env.KV.get('ai_keys_list');
		if (!keysList) {
			return null;
		}

		const keyIds = JSON.parse(keysList);

		for (const keyId of keyIds) {
			const keyData = await platform.env.KV.get(`ai_key:${keyId}`);
			if (keyData) {
				const key = JSON.parse(keyData) as AIKey;
				// Only return OpenAI keys that are enabled
				if (key.provider === 'openai' && key.enabled !== false) {
					return key;
				}
			}
		}

		return null;
	} catch (err) {
		console.error('Failed to get OpenAI key:', err);
		return null;
	}
}

/**
 * Stream chat completion from OpenAI API
 */
export async function* streamChatCompletion(
	apiKey: string,
	messages: ChatMessage[],
	options: {
		model?: string;
		temperature?: number;
		maxTokens?: number;
	} = {}
): AsyncGenerator<string, void, unknown> {
	const { model = 'gpt-4o', temperature = 0.7, maxTokens = 2048 } = options;

	const response = await fetch('https://api.openai.com/v1/chat/completions', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${apiKey}`
		},
		body: JSON.stringify({
			model,
			messages,
			temperature,
			max_tokens: maxTokens,
			stream: true
		})
	});

	if (!response.ok) {
		throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
	}

	const reader = response.body?.getReader();
	if (!reader) {
		throw new Error('No response body');
	}

	const decoder = new TextDecoder();
	let buffer = '';

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;

		buffer += decoder.decode(value, { stream: true });
		const lines = buffer.split('\n');
		buffer = lines.pop() || '';

		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed || trimmed === 'data: [DONE]') continue;
			if (!trimmed.startsWith('data: ')) continue;

			try {
				const json = JSON.parse(trimmed.slice(6));
				const content = json.choices?.[0]?.delta?.content;
				if (content) {
					yield content;
				}
			} catch (err) {
				console.error('Failed to parse SSE line:', trimmed, err);
			}
		}
	}
}

/**
 * Create ephemeral token for OpenAI Realtime API (voice chat)
 */
export async function createRealtimeSession(
	apiKey: string,
	model: string = 'gpt-4o-realtime-preview-2024-12-17'
): Promise<RealtimeSessionResponse> {
	console.log('Creating realtime session for model:', model);

	const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${apiKey}`
		},
		body: JSON.stringify({
			model,
			voice: 'alloy'
		})
	});

	if (!response.ok) {
		const errorText = await response.text().catch(() => 'Unknown error');
		console.error('Failed to create realtime session:', response.status, errorText);
		throw new Error(`Failed to create realtime session: ${response.status} - ${errorText}`);
	}

	const data = await response.json();
	console.log('Realtime session API response keys:', Object.keys(data));
	console.log('Full response data:', JSON.stringify(data, null, 2));

	if (!data.client_secret?.value) {
		console.error('Invalid response from realtime sessions API:', data);
		throw new Error('Invalid response: missing client_secret');
	}

	console.log('Successfully got client_secret, length:', data.client_secret.value.length);
	console.log('Session ID:', data.id);
	console.log('Expires at:', data.client_secret.expires_at);

	return {
		token: data.client_secret.value
	};
}

/**
 * Format messages for OpenAI API
 */
export function formatMessagesForOpenAI(
	messages: Array<{ id: string; role: string; content: string; timestamp: Date }>,
	options: { includeSystem?: boolean } = {}
): ChatMessage[] {
	const { includeSystem = true } = options;

	return messages
		.filter((msg) => {
			if (!includeSystem && msg.role === 'system') {
				return false;
			}
			return msg.role === 'user' || msg.role === 'assistant' || msg.role === 'system';
		})
		.map((msg) => ({
			role: msg.role as 'user' | 'assistant' | 'system',
			content: msg.content
		}));
}
