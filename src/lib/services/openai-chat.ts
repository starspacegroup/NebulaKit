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
	// Text chat models enabled for this key
	models?: string[];
	// Legacy single model field (for backwards compatibility)
	model?: string;
	voiceEnabled?: boolean;
	// Voice models enabled for this key
	voiceModels?: string[];
	// Legacy single voice model field (for backwards compatibility)
	voiceModel?: string;
}

export const CHAT_MODELS = [
	{ id: 'gpt-4o', displayName: 'GPT-4o' },
	{ id: 'gpt-4o-2024-11-20', displayName: 'GPT-4o (Nov 2024)' },
	{ id: 'gpt-4o-2024-08-06', displayName: 'GPT-4o (Aug 2024)' },
	{ id: 'gpt-4o-mini', displayName: 'GPT-4o mini' },
	{ id: 'o3', displayName: 'o3' },
	{ id: 'o3-mini', displayName: 'o3 mini' },
	{ id: 'o4-mini', displayName: 'o4 mini' },
	{ id: 'o1', displayName: 'o1' },
	{ id: 'o1-2024-12-17', displayName: 'o1 (Dec 2024)' },
	{ id: 'o1-preview', displayName: 'o1 Preview' },
	{ id: 'o1-mini', displayName: 'o1 mini' },
	{ id: 'o1-mini-2024-09-12', displayName: 'o1 mini (Sep 2024)' },
	{ id: 'gpt-4-turbo', displayName: 'GPT-4 Turbo' },
	{ id: 'gpt-4-turbo-2024-04-09', displayName: 'GPT-4 Turbo (Apr 2024)' },
	{ id: 'gpt-4', displayName: 'GPT-4' },
	{ id: 'gpt-3.5-turbo', displayName: 'GPT-3.5 Turbo' },
	{ id: 'gpt-3.5-turbo-0125', displayName: 'GPT-3.5 Turbo (Jan 2025)' }
] as const;

const CHAT_MODEL_IDS = new Set<string>(CHAT_MODELS.map(({ id }) => id));

export function getConfiguredChatModels(key: AIKey): string[] {
	const models = key.models || (key.model ? [key.model] : []);
	return models.filter(
		(model): model is string => typeof model === 'string' && CHAT_MODEL_IDS.has(model)
	);
}

export function selectDefaultChatModel(models: string[]): string | undefined {
	if (models.includes('gpt-4o-mini')) return 'gpt-4o-mini';
	if (models.includes('gpt-4o')) return 'gpt-4o';
	return models[0];
}

export interface RealtimeSessionResponse {
	token: string;
}

export interface StreamChunk {
	type: 'content' | 'usage';
	content?: string;
	usage?: {
		promptTokens: number;
		completionTokens: number;
		totalTokens: number;
	};
	model?: string;
}

/**
 * Get the first enabled OpenAI API key from KV storage, optionally restricted
 * to a configured text model.
 */
export async function getEnabledOpenAIKey(
	platform: App.Platform,
	model?: string
): Promise<AIKey | null> {
	if (model && !CHAT_MODEL_IDS.has(model)) return null;
	const keys = await getEnabledOpenAIKeys(platform);
	return keys.find((key) => !model || getConfiguredChatModels(key).includes(model)) ?? null;
}

export async function getEnabledOpenAIKeys(platform: App.Platform): Promise<AIKey[]> {
	try {
		const keysList = await platform.env.KV.get('ai_keys_list');
		if (!keysList) return [];

		const keyIds = JSON.parse(keysList) as string[];
		const keys: AIKey[] = [];

		for (const keyId of keyIds) {
			const keyData = await platform.env.KV.get(`ai_key:${keyId}`);
			if (keyData) {
				const key = JSON.parse(keyData) as AIKey;
				if (key.provider === 'openai' && key.enabled !== false) keys.push(key);
			}
		}

		return keys;
	} catch (err) {
		console.error('Failed to get OpenAI key:', err);
		return [];
	}
}

/**
 * Stream chat completion from OpenAI API
 * Yields content chunks and finally a usage chunk with token counts
 */
export async function* streamChatCompletion(
	apiKey: string,
	messages: ChatMessage[],
	options: {
		model?: string;
		temperature?: number;
		maxTokens?: number;
	} = {}
): AsyncGenerator<StreamChunk, void, unknown> {
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
			stream: true,
			stream_options: { include_usage: true }
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

				// Check for usage data (comes in the final chunk)
				if (json.usage) {
					yield {
						type: 'usage',
						usage: {
							promptTokens: json.usage.prompt_tokens,
							completionTokens: json.usage.completion_tokens,
							totalTokens: json.usage.total_tokens
						},
						model: json.model || model
					};
				}

				// Check for content delta
				const content = json.choices?.[0]?.delta?.content;
				if (content) {
					yield { type: 'content', content };
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

	if (!data.client_secret?.value) {
		console.error('Invalid response from realtime sessions API: missing client_secret');
		throw new Error('Invalid response: missing client_secret');
	}

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
