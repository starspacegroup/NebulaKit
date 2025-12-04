import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// OpenAI model pricing per 1M tokens (as of December 2025)
// Source: https://openai.com/api/pricing/
const OPENAI_PRICING: Record<string, { input: number; output: number; cached?: number }> = {
	// GPT-5.1 (flagship, latest)
	'gpt-5.1': { input: 1.25, output: 10, cached: 0.125 },

	// GPT-5 models
	'gpt-5': { input: 2, output: 8, cached: 0.2 },
	'gpt-5-mini': { input: 0.25, output: 2, cached: 0.025 },
	'gpt-5-nano': { input: 0.05, output: 0.4, cached: 0.005 },
	'gpt-5-pro': { input: 15, output: 120 },

	// GPT-4.1 models
	'gpt-4.1': { input: 3, output: 12, cached: 0.75 },
	'gpt-4.1-mini': { input: 0.8, output: 3.2, cached: 0.2 },
	'gpt-4.1-nano': { input: 0.2, output: 0.8, cached: 0.05 },

	// GPT-4o models
	'gpt-4o': { input: 2.5, output: 10, cached: 1.25 },
	'gpt-4o-2024-11-20': { input: 2.5, output: 10, cached: 1.25 },
	'gpt-4o-2024-08-06': { input: 2.5, output: 10, cached: 1.25 },
	'gpt-4o-2024-05-13': { input: 5, output: 15 },

	// GPT-4o Audio Preview
	'gpt-4o-audio-preview': { input: 2.5, output: 10 },
	'gpt-4o-audio-preview-2024-12-17': { input: 2.5, output: 10 },
	'gpt-4o-audio-preview-2024-10-01': { input: 2.5, output: 10 },

	// GPT-4o mini
	'gpt-4o-mini': { input: 0.15, output: 0.6, cached: 0.075 },
	'gpt-4o-mini-2024-07-18': { input: 0.15, output: 0.6, cached: 0.075 },

	// GPT-4o mini Audio Preview
	'gpt-4o-mini-audio-preview': { input: 0.15, output: 0.6 },
	'gpt-4o-mini-audio-preview-2024-12-17': { input: 0.15, output: 0.6 },

	// o4-mini (reasoning)
	'o4-mini': { input: 4, output: 16, cached: 1 },

	// o3 models (reasoning)
	o3: { input: 20, output: 80, cached: 10 },
	'o3-mini': { input: 4, output: 16, cached: 2 },

	// o1 models (reasoning)
	o1: { input: 15, output: 60, cached: 7.5 },
	'o1-2024-12-17': { input: 15, output: 60, cached: 7.5 },
	'o1-preview': { input: 15, output: 60 },
	'o1-preview-2024-09-12': { input: 15, output: 60 },
	'o1-mini': { input: 3, output: 12, cached: 1.5 },
	'o1-mini-2024-09-12': { input: 3, output: 12, cached: 1.5 },

	// GPT-4 Turbo
	'gpt-4-turbo': { input: 10, output: 30 },
	'gpt-4-turbo-2024-04-09': { input: 10, output: 30 },
	'gpt-4-turbo-preview': { input: 10, output: 30 },
	'gpt-4-0125-preview': { input: 10, output: 30 },
	'gpt-4-1106-preview': { input: 10, output: 30 },

	// GPT-4
	'gpt-4': { input: 30, output: 60 },
	'gpt-4-0613': { input: 30, output: 60 },
	'gpt-4-0314': { input: 30, output: 60 },

	// GPT-4 32k
	'gpt-4-32k': { input: 60, output: 120 },
	'gpt-4-32k-0613': { input: 60, output: 120 },
	'gpt-4-32k-0314': { input: 60, output: 120 },

	// GPT-3.5 Turbo
	'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
	'gpt-3.5-turbo-0125': { input: 0.5, output: 1.5 },
	'gpt-3.5-turbo-1106': { input: 1, output: 2 },
	'gpt-3.5-turbo-instruct': { input: 1.5, output: 2 },

	// GPT-3.5 Turbo 16k
	'gpt-3.5-turbo-16k': { input: 3, output: 4 },
	'gpt-3.5-turbo-16k-0613': { input: 3, output: 4 },

	// Realtime API models (text tokens per 1M)
	'gpt-4o-realtime-preview': { input: 4, output: 16, cached: 0.4 },
	'gpt-4o-realtime-preview-2024-12-17': { input: 4, output: 16, cached: 0.4 },
	'gpt-4o-realtime-preview-2024-10-01': { input: 5, output: 20 },
	'gpt-4o-mini-realtime-preview': { input: 0.6, output: 2.4, cached: 0.06 },
	'gpt-4o-mini-realtime-preview-2024-12-17': { input: 0.6, output: 2.4, cached: 0.06 },
	'gpt-realtime': { input: 4, output: 16, cached: 0.4 },
	'gpt-realtime-mini': { input: 0.6, output: 2.4, cached: 0.06 }
};

// Realtime API audio pricing per minute
const REALTIME_AUDIO_PRICING: Record<string, { input: number; output: number }> = {
	'gpt-4o-realtime-preview': { input: 0.06, output: 0.24 },
	'gpt-4o-realtime-preview-2024-12-17': { input: 0.06, output: 0.24 },
	'gpt-4o-realtime-preview-2024-10-01': { input: 0.1, output: 0.2 },
	'gpt-4o-mini-realtime-preview': { input: 0.01, output: 0.04 },
	'gpt-4o-mini-realtime-preview-2024-12-17': { input: 0.01, output: 0.04 },
	'gpt-realtime': { input: 0.06, output: 0.24 },
	'gpt-realtime-mini': { input: 0.01, output: 0.04 }
};

// Models suitable for chat completions
const CHAT_MODEL_PREFIXES = [
	'gpt-5.1',
	'gpt-5',
	'gpt-4.1',
	'gpt-4o',
	'gpt-4-turbo',
	'gpt-4-',
	'gpt-4',
	'gpt-3.5-turbo',
	'o4-',
	'o4',
	'o3-',
	'o3',
	'o1-',
	'o1'
];

// Models for realtime/voice
const REALTIME_MODEL_PREFIXES = ['gpt-4o-realtime', 'gpt-4o-mini-realtime', 'gpt-realtime'];

interface OpenAIModel {
	id: string;
	object: string;
	created: number;
	owned_by: string;
}

interface OpenAIModelsResponse {
	object: string;
	data: OpenAIModel[];
}

export interface ModelWithPricing {
	id: string;
	pricing?: {
		input: number;
		output: number;
		cached?: number;
	};
	audioPricing?: {
		input: number;
		output: number;
	};
	ownedBy: string;
	created: number;
}

function isChatModel(modelId: string): boolean {
	// Exclude realtime models from chat models
	if (modelId.includes('realtime')) return false;
	// Exclude audio preview models from regular chat
	if (modelId.includes('audio-preview')) return false;
	// Exclude embedding, whisper, tts, dall-e models
	if (
		modelId.includes('embedding') ||
		modelId.includes('whisper') ||
		modelId.includes('tts') ||
		modelId.includes('dall-e') ||
		modelId.includes('text-embedding') ||
		modelId.includes('davinci') ||
		modelId.includes('babbage') ||
		modelId.includes('curie') ||
		modelId.includes('ada')
	)
		return false;

	return CHAT_MODEL_PREFIXES.some(
		(prefix) => modelId === prefix || modelId.startsWith(prefix + '-')
	);
}

function isRealtimeModel(modelId: string): boolean {
	return REALTIME_MODEL_PREFIXES.some((prefix) => modelId.startsWith(prefix));
}

// GET - Fetch available OpenAI models with pricing
export const GET: RequestHandler = async ({ platform, locals, url }) => {
	if (!locals.user?.isOwner) {
		throw error(403, 'Admin access required');
	}

	const keyId = url.searchParams.get('keyId');
	let apiKey: string | null = null;

	// If a specific key ID is provided, use that key
	if (keyId && platform?.env?.KV) {
		const keyData = await platform.env.KV.get(`ai_key:${keyId}`);
		if (keyData) {
			const key = JSON.parse(keyData);
			if (key.provider === 'openai' && key.apiKey) {
				apiKey = key.apiKey;
			}
		}
	}

	// If no specific key, try to find any OpenAI key
	if (!apiKey && platform?.env?.KV) {
		const keysList = await platform.env.KV.get('ai_keys_list');
		if (keysList) {
			const keyIds = JSON.parse(keysList);
			for (const id of keyIds) {
				const keyData = await platform.env.KV.get(`ai_key:${id}`);
				if (keyData) {
					const key = JSON.parse(keyData);
					if (key.provider === 'openai' && key.apiKey) {
						apiKey = key.apiKey;
						break;
					}
				}
			}
		}
	}

	// If still no API key, return static model lists with pricing
	if (!apiKey) {
		// Return curated lists based on known models
		const chatModels: ModelWithPricing[] = Object.entries(OPENAI_PRICING)
			.filter(([id]) => isChatModel(id))
			.map(([id, pricing]) => ({
				id,
				pricing,
				ownedBy: 'openai',
				created: 0
			}))
			.sort((a, b) => a.id.localeCompare(b.id));

		const voiceModels: ModelWithPricing[] = Object.entries(OPENAI_PRICING)
			.filter(([id]) => isRealtimeModel(id))
			.map(([id, pricing]) => ({
				id,
				pricing,
				audioPricing: REALTIME_AUDIO_PRICING[id],
				ownedBy: 'openai',
				created: 0
			}))
			.sort((a, b) => a.id.localeCompare(b.id));

		return json({
			chatModels,
			voiceModels,
			fromApi: false
		});
	}

	try {
		// Fetch models from OpenAI API
		const response = await fetch('https://api.openai.com/v1/models', {
			headers: {
				Authorization: `Bearer ${apiKey}`
			}
		});

		if (!response.ok) {
			const errorText = await response.text().catch(() => 'Unknown error');
			console.error('Failed to fetch OpenAI models:', response.status, errorText);
			throw error(response.status, `Failed to fetch models: ${errorText}`);
		}

		const data: OpenAIModelsResponse = await response.json();

		// Filter and enrich models with pricing
		const chatModels: ModelWithPricing[] = data.data
			.filter((m) => isChatModel(m.id))
			.map((m) => ({
				id: m.id,
				pricing: OPENAI_PRICING[m.id],
				ownedBy: m.owned_by,
				created: m.created
			}))
			.sort((a, b) => {
				// Sort by: has pricing first, then by name
				if (a.pricing && !b.pricing) return -1;
				if (!a.pricing && b.pricing) return 1;
				return a.id.localeCompare(b.id);
			});

		const voiceModels: ModelWithPricing[] = data.data
			.filter((m) => isRealtimeModel(m.id))
			.map((m) => ({
				id: m.id,
				pricing: OPENAI_PRICING[m.id],
				audioPricing: REALTIME_AUDIO_PRICING[m.id],
				ownedBy: m.owned_by,
				created: m.created
			}))
			.sort((a, b) => a.id.localeCompare(b.id));

		return json({
			chatModels,
			voiceModels,
			fromApi: true
		});
	} catch (err) {
		// Re-throw SvelteKit errors (they have status property)
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}
		console.error('Failed to fetch OpenAI models:', err);
		throw error(500, 'Failed to fetch OpenAI models');
	}
};
